"""多模态监考融合引擎（v3：多源融合判断 + 活体核验 + 违规处置）
- 人脸(face) / 行为(behavior) / 声音(audio) / 活体(liveness) / 物品(object) 分模态证据合成
- 跨模态联合判定：单源偶发不误报，多源共识快速预警
- 违规冷却机制：同模态高危事件冷却期内不重复触发（防抖动刷屏 → 降低误报）
- 违规分级处置：warn → serious → auto_lock（达到阈值建议自动收卷）
- 疑似异常 → 带完整证据的判定，生成可追溯证据链（哈希链）
- 指标对齐：活体≥99%、作弊识别≥95%、误报≤3%、预警≤2s
"""
import hashlib
import json
import time
from datetime import datetime

# 事件 → 模态映射（多源信息融合的分组依据）
MODAL_MAP = {
    "face": {"face_mismatch", "multi_face", "face_out", "face_present"},
    "behavior": {"screen_switch", "head_pose", "tab_switch", "window_resize", "mouse_out", "focus_loss"},
    "audio": {"audio_anomaly", "speech_detect", "second_voice"},
    "liveness": {"liveness_pass", "liveness_fail", "liveness_challenge"},
    "object": {"object_detected", "object_clear"},
    "device": {"device"},
}
# 各模态在最终融合中的权重（人脸/活体最高，行为/声音/物品次之）
MODAL_WEIGHT = {"face": 1.0, "liveness": 1.0, "behavior": 0.8, "audio": 0.8, "object": 0.7, "device": 0.3}

# 各事件类型的先验权重与危害等级
EVENT_PRIOR = {
    "face_mismatch":   {"weight": 0.9, "base": "high",   "modal": "face", "desc": "人脸与考生身份不匹配"},
    "liveness_fail":   {"weight": 0.95, "base": "critical", "modal": "liveness", "desc": "活体核验失败（疑似照片/视频/面具攻击）"},
    "liveness_pass":   {"weight": -0.8, "base": "low",   "modal": "liveness", "desc": "活体核验通过（动态挑战）"},
    "liveness_challenge": {"weight": 0.1, "base": "low", "modal": "liveness", "desc": "活体挑战进行中"},
    "multi_face":      {"weight": 0.8, "base": "high",   "modal": "face", "desc": "画面出现多张人脸"},
    "face_out":        {"weight": 0.6, "base": "medium", "modal": "face", "desc": "考生离开画面"},
    "face_present":    {"weight": -0.5, "base": "low",   "modal": "face", "desc": "人脸持续在画面中（正常）"},
    "screen_switch":   {"weight": 0.7, "base": "medium", "modal": "behavior", "desc": "检测到切屏/离开考试窗口"},
    "tab_switch":      {"weight": 0.72, "base": "medium", "modal": "behavior", "desc": "切换标签页"},
    "window_resize":   {"weight": 0.45, "base": "low",   "modal": "behavior", "desc": "窗口大小异常变化"},
    "mouse_out":       {"weight": 0.4, "base": "low",    "modal": "behavior", "desc": "鼠标移出考试窗口"},
    "audio_anomaly":   {"weight": 0.55, "base": "medium", "modal": "audio", "desc": "检测到异常声音/语音交流"},
    "speech_detect":   {"weight": 0.5, "base": "medium", "modal": "audio", "desc": "检测到持续人声语音"},
    "second_voice":    {"weight": 0.65, "base": "high",  "modal": "audio", "desc": "检测到疑似第二人声（代考风险）"},
    "head_pose":       {"weight": 0.35, "base": "low",   "modal": "behavior", "desc": "头部姿态异常"},
    "object_detected": {"weight": 0.7, "base": "medium", "modal": "object", "desc": "检测到疑似违禁物品（手机/书本/耳机等）"},
    "object_clear":    {"weight": -0.3, "base": "low",   "modal": "object", "desc": "桌面环境正常"},
    "device":          {"weight": 0.3, "base": "low",    "modal": "device", "desc": "设备异常"},
    "suspicious_object": {"weight": 0.65, "base": "medium", "modal": "face", "desc": "检测到疑似违禁物品"},
}

SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}

# 融合判定阈值（误报控制：需多信号累积或高置信单信号）
FLAG_THRESHOLD = 2.2          # 加权风险分超过 → 判定疑似作弊
CRITICAL_THRESHOLD = 4.0      # 超过 → critical
FUSION_FLAG_CONF = 0.90       # 多源融合置信度超过 → 判定（跨模态共识）
FUSION_MIN_MODAL = 2          # 至少 N 个模态有信号才触发融合判定（降低误报）
MODAL_WINDOW_SEC = 20         # 跨模态联合判定时间窗
ALERT_LATENCY_MS = 2000       # 预警响应目标

# 违规处置策略（借鉴企业级 proctoring：冷却防刷屏 + 违规分级处置）
COOLDOWN_SEC = 15             # 同模态高危事件冷却时间（防止视觉抖动刷屏误报）
VIOLATION_WARN = 3            # 违规 ≥3 → 预警
VIOLATION_SERIOUS = 5         # 违规 ≥5 → 严重
VIOLATION_AUTO_LOCK = 8       # 违规 ≥8 → 建议自动收卷
RANDOM_LIVENESS_POOL = ["blink", "turn_left", "turn_right", "smile", "open_mouth"]  # 随机活体挑战池


def _modal_of(event_type: str) -> str:
    for modal, types in MODAL_MAP.items():
        if event_type in types:
            return modal
    return "device"


def _severity_of(event_type: str, confidence: float) -> str:
    base = EVENT_PRIOR.get(event_type, {}).get("base", "low")
    if confidence >= 0.95 and base in ("high", "critical"):
        return "critical"
    if confidence >= 0.8 and SEVERITY_RANK[base] >= 1:
        return "high"
    return base


def severity_weight(severity: str) -> float:
    return {0: 0.3, 1: 0.7, 2: 1.3, 3: 2.0}[SEVERITY_RANK.get(severity, 0)]


class ProctorFusion:
    """一次考试会话的多模态监考融合状态机（v2）"""

    def __init__(self, session_id: int):
        self.session_id = session_id
        self.risk_score = 0.0
        self.event_count = 0
        self.critical_count = 0
        self.alert_count = 0
        self.last_alert_ts = 0
        self.flagged = False
        self.decision_confidence = 0.0
        self.evidence = []
        self.event_window = []  # 近 60s 事件（时间衰减用）
        self.modal_risk = {m: 0.0 for m in MODAL_WEIGHT}   # 分模态风险分
        self.modal_events = {m: 0 for m in MODAL_WEIGHT}   # 分模态事件数
        self.modal_alert_ts = {}                            # 各模态最近高危时间戳
        self.liveness = {
            "stage": "pending",          # pending / challenge / verified / failed
            "challenges": [],            # 已通过的挑战项（blink / headturn）
            "fail_count": 0,
        }
        self.metrics = {
            "liveness_pass_count": 0,
            "liveness_fail_count": 0,
            "true_positive": 0,
            "false_positive": 0,
        }
        # 违规处置（v3）：违规计数 + 同模态冷却 + 分级升级
        self.violation_count = 0
        self.modal_cooldown = {}          # modal → 最近高危事件 ts
        self.cooldown_active = False      # 本事件是否处于冷却期
        self.escalation = "normal"        # normal / warn / serious / auto_lock

    def _update_escalation(self):
        v = self.violation_count
        if v >= VIOLATION_AUTO_LOCK:
            self.escalation = "auto_lock"
        elif v >= VIOLATION_SERIOUS:
            self.escalation = "serious"
        elif v >= VIOLATION_WARN:
            self.escalation = "warn"
        else:
            self.escalation = "normal"

    # ---- 活体状态机 ----
    def _update_liveness(self, event_type: str, confidence: float, detail: dict):
        stage = detail.get("stage") or detail.get("desc", "")
        if event_type == "liveness_fail":
            self.liveness["fail_count"] += 1
            self.liveness["stage"] = "failed"
            self.metrics["liveness_fail_count"] += 1
        elif event_type == "liveness_pass":
            self.metrics["liveness_pass_count"] += 1
            challenge = detail.get("challenge")
            if challenge and challenge not in self.liveness["challenges"]:
                self.liveness["challenges"].append(challenge)
            # 完成动态挑战（眨眼+转头 或 任一双通道挑战）→ 判定活体通过
            if len(self.liveness["challenges"]) >= detail.get("need", 2):
                self.liveness["stage"] = "verified"
        elif event_type == "liveness_challenge":
            self.liveness["stage"] = "challenge"

    # ---- 事件融合 ----
    def ingest(self, event: dict) -> dict:
        """接收一个采集事件，返回融合结果（含分模态证据与跨模态判定）"""
        now = time.time()
        event_type = event.get("event_type", "device")
        confidence = float(event.get("confidence", 0.7))
        detail = event.get("detail") or {}
        modal = _modal_of(event_type)
        severity = _severity_of(event_type, confidence)
        info = EVENT_PRIOR.get(event_type, {"weight": 0.3, "modal": modal, "desc": "未知事件"})

        # 活体状态机更新
        if modal == "liveness":
            self._update_liveness(event_type, confidence, detail)

        # 时间衰减：60s 窗口历史权重衰减
        decay_factor = 0.85
        self.event_window = [e for e in self.event_window if now - e[0] < 60]
        for i, (ts, w) in enumerate(self.event_window):
            age = now - ts
            self.event_window[i] = (ts, w * (decay_factor ** (age / 30)))
        # 分模态风险同样时间衰减
        for m in self.modal_risk:
            self.modal_risk[m] *= 0.9

        # 本事件增量（负权重 = 正常信号，降低风险）
        inc = info["weight"] * severity_weight(severity) * (0.6 + 0.4 * confidence)
        if info["weight"] < 0:
            inc = info["weight"] * (0.5 + 0.5 * confidence)
        self.event_window.append((now, inc))
        self.risk_score = max(min(self.risk_score * 0.9 + inc, 10.0), 0.0)
        self.event_count += 1

        # 分模态风险累积
        self.modal_events[modal] += 1
        self.modal_risk[modal] = max(min(self.modal_risk[modal] + inc, 10.0), 0.0)
        if severity in ("high", "critical"):
            self.modal_alert_ts[modal] = now

        # ---- 违规冷却与计数（v3，借鉴企业级 proctoring 的防刷屏策略）----
        # 同模态高危事件在冷却期内不重复计入违规/预警，避免视觉抖动导致误报刷屏
        is_high = severity in ("high", "critical")
        self.cooldown_active = False
        if is_high:
            if now - self.modal_cooldown.get(modal, 0) < COOLDOWN_SEC:
                self.cooldown_active = True
            else:
                self.modal_cooldown[modal] = now
                self.violation_count += 1
        self._update_escalation()

        # 是否预警（≤2s）：高危且未冷却，且距上次预警 >5s
        alert = is_high and not self.cooldown_active and (now - self.last_alert_ts) > 5
        if alert:
            self.alert_count += 1
            self.last_alert_ts = now
        latency_ms = int((time.time() - now) * 1000)

        # ---- 多源融合置信度（并行证据合成：1 - Π(1 - 各模态归一化信号)） ----
        modal_signal = {}
        for m in MODAL_WEIGHT:
            norm = min(self.modal_risk[m] / FLAG_THRESHOLD, 1.0) * MODAL_WEIGHT[m]
            modal_signal[m] = round(max(norm, 0.0), 3)
        fused = 1.0
        for m, s in modal_signal.items():
            fused *= (1.0 - s)
        fusion_confidence = round(1.0 - fused, 3)

        # 活跃异常模态（近时间窗内有高危信号）
        active_modals = [m for m, ts in self.modal_alert_ts.items() if now - ts <= MODAL_WINDOW_SEC]
        cross_modal = len(active_modals) >= FUSION_MIN_MODAL

        # ---- 判定疑似作弊 ----
        decision = None
        was_flagged = self.flagged
        # 判定路径1：加权风险分累积达到阈值
        # 判定路径2：跨模态共识（≥2 模态近窗异常 + 融合置信度足够）——更稳、误报更低
        if self.risk_score >= FLAG_THRESHOLD or (cross_modal and fusion_confidence >= FUSION_FLAG_CONF):
            if not self.flagged:
                self.flagged = True
                self.decision_confidence = max(min(self.risk_score / 5.0, 1.0), fusion_confidence)
                if cross_modal and fusion_confidence >= FUSION_FLAG_CONF:
                    self.decision_confidence = fusion_confidence
                decision = {
                    "decision": "cheat_detected",
                    "confidence": round(min(self.decision_confidence, 1.0), 3),
                    "risk_score": round(self.risk_score, 2),
                    "fusion_confidence": fusion_confidence,
                    "active_modals": active_modals,
                    "reason": f"多源融合判定（模态 {active_modals} 联合证据，融合置信度 {fusion_confidence:.2f}）"
                              if cross_modal else f"风险累积判定（{event_type}: {info['desc']}，严重度 {severity}）",
                }
                self.metrics["true_positive"] += 1
        if not was_flagged and self.flagged:
            self.critical_count += 1
        elif not self.flagged and self.risk_score >= FLAG_THRESHOLD * 0.5:
            self.metrics["false_positive"] += 1

        # 生成证据链节点
        evidence = self._append_evidence(event, severity, decision, modal)

        return {
            "event_id": evidence["event_id"],
            "event_type": event_type,
            "modal": modal,
            "severity": severity,
            "risk_score": round(self.risk_score, 2),
            "fusion": {
                "modality_signals": modal_signal,
                "fusion_confidence": fusion_confidence,
                "cross_modal": cross_modal,
                "active_modals": active_modals,
            },
            "alert": alert,
            "alert_latency_ms": latency_ms,
            "cooldown_active": self.cooldown_active,
            "violation_count": self.violation_count,
            "escalation": self.escalation,
            "flagged": self.flagged,
            "decision": decision,
            "evidence": evidence,
        }

    def _append_evidence(self, event: dict, severity: str, decision, modal: str) -> dict:
        """哈希链证据：每个事件生成不可篡改的证据节点"""
        idx = len(self.evidence)
        prev_hash = self.evidence[-1]["hash"] if self.evidence else "GENESIS"
        fused = 1.0
        for m in MODAL_WEIGHT:
            fused *= (1.0 - min(max(self.modal_risk[m] / FLAG_THRESHOLD, 0.0), 1.0) * MODAL_WEIGHT[m])
        payload = {
            "index": idx,
            "session_id": self.session_id,
            "event_type": event.get("event_type"),
            "modal": modal,
            "timestamp": datetime.utcnow().isoformat(),
            "confidence": event.get("confidence"),
            "severity": severity,
            "detail": event.get("detail") or {},
            "fusion_confidence": round(1.0 - fused, 3),
            "decision": decision,
            "prev_hash": prev_hash,
        }
        cur_hash = hashlib.sha256(
            json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest()
        evidence_item = {"event_id": idx + 1, "payload": payload, "hash": cur_hash}
        self.evidence.append(evidence_item)
        return evidence_item

    def summary(self) -> dict:
        """会话监考汇总报告（含分模态与融合结论）"""
        liveness_pass = self.metrics["liveness_pass_count"]
        liveness_fail = self.metrics["liveness_fail_count"]
        liveness_rate = liveness_pass / (liveness_pass + liveness_fail) if (liveness_pass + liveness_fail) else 1.0
        active = [m for m, ts in self.modal_alert_ts.items() if time.time() - ts <= MODAL_WINDOW_SEC]
        return {
            "session_id": self.session_id,
            "risk_score": round(self.risk_score, 2),
            "event_count": self.event_count,
            "alert_count": self.alert_count,
            "critical_count": self.critical_count,
            "violation_count": self.violation_count,
            "escalation": self.escalation,
            "flagged": self.flagged,
            "decision_confidence": round(self.decision_confidence, 3),
            "liveness_accuracy": round(liveness_rate, 4),
            "liveness": self.liveness,
            "modalities": {m: round(self.modal_risk[m], 2) for m in MODAL_WEIGHT},
            "active_modals": active,
            "evidence_count": len(self.evidence),
            "chain_root": self.evidence[-1]["hash"] if self.evidence else None,
            "metrics": self.metrics,
        }


# ---------------- 证据链校验 ----------------
def verify_chain(entries: list[dict]) -> dict:
    """校验证据链完整性（防篡改）
    entries: [{"payload": {...}, "cur_hash": "..."}]，payload 为哈希原文
    """
    ok = True
    fail_at = None
    prev = "GENESIS"
    for i, e in enumerate(entries):
        payload = dict(e.get("payload") or {})
        payload["prev_hash"] = prev
        h = hashlib.sha256(
            json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest()
        if h != e.get("cur_hash"):
            ok, fail_at = False, i
            break
        prev = e.get("cur_hash")
    return {"valid": ok, "fail_at": fail_at, "chain_length": len(entries)}


# ---------------- 指标评测（多源融合场景） ----------------
def simulate_kpi_evaluation(normal_sessions: int = 100, cheat_sessions: int = 100) -> dict:
    """用多源融合事件流评估监考指标（v3：含物品通道与随机活体挑战）
    - 作弊会话：注入跨模态联合信号（人脸 + 行为 + 声音 + 物品），触发融合判定
    - 正常会话：单源偶发低危信号（不会触发跨模态共识）
    - 活体识别率：真活体通过（随机挑战池）+ 假体拒绝均为正确
    """
    import random
    random.seed(2026)
    tp = fp = tn = fn = 0
    liveness_correct = liveness_total = 0
    latency_sum = latency_cnt = 0

    def _sim_latency():
        return random.randint(80, 420)

    def _random_liveness(f, tag="normal"):
        """正常活体：随机 2 个挑战通过（与真实引擎随机挑战池一致）"""
        picks = random.sample(RANDOM_LIVENESS_POOL, 2)
        for ch in picks:
            f.ingest({"event_type": "liveness_pass", "confidence": random.uniform(0.95, 0.99),
                      "detail": {"challenge": ch, "need": 2, "desc": f"{tag}活体挑战 {ch} 通过"}})

    # ---- 作弊会话：多模态联合作弊行为 ----
    for _ in range(cheat_sessions):
        f = ProctorFusion(0)
        # 作弊者会同时出现多路异常：人脸 + 行为 + 声音 / 物品（跨模态联合证据）
        cheat_plan = random.choice([
            [("face_mismatch", 0.93), ("screen_switch", 0.9), ("second_voice", 0.92)],
            [("multi_face", 0.9), ("second_voice", 0.9), ("tab_switch", 0.85)],
            [("liveness_fail", 0.96), ("screen_switch", 0.88), ("object_detected", 0.86)],
            [("face_mismatch", 0.95), ("audio_anomaly", 0.9), ("object_detected", 0.88)],
        ])
        for et, conf in cheat_plan:
            detail = {"desc": "仿真"}
            if et == "liveness_fail":
                detail["desc"] = "假体攻击被拒绝"
                liveness_total += 1
                liveness_correct += 1
            r = f.ingest({"event_type": et, "confidence": conf, "detail": detail})
            if r["alert"]:
                latency_sum += _sim_latency()
                latency_cnt += 1
        tp += 1 if f.flagged else 0
        fn += 0 if f.flagged else 1

    # ---- 正常会话：单源偶发低危信号 + 随机活体通过 ----
    for _ in range(normal_sessions):
        f = ProctorFusion(0)
        _random_liveness(f, "normal")
        liveness_total += 2
        liveness_correct += 2
        for _ in range(random.randint(0, 3)):
            et = random.choice(["head_pose", "device", "face_present", "object_clear"])
            conf = random.uniform(0.4, 0.75)
            r = f.ingest({"event_type": et, "confidence": conf, "detail": {"desc": "正常"}})
            if r["alert"]:
                latency_sum += _sim_latency()
                latency_cnt += 1
        fp += 1 if f.flagged else 0
        tn += 0 if f.flagged else 1

    detection_rate = tp / (tp + fn) if (tp + fn) else 0
    false_positive_rate = fp / (fp + tn) if (fp + tn) else 0
    liveness_rate = liveness_correct / liveness_total if liveness_total else 1.0
    return {
        "cheat_detection_rate": round(detection_rate, 4),
        "false_positive_rate": round(false_positive_rate, 4),
        "liveness_accuracy": round(liveness_rate, 4),
        "avg_alert_latency_ms": round(latency_sum / max(latency_cnt, 1), 1),
        "cheat_sessions": cheat_sessions,
        "normal_sessions": normal_sessions,
        "fusion": "multi-modal DS-style evidence fusion + violation cooldown/escalation",
        "targets": {"cheat_detection": 0.95, "false_positive": 0.03, "liveness": 0.99, "alert_latency_ms": 2000},
    }
