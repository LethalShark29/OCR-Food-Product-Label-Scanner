"""
Report generation service.

Assembles a ComplianceReport from image metadata + extraction + rule violations.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Tuple

from PIL import Image
import io

from app.models.schemas import (
    ComplianceReport,
    ComplianceStatus,
    LabelExtraction,
    Severity,
    Violation,
)
from app.services.rules_engine import run_compliance_checks

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Score calculation
# ---------------------------------------------------------------------------

_SEVERITY_WEIGHT = {
    Severity.CRITICAL: 20,
    Severity.WARNING: 8,
    Severity.INFO: 2,
}

_MAX_SCORE = 100.0


def _calculate_score(violations: list[Violation]) -> float:
    """
    Deduct points per violation severity.
    Score is clamped to [0, 100].
    """
    deduction = sum(_SEVERITY_WEIGHT.get(v.severity, 0) for v in violations)
    return max(0.0, _MAX_SCORE - deduction)


def _determine_status(score: float, violations: list[Violation]) -> ComplianceStatus:
    has_critical = any(v.severity == Severity.CRITICAL for v in violations)
    if has_critical or score < 50:
        return ComplianceStatus.NON_COMPLIANT
    if score < 75:
        return ComplianceStatus.NEEDS_REVIEW
    return ComplianceStatus.COMPLIANT


def _build_summary(
    status: ComplianceStatus,
    score: float,
    violations: list[Violation],
    passed: list[str],
) -> str:
    total = len(violations) + len(passed)
    critical = sum(1 for v in violations if v.severity == Severity.CRITICAL)
    warnings = sum(1 for v in violations if v.severity == Severity.WARNING)

    status_str = {
        ComplianceStatus.COMPLIANT: "COMPLIANT",
        ComplianceStatus.NON_COMPLIANT: "NON-COMPLIANT",
        ComplianceStatus.NEEDS_REVIEW: "NEEDS REVIEW",
    }[status]

    lines = [
        f"Overall status: {status_str} (score {score:.0f}/100).",
        f"{len(passed)} of {total} checks passed.",
    ]
    if critical:
        lines.append(
            f"{critical} critical violation{'s' if critical > 1 else ''} found — "
            "mandatory fields are missing or invalid."
        )
    if warnings:
        lines.append(
            f"{warnings} warning{'s' if warnings > 1 else ''} — "
            "fields present but require correction."
        )
    if not violations:
        lines.append("No violations detected. Label appears fully compliant.")
    return " ".join(lines)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_report(
    image_bytes: bytes,
    filename: str,
    extraction: LabelExtraction,
) -> ComplianceReport:
    """
    Run compliance checks and assemble the final ComplianceReport.
    """
    # Image dimensions
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        img_width, img_height = pil_img.size
    except Exception:
        img_width, img_height = 0, 0

    violations, passed_checks = run_compliance_checks(extraction)

    score = _calculate_score(violations)
    status = _determine_status(score, violations)
    summary = _build_summary(status, score, violations, passed_checks)

    critical_count = sum(1 for v in violations if v.severity == Severity.CRITICAL)
    warning_count = sum(1 for v in violations if v.severity == Severity.WARNING)
    info_count = sum(1 for v in violations if v.severity == Severity.INFO)

    return ComplianceReport(
        report_id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        image_filename=filename,
        image_width=img_width,
        image_height=img_height,
        extraction=extraction,
        overall_status=status,
        compliance_score=round(score, 1),
        violations=violations,
        passed_checks=passed_checks,
        critical_count=critical_count,
        warning_count=warning_count,
        info_count=info_count,
        summary=summary,
    )


def generate_report_from_extraction(
    filename: str,
    extraction: LabelExtraction,
    image_width: int = 0,
    image_height: int = 0,
) -> ComplianceReport:
    """
    Run compliance checks and assemble a ComplianceReport directly from a
    (possibly manually-overridden) LabelExtraction, without image bytes.
    Used by the /api/recheck endpoint.
    """
    violations, passed_checks = run_compliance_checks(extraction)

    score = _calculate_score(violations)
    status = _determine_status(score, violations)
    summary = _build_summary(status, score, violations, passed_checks)

    critical_count = sum(1 for v in violations if v.severity == Severity.CRITICAL)
    warning_count  = sum(1 for v in violations if v.severity == Severity.WARNING)
    info_count     = sum(1 for v in violations if v.severity == Severity.INFO)

    return ComplianceReport(
        report_id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        image_filename=filename,
        image_width=image_width,
        image_height=image_height,
        extraction=extraction,
        overall_status=status,
        compliance_score=round(score, 1),
        violations=violations,
        passed_checks=passed_checks,
        critical_count=critical_count,
        warning_count=warning_count,
        info_count=info_count,
        summary=summary,
    )
