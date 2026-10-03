# 智衡云枢系统 - 后端配置
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 数据库（默认 SQLite，可切换 PostgreSQL/MySQL 实现弹性中台扩展）
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'exam.db')}")

# JWT 密钥（生产环境必须通过环境变量注入，且长度至少 32 位）
APP_ENV = os.getenv("APP_ENV", "development").lower()
_secret_key = os.getenv("SECRET_KEY", "")
if APP_ENV == "production" and len(_secret_key) < 32:
    raise RuntimeError("生产环境必须设置至少 32 个字符的 SECRET_KEY")
SECRET_KEY = _secret_key or "dev-only-insecure-secret-key-change-before-deployment"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12

# 系统指标硬指标（与产品指标对齐）
KPI = {
    "liveness_accuracy": 0.99,        # 活体识别 ≥99%
    "cheat_detection": 0.95,          # 作弊识别 ≥95%
    "false_positive": 0.03,           # 误报 ≤3%
    "alert_latency_ms": 2000,         # 预警响应 ≤2s
    "objective_accuracy": 1.00,       # 客观题批改 100%
    "subjective_agreement": 0.90,     # 主观题与教师判分一致性 ≥90%
    "oral_accuracy": 0.92,            # 口语测评 ≥92%
    "capability_dims": 50,            # ≥50 维能力画像
    "capability_match": 0.88,         # 能力匹配度 ≥88%
    "concurrency": 10000,             # 支持 1 万并发
    "response_ms": 500,               # 响应 ≤500ms
    "availability": 0.999,            # 系统可用率 99.9%
    "api_adapter_days": 7,            # API 适配周期 ≤7 天
    "new_scene_days": 3,              # 新场景接入 ≤3 天
}

# 上传目录
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
