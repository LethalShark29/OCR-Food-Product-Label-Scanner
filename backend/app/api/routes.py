"""
FastAPI routes:
  POST /api/analyze  — upload image → full OCR + compliance pipeline
  POST /api/recheck  — merge manual field overrides into existing extraction → re-run rules
  GET  /api/health   — liveness check
"""

import logging
import copy
from fastapi import APIRouter, File, UploadFile, HTTPException, status

from app.core.config import settings
from app.models.schemas import (
    AnalyzeResponse,
    ExtractedField,
    LabelExtraction,
    ManualOverrides,
    RecheckResponse,
)
from app.services.ocr_service import extract_label
from app.services.report_service import generate_report, generate_report_from_extraction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["compliance"])


# ---------------------------------------------------------------------------
# POST /api/analyze — full pipeline
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_label(file: UploadFile = File(...)) -> AnalyzeResponse:
    """Upload a product label image → returns a full compliance report."""

    if file.content_type not in settings.allowed_mime_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. "
                   f"Accepted: {', '.join(settings.allowed_mime_types)}",
        )

    image_bytes = await file.read()
    if len(image_bytes) > settings.max_upload_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.max_upload_size // (1024*1024)} MB.",
        )

    try:
        extraction = extract_label(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception:
        logger.exception("Unexpected error during OCR extraction")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OCR extraction failed. Please try a clearer image.",
        )

    try:
        report = generate_report(
            image_bytes=image_bytes,
            filename=file.filename or "upload.jpg",
            extraction=extraction,
        )
    except Exception:
        logger.exception("Unexpected error during report generation")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Report generation failed.",
        )

    return AnalyzeResponse(success=True, report=report)


# ---------------------------------------------------------------------------
# POST /api/recheck — merge manual overrides, re-run rules, return new report
# ---------------------------------------------------------------------------

@router.post("/recheck", response_model=RecheckResponse)
async def recheck_label(body: ManualOverrides) -> RecheckResponse:
    """
    Accept the original LabelExtraction plus a dict of manually-corrected
    field values. Merge them (manual wins over OCR), re-run the compliance
    rules engine, and return a fresh ComplianceReport — without re-running OCR.
    """
    if not body.overrides:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No overrides provided. Submit at least one corrected field.",
        )

    # Deep-copy so we don't mutate the incoming model
    extraction: LabelExtraction = body.original_extraction.model_copy(deep=True)
    overridden_fields: list[str] = []

    # Fields that map directly onto LabelExtraction attributes
    FIELD_ATTRS = [
        "mrp", "net_quantity", "manufacturer_name", "manufacturer_address",
        "country_of_origin", "best_before", "batch_lot_number", "customer_care",
        "fssai_license", "ingredients", "nutritional_info",
        "allergen_info", "veg_nonveg_symbol", "language_declaration",
    ]

    for field_name, value in body.overrides.items():
        if field_name not in FIELD_ATTRS:
            logger.warning("Unknown override field ignored: %s", field_name)
            continue

        value = value.strip()
        if not value:
            # User left it blank — treat as "confirmed absent"
            setattr(extraction, field_name, ExtractedField(
                field_name=field_name,
                value=None,
                confidence=1.0,  # High confidence: human confirmed absent
                found=False,
            ))
        else:
            # User supplied a value — mark as found with full confidence
            setattr(extraction, field_name, ExtractedField(
                field_name=field_name,
                value=value,
                confidence=1.0,
                found=True,
            ))
            # Also append corrected text to raw_text so regex-based rules
            # (e.g. tax clause check, PIN code check) can match against it
            extraction.raw_text += f"\n[MANUAL] {field_name}: {value}"

        overridden_fields.append(field_name)

    # Rebuild all_fields list to stay consistent
    extraction.all_fields = [
        getattr(extraction, f)
        for f in FIELD_ATTRS
        if getattr(extraction, f) is not None
    ]

    try:
        report = generate_report_from_extraction(
            filename=body.original_extraction.raw_text[:30] or "manual-recheck",
            extraction=extraction,
            image_width=0,
            image_height=0,
        )
    except Exception:
        logger.exception("Error during recheck report generation")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Report generation failed during recheck.",
        )

    return RecheckResponse(
        success=True,
        report=report,
        overridden_fields=overridden_fields,
    )


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------

@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": settings.app_name, "version": settings.app_version}
