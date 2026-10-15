from fastapi import APIRouter

from app import config
from app.ml.matcher import get_encoder
from app.ml.whisper_service import whisper_service
from app.schemas import HealthResponse, ModelStatus
from app.services import gemini

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    import tensorflow as tf

    enc = get_encoder(config.DEFAULT_USE_MODEL)
    g_status, g_detail = gemini.status()
    return HealthResponse(
        use=ModelStatus(status=enc.status, detail=enc.detail),
        whisper=ModelStatus(status=whisper_service.status, detail=whisper_service.detail),
        gemini=ModelStatus(status=g_status, detail=g_detail),
        gemini_model=config.GEMINI_MODEL,
        tensorflow_version=tf.__version__,
    )
