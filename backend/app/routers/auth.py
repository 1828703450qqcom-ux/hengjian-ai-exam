from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..deps import create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginReq(BaseModel):
    username: str
    password: str


class RegisterReq(BaseModel):
    username: str
    password: str
    name: str
    role: str = "student"
    student_no: str = ""
    college: str = ""
    major: str = ""
    grade: str = ""


@router.post("/login")
def login(req: LoginReq, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not user.check_password(req.password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="账号已被禁用")
    return {"token": create_token(user), "user": user.to_dict(with_face=True)}


@router.post("/register")
def register(req: RegisterReq, db: Session = Depends(get_db)):
    if req.role != "student":
        raise HTTPException(status_code=403, detail="公开注册仅允许创建学生账号")
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    u = User(username=req.username, name=req.name, role=req.role, student_no=req.student_no,
             college=req.college, major=req.major, grade=req.grade)
    u.set_password(req.password)
    db.add(u)
    db.commit()
    return {"token": create_token(u), "user": u.to_dict()}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user.to_dict(with_face=True)


@router.post("/register-face")
def register_face(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """考前身份核验：登记人脸特征向量入库（多模态身份底库）"""
    desc = payload.get("descriptor")
    if not desc:
        raise HTTPException(status_code=400, detail="缺少人脸特征")
    u = db.query(User).get(user.id)
    u.face_descriptor = desc
    u.face_photo_url = payload.get("photo_url", u.face_photo_url)
    db.commit()
    return {"ok": True, "message": "人脸特征登记成功"}


@router.get("/face-reference")
def face_reference(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取当前用户已登记的人脸特征向量（考试时用于身份比对）"""
    u = db.query(User).get(user.id)
    if not u.face_descriptor:
        return {"registered": False, "descriptor": None, "message": "尚未登记人脸特征"}
    return {"registered": True, "descriptor": u.face_descriptor, "photo_url": u.face_photo_url}
