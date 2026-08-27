"""
FastAPI application entry point.
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import router

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "AI-powered compliance copilot for packaged product label inspection. "
        "Upload a photo → get OCR extraction + rule-based compliance report."
    ),
)

# ── CORS (allow Next.js dev server on :3000 and production origin) ────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # Vercel production and preview deployments
        "https://ocr-food-product-label-scanner.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def on_startup():
    # Warm up EasyOCR in the background so the first request isn't slow.
    # The reader is a module-level singleton in ocr_service.py.
    import threading
    from app.services.ocr_service import _get_reader
    threading.Thread(target=_get_reader, daemon=True).start()
    logging.getLogger(__name__).info(
        "EasyOCR warm-up started (model weights download on first run ~100 MB)."
    )
