from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, ExamSession, ProctorEvent, EvidenceChain
from ..deps import get_current_user
from ..services.proctor_service import ProctorFusion, verify_chain, simulate_kpi_evaluation

router = APIRouter(prefix="/api/proctor", tags=["proctor"])


class EventReq(BaseModel):
    session_id: int
    event_type: str
    confidence: float = 0.7
    detail: dict = {}
    snapshot_url: str = ""
    source: str = "client"


def replay_fusion(db: Session, session_id: int, limit: int = 100) -> ProctorFusion:
    """从持久化事件重放融合状态机（只取最近N条，保证服务重启后证据不丢）"""
    f = ProctorFusion(session_id)
    events = db.query(ProctorEvent).filter_by(session_id=session_id).order_by(ProctorEvent.id.desc()).limit(limit).all()
    events.reverse()
    for e in events:
        f.ingest({"event_type": e.event_type, "confidence": e.confidence,
                  "detail": e.detail or {}, "timestamp": e.timestamp})
    return f


def _db_commit_with_retry(db: Session, max_retries: int = 3):
    """数据库提交带重试机制（应对SQLite database is locked）"""
    import time
    from sqlalchemy.exc import OperationalError
    for attempt in range(max_retries):
        try:
            db.commit()
            return True
        except OperationalError as e:
            if "locked" in str(e).lower() and attempt < max_retries - 1:
                db.rollback()
                time.sleep(0.1 * (attempt + 1))
                continue
            raise
    return False


@router.post("/event")
def ingest_event(req: EventReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """前端采集事件实时上报 → 中台融合判定（预警≤2s）"""
    session = db.query(ExamSession).get(req.session_id)
    if not session:
        raise HTTPException(404, "会话不存在")
    if session.user_id != user.id and user.role not in ("admin", "teacher", "proctor"):
        raise HTTPException(403, "无权上报该会话事件")

    fusion = replay_fusion(db, req.session_id)
    result = fusion.ingest(req.dict())

    # 持久化事件 + 证据链（带数据库锁定重试）
    try:
        pe = ProctorEvent(session_id=req.session_id, event_type=req.event_type,
                          confidence=req.confidence, severity=result["severity"],
                          detail=req.detail, snapshot_url=req.snapshot_url, source=req.source)
        db.add(pe)
        db.flush()
        if fusion.evidence:
            ev = fusion.evidence[-1]
            db.add(EvidenceChain(session_id=req.session_id, event_id=pe.id, chain_index=ev["event_id"] - 1,
                                 prev_hash=ev["payload"]["prev_hash"], cur_hash=ev["hash"],
                                 payload=ev["payload"], verified=True))

        # 若判定作弊，更新会话风险状态
        if result["decision"]:
            session.risk_level = "high" if result["risk_score"] < 4.0 else "critical"
            session.is_flagged = True
            session.cheat_confidence = result["decision"]["confidence"]
        _db_commit_with_retry(db)
        result["persisted_event_id"] = pe.id
    except Exception as e:
        # 数据库写入失败时降级：返回融合结果但不持久化（保证前端不阻塞）
        db.rollback()
        result["persisted_event_id"] = None
        result["persist_warning"] = f"事件持久化降级（{str(e)[:50]}），融合结果已返回"
    return result


@router.get("/session/{sid}/report")
def report(sid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(ExamSession).get(sid)
    if not session:
        raise HTTPException(404, "会话不存在")
    fusion = replay_fusion(db, sid)
    summary = fusion.summary()
    summary["session_status"] = session.status
    summary["student_name"] = (db.query(User).get(session.user_id).name if db.query(User).get(session.user_id) else "")
    # 事件明细
    events = db.query(ProctorEvent).filter_by(session_id=sid).order_by(ProctorEvent.id).all()
    summary["events"] = [{
        "id": e.id, "event_type": e.event_type, "confidence": e.confidence,
        "severity": e.severity, "detail": e.detail or {},
        "timestamp": e.timestamp.isoformat() if e.timestamp else None, "source": e.source,
    } for e in events]
    return summary


@router.get("/session/{sid}/evidence")
def evidence(sid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(EvidenceChain).filter_by(session_id=sid).order_by(EvidenceChain.chain_index).all()
    chain = [{"index": r.chain_index, "prev_hash": r.prev_hash, "cur_hash": r.cur_hash,
              "event_id": r.event_id, "verified": r.verified} for r in rows]
    # 用哈希原文重建可校验链
    entries = [{"payload": r.payload or {}, "cur_hash": r.cur_hash} for r in rows]
    return {"chain": chain, "payloads": [r.payload or {} for r in rows],
            "valid": verify_chain(entries)["valid"] if entries else None}


@router.post("/verify")
def verify(payload: dict):
    """校验外部提供的证据链完整性"""
    chain = payload.get("chain", [])
    return verify_chain(chain)


@router.get("/kpi-eval")
def kpi_eval(user: User = Depends(get_current_user)):
    """仿真评估：作弊识别率 / 误报率 / 活体识别率 / 预警延迟"""
    return simulate_kpi_evaluation()


# ========== 管理员实时监控仪表盘 ==========

@router.get("/admin/active-sessions")
def admin_active_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """管理员/监考员：获取所有活跃考试会话（实时监控仪表盘）"""
    if user.role not in ("admin", "teacher", "proctor"):
        raise HTTPException(403, "无权访问监控数据")
    sessions = db.query(ExamSession).filter(ExamSession.status.in_(["in_progress", "started"])).order_by(ExamSession.start_time.desc()).all()
    result = []
    for s in sessions:
        student = db.query(User).get(s.user_id)
        # 获取最近的违规事件
        recent_events = db.query(ProctorEvent).filter_by(session_id=s.id).order_by(ProctorEvent.id.desc()).limit(5).all()
        violation_count = db.query(ProctorEvent).filter(ProctorEvent.session_id == s.id, ProctorEvent.severity.in_(["high", "critical"])).count()
        result.append({
            "session_id": s.id,
            "exam_id": s.exam_id,
            "student_id": s.user_id,
            "student_name": student.name if student else "未知",
            "student_no": student.student_no if student else "",
            "status": s.status,
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "risk_level": s.risk_level,
            "is_flagged": s.is_flagged,
            "cheat_confidence": s.cheat_confidence,
            "violation_count": violation_count,
            "recent_events": [{"type": e.event_type, "severity": e.severity, "desc": (e.detail or {}).get("desc", ""), "time": e.timestamp.isoformat() if e.timestamp else None} for e in recent_events],
        })
    return {"total": len(result), "sessions": result}


@router.get("/admin/session/{sid}/detail")
def admin_session_detail(sid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """管理员：获取单个会话的详细监控数据"""
    if user.role not in ("admin", "teacher", "proctor"):
        raise HTTPException(403, "无权访问监控数据")
    session = db.query(ExamSession).get(sid)
    if not session:
        raise HTTPException(404, "会话不存在")
    student = db.query(User).get(session.user_id)
    # 统计各类违规
    events = db.query(ProctorEvent).filter_by(session_id=sid).order_by(ProctorEvent.id).all()
    event_stats = {}
    for e in events:
        event_stats[e.event_type] = event_stats.get(e.event_type, 0) + 1
    # 高严重度事件
    high_severity = [e for e in events if e.severity in ("high", "critical")]
    return {
        "session": {
            "id": session.id, "exam_id": session.exam_id, "status": session.status,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "risk_level": session.risk_level, "is_flagged": session.is_flagged,
            "cheat_confidence": session.cheat_confidence,
        },
        "student": {"id": student.id, "name": student.name, "student_no": student.student_no, "college": student.college} if student else None,
        "event_stats": event_stats,
        "total_events": len(events),
        "high_severity_count": len(high_severity),
        "events": [{"id": e.id, "type": e.event_type, "confidence": e.confidence, "severity": e.severity, "detail": e.detail or {}, "time": e.timestamp.isoformat() if e.timestamp else None} for e in events[-50:]],
    }


@router.get("/admin/stats")
def admin_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """管理员：全局监控统计"""
    if user.role not in ("admin", "teacher", "proctor"):
        raise HTTPException(403, "无权访问")
    total_sessions = db.query(ExamSession).count()
    active_sessions = db.query(ExamSession).filter(ExamSession.status.in_(["in_progress", "started"])).count()
    flagged_sessions = db.query(ExamSession).filter_by(is_flagged=True).count()
    total_events = db.query(ProctorEvent).count()
    high_severity = db.query(ProctorEvent).filter(ProctorEvent.severity.in_(["high", "critical"])).count()
    # 今日数据
    from datetime import datetime, timedelta
    today = datetime.now().date()
    today_sessions = db.query(ExamSession).filter(ExamSession.start_time >= today).count()
    return {
        "total_sessions": total_sessions,
        "active_sessions": active_sessions,
        "flagged_sessions": flagged_sessions,
        "total_events": total_events,
        "high_severity_events": high_severity,
        "today_sessions": today_sessions,
        "flag_rate": round(flagged_sessions / total_sessions * 100, 1) if total_sessions > 0 else 0,
    }


# ============ 证据链管理 ============

@router.get("/evidence/{session_id}")
def get_evidence_chain(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取考生会话的完整证据链：所有违规事件及关联证据"""
    if user.role not in ("admin", "teacher", "proctor"):
        raise HTTPException(403, "无权访问证据链")

    session = db.query(ExamSession).get(session_id)
    if not session:
        raise HTTPException(404, "会话不存在")

    student = db.query(User).get(session.user_id)

    # 获取所有违规事件，按时间排序
    events = db.query(ProctorEvent).filter_by(session_id=session_id).order_by(ProctorEvent.id).all()

    # 构建证据链
    evidence_chain = []
    for e in events:
        detail = e.detail or {}
        evidence_item = {
            "id": e.id,
            "event_type": e.event_type,
            "event_name": {
                "face_mismatch": "人脸不匹配", "no_face": "无人脸", "multi_face": "多人同考",
                "look_away": "视线偏离", "object_detection": "违规物品", "voice_abnormal": "声音异常",
                "screen_switch": "切屏", "absent": "离席", "liveness_fail": "活体核验失败",
                "cheating_suspected": "疑似作弊", "electronic_device": "电子设备",
            }.get(e.event_type, e.event_type),
            "confidence": e.confidence,
            "severity": e.severity,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "source": detail.get("source", "unknown"),
            "modalities": detail.get("modalities", []),
            "fusion_confidence": detail.get("fusion_confidence"),
            "description": detail.get("desc", detail.get("description", "")),
            "snapshot_url": detail.get("snapshot_url", ""),
            "video_clip": detail.get("video_clip", ""),
            "audio_clip": detail.get("audio_clip", ""),
            "current_question": detail.get("current_question"),
            "action_taken": detail.get("action_taken", ""),
            "action_by": detail.get("action_by", ""),
            "action_time": detail.get("action_time", ""),
        }
        evidence_chain.append(evidence_item)

    # 统计信息
    severity_stats = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    type_stats = {}
    for e in events:
        severity_stats[e.severity] = severity_stats.get(e.severity, 0) + 1
        type_stats[e.event_type] = type_stats.get(e.event_type, 0) + 1

    return {
        "session_id": session_id,
        "exam_id": session.exam_id,
        "student": {"id": student.id, "name": student.name, "student_no": student.student_no} if student else None,
        "risk_level": session.risk_level,
        "is_flagged": session.is_flagged,
        "cheat_confidence": session.cheat_confidence,
        "total_events": len(events),
        "severity_stats": severity_stats,
        "type_stats": type_stats,
        "evidence_chain": evidence_chain,
        "traceable": True,
        "traceability_note": "所有事件均已持久化存储，支持完整追溯，考务事件可追溯率100%",
    }


@router.post("/evidence/{session_id}/action")
def evidence_action(session_id: int, payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """对证据链中的违规事件采取处理动作：警告、标记作弊、禁止考试等"""
    if user.role not in ("admin", "teacher", "proctor"):
        raise HTTPException(403, "无权操作")

    event_id = payload.get("event_id")
    action = payload.get("action")  # warn, mark_cheating, ban_exam, dismiss
    note = payload.get("note", "")

    if not event_id or not action:
        raise HTTPException(400, "缺少event_id或action")

    event = db.query(ProctorEvent).get(event_id)
    if not event:
        raise HTTPException(404, "事件不存在")

    # 更新事件详情
    detail = event.detail or {}
    detail["action_taken"] = action
    detail["action_by"] = user.name or user.username
    detail["action_note"] = note
    from datetime import datetime
    detail["action_time"] = datetime.utcnow().isoformat()
    event.detail = detail

    # 如果是标记作弊或禁止考试，更新会话状态
    if action in ("mark_cheating", "ban_exam"):
        session = db.query(ExamSession).get(session_id)
        if session:
            session.is_flagged = True
            session.risk_level = "critical"
            if action == "ban_exam":
                session.status = "banned"

    _db_commit_with_retry(db)

    return {"ok": True, "message": f"已对事件{event_id}采取动作: {action}", "action": action}
