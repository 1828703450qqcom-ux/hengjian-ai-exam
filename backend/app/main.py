"""智衡云枢系统 - 高校考试能力测评平台（后端入口）
会看（多模态监考）、会听（口语测评）、会评（AI 评阅）、能画像（知识图谱能力画像）
"""
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .database import init_db, SessionLocal
from .routers import auth, questions, papers, exams, grading, proctor, capability, dashboard, system, scan, print, tags, exam_enhanced, tts, assessment_report
from .services.knowledge_service import ensure_dimensions


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    ensure_dimensions(db)
    db.close()
    yield


app = FastAPI(
    title="衡鉴智考 API",
    version="1.0.0",
    description="高校考试能力测评平台：多模态监考 / AI 评阅 / 知识图谱能力画像 / 弹性中台",
    lifespan=lifespan,
)

# 弹性中台：跨域 + 压缩 + 请求计时（响应≤500ms 硬指标监控）
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = (time.perf_counter() - start) * 1000
    response.headers["X-Response-Time-Ms"] = f"{elapsed:.1f}"
    return response


@app.get("/")
def root():
    return {"service": "hengjian-ai-exam", "status": "running", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": time.time()}


for r in (auth, questions, papers, exams, grading, proctor, capability, dashboard, system, scan, print, tags, exam_enhanced, tts, assessment_report):
    app.include_router(r.router)
