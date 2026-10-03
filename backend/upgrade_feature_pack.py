"""升级题库数据源与能力画像证据库，可重复安全执行。"""
from app.database import init_db, SessionLocal
from app.models import CapabilitySnapshot, QuestionSource
from app.routers.capability import ensure_snapshot_evidence
from app.services.web_search_service import DATA_SOURCES


def run():
    init_db()
    db = SessionLocal()
    try:
        for key, cfg in DATA_SOURCES.items():
            row = db.query(QuestionSource).filter_by(key=key).first()
            if not row:
                db.add(QuestionSource(
                    key=key, name=cfg["name"], category=cfg.get("category", "综合题库"),
                    base_url=cfg.get("site", ""), description=cfg["desc"],
                    config={"accent": cfg.get("accent", "#2563eb")},
                ))
        db.commit()
        for snapshot in db.query(CapabilitySnapshot).all():
            ensure_snapshot_evidence(db, snapshot)
        print({
            "question_sources": db.query(QuestionSource).count(),
            "capability_snapshots": db.query(CapabilitySnapshot).count(),
        })
    finally:
        db.close()


if __name__ == "__main__":
    run()
