"""Create or update the initial administrator using ADMIN_USERNAME/ADMIN_PASSWORD."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, init_db
from app.models import User


def main():
    username = os.getenv("ADMIN_USERNAME", "").strip()
    password = os.getenv("ADMIN_PASSWORD", "")
    name = os.getenv("ADMIN_NAME", "系统管理员").strip() or "系统管理员"
    if not username:
        raise SystemExit("ADMIN_USERNAME is required")
    if len(password) < 12:
        raise SystemExit("ADMIN_PASSWORD must be at least 12 characters")

    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            user = User(username=username, name=name, role="admin", college="信息中心")
            db.add(user)
        user.name = name
        user.role = "admin"
        user.status = "active"
        user.set_password(password)
        db.commit()
        print(f"Administrator '{username}' is ready.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
