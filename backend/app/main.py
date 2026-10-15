"""PAOwerUp Careers API (FastAPI)."""
from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from app import config  # noqa: F401  (env setup before TF import)

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.api import coach, health, interview, match, presence  # noqa: E402
from app.ml import matcher  # noqa: E402
from app.ml.whisper_service import whisper_service  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger("paowerup")


def _warm_models() -> None:
    """Load USE (and optionally Whisper base) in the background at startup."""
    try:
        matcher.get_encoder(config.DEFAULT_USE_MODEL).load()
        matcher.match("Built SQL dashboards in Tableau for 3 teams.", "Data analyst with SQL and Tableau experience.")
    except Exception:
        log.exception("USE warm-up failed")
    if config.PRELOAD_WHISPER and whisper_service.status != "error":
        try:
            whisper_service.load(config.WHISPER_DEFAULT_SIZE)
        except Exception:
            log.exception("Whisper preload failed")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    threading.Thread(target=_warm_models, name="model-warmup", daemon=True).start()
    yield


app = FastAPI(title="PAOwerUp Careers API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

for module in (health, match, coach, interview):
    app.include_router(module.router, prefix="/api")
app.include_router(presence.router)
