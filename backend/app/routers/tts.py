"""语音合成 API
支持英语/中文文本转语音，用于听力题型音频合成
支持男声/女声、快速/正常/慢速、多段落对话形式
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
import json
from ..database import get_db
from .auth import get_current_user

router = APIRouter(prefix="/api/tts", tags=["语音合成"])

# 音频存储目录
AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

# 支持的音色
VOICES = {
    "en_us_male": {"label": "英语男声", "lang": "en-US", "gender": "male"},
    "en_us_female": {"label": "英语女声", "lang": "en-US", "gender": "female"},
    "zh_cn_male": {"label": "中文男声", "lang": "zh-CN", "gender": "male"},
    "zh_cn_female": {"label": "中文女声", "lang": "zh-CN", "gender": "female"},
}

# 支持的语速
SPEEDS = {
    "fast": {"label": "快速", "rate": 1.3},
    "normal": {"label": "正常", "rate": 1.0},
    "slow": {"label": "慢速", "rate": 0.7},
}


class TTSRequest(BaseModel):
    text: str  # 待合成文本
    voice: str = "en_us_female"  # 音色
    speed: str = "normal"  # 语速
    paragraphs: Optional[List[dict]] = None  # 多段落对话形式，每段包含text和voice


class TTSBatchRequest(BaseModel):
    items: List[dict]  # 批量合成，每项包含text、voice、speed


@router.get("/voices")
def list_voices():
    """获取支持的音色列表"""
    return {
        "voices": [{"key": k, **v} for k, v in VOICES.items()],
        "speeds": [{"key": k, **v} for k, v in SPEEDS.items()],
    }


@router.post("/synthesize")
def synthesize_speech(
    req: TTSRequest,
    current_user=Depends(get_current_user),
):
    """语音合成（单段文本）"""
    if not req.text.strip():
        raise HTTPException(400, "合成文本不能为空")

    if req.voice not in VOICES:
        raise HTTPException(400, f"不支持的音色，支持：{', '.join(VOICES.keys())}")

    if req.speed not in SPEEDS:
        raise HTTPException(400, f"不支持的语速，支持：{', '.join(SPEEDS.keys())}")

    # 生成唯一文件名
    audio_id = str(uuid.uuid4())
    audio_filename = f"{audio_id}.mp3"
    audio_path = os.path.join(AUDIO_DIR, audio_filename)

    # 使用系统TTS引擎合成（优先使用edge-tts或pyttsx3）
    audio_url = None
    try:
        # 尝试使用edge-tts（高质量在线合成）
        import asyncio
        import edge_tts

        voice_map = {
            "en_us_male": "en-US-GuyNeural",
            "en_us_female": "en-US-JennyNeural",
            "zh_cn_male": "zh-CN-YunxiNeural",
            "zh_cn_female": "zh-CN-XiaoxiaoNeural",
        }
        edge_voice = voice_map.get(req.voice, "en-US-JennyNeural")
        rate = SPEEDS[req.speed]["rate"]
        rate_str = f"+{int((rate-1)*100)}%" if rate >= 1 else f"{int((rate-1)*100)}%"

        async def synth():
            communicate = edge_tts.Communicate(req.text, edge_voice, rate=rate_str)
            await communicate.save(audio_path)

        asyncio.run(synth())
        audio_url = f"/static/audio/{audio_filename}"
        engine_used = "edge-tts"
    except ImportError:
        try:
            # 回退到pyttsx3（离线合成）
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty('rate', int(200 * SPEEDS[req.speed]["rate"]))
            engine.save_to_file(req.text, audio_path)
            engine.runAndWait()
            audio_url = f"/static/audio/{audio_filename}"
            engine_used = "pyttsx3"
        except ImportError:
            # 都不可用时，生成描述性JSON（前端可使用浏览器Web Speech API）
            audio_url = None
            engine_used = "browser-web-speech-api"

    return {
        "audio_id": audio_id,
        "audio_url": audio_url,
        "text": req.text,
        "voice": req.voice,
        "voice_label": VOICES[req.voice]["label"],
        "speed": req.speed,
        "speed_label": SPEEDS[req.speed]["label"],
        "engine": engine_used,
        "duration_estimate": len(req.text) * 0.1,  # 估算时长（秒）
        "message": "语音合成成功" if audio_url else "TTS引擎未安装，前端将使用浏览器Web Speech API合成",
    }


@router.post("/synthesize-dialog")
def synthesize_dialog(
    req: TTSRequest,
    current_user=Depends(get_current_user),
):
    """多段落对话形式语音合成（自动分段，每段可指定角色）"""
    if not req.paragraphs and not req.text:
        raise HTTPException(400, "合成文本或段落不能为空")

    paragraphs = req.paragraphs
    if not paragraphs:
        # 按换行符自动分段
        lines = [l.strip() for l in req.text.split('\n') if l.strip()]
        paragraphs = [{"text": line, "voice": req.voice} for line in lines]

    results = []
    for i, para in enumerate(paragraphs):
        text = para.get("text", "")
        voice = para.get("voice", req.voice)
        if not text.strip():
            continue

        audio_id = str(uuid.uuid4())
        audio_filename = f"{audio_id}.mp3"
        audio_path = os.path.join(AUDIO_DIR, audio_filename)

        try:
            import asyncio
            import edge_tts
            voice_map = {
                "en_us_male": "en-US-GuyNeural",
                "en_us_female": "en-US-JennyNeural",
                "zh_cn_male": "zh-CN-YunxiNeural",
                "zh_cn_female": "zh-CN-XiaoxiaoNeural",
            }
            edge_voice = voice_map.get(voice, "en-US-JennyNeural")
            rate = SPEEDS[req.speed]["rate"]
            rate_str = f"+{int((rate-1)*100)}%" if rate >= 1 else f"{int((rate-1)*100)}%"

            async def synth(t, v, r, p):
                communicate = edge_tts.Communicate(t, v, rate=r)
                await communicate.save(p)

            asyncio.run(synth(text, edge_voice, rate_str, audio_path))
            audio_url = f"/static/audio/{audio_filename}"
        except (ImportError, Exception):
            audio_url = None

        results.append({
            "paragraph_index": i,
            "text": text,
            "voice": voice,
            "voice_label": VOICES.get(voice, {}).get("label", voice),
            "audio_url": audio_url,
        })

    return {
        "total_paragraphs": len(results),
        "paragraphs": results,
        "message": f"成功合成{len(results)}段对话音频",
    }


@router.post("/batch-synthesize")
def batch_synthesize(
    req: TTSBatchRequest,
    current_user=Depends(get_current_user),
):
    """批量语音合成（用于整套听力试卷）"""
    results = []
    for item in req.items:
        text = item.get("text", "")
        voice = item.get("voice", "en_us_female")
        speed = item.get("speed", "normal")
        if not text.strip():
            continue

        audio_id = str(uuid.uuid4())
        audio_filename = f"{audio_id}.mp3"
        audio_path = os.path.join(AUDIO_DIR, audio_filename)

        try:
            import asyncio
            import edge_tts
            voice_map = {
                "en_us_male": "en-US-GuyNeural",
                "en_us_female": "en-US-JennyNeural",
                "zh_cn_male": "zh-CN-YunxiNeural",
                "zh_cn_female": "zh-CN-XiaoxiaoNeural",
            }
            edge_voice = voice_map.get(voice, "en-US-JennyNeural")
            rate = SPEEDS.get(speed, SPEEDS["normal"])["rate"]
            rate_str = f"+{int((rate-1)*100)}%" if rate >= 1 else f"{int((rate-1)*100)}%"

            async def synth(t, v, r, p):
                communicate = edge_tts.Communicate(t, v, rate=r)
                await communicate.save(p)

            asyncio.run(synth(text, edge_voice, rate_str, audio_path))
            audio_url = f"/static/audio/{audio_filename}"
        except (ImportError, Exception):
            audio_url = None

        results.append({
            "text": text[:50] + "..." if len(text) > 50 else text,
            "voice": voice,
            "audio_url": audio_url,
        })

    return {
        "total": len(results),
        "results": results,
        "message": f"批量合成完成，共{len(results)}条",
    }


@router.get("/history")
def get_tts_history(
    current_user=Depends(get_current_user),
):
    """获取语音合成历史记录"""
    # 列出音频目录中的文件
    audio_files = []
    if os.path.exists(AUDIO_DIR):
        for f in sorted(os.listdir(AUDIO_DIR), reverse=True)[:50]:
            if f.endswith('.mp3'):
                filepath = os.path.join(AUDIO_DIR, f)
                size = os.path.getsize(filepath)
                audio_files.append({
                    "filename": f,
                    "audio_id": f.replace('.mp3', ''),
                    "url": f"/static/audio/{f}",
                    "size_kb": round(size / 1024, 1),
                    "created_at": os.path.getctime(filepath),
                })

    return {
        "history": audio_files,
        "total": len(audio_files),
    }
