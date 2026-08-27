from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


# ---------------------------------------------------------------------------
# Severity levels
# ---------------------------------------------------------------------------

class Severity(str, Enum):
    CRITICAL = "critical"       # Mandatory field completely absent
    WARNING = "warning"         # Field present but incorrect format / value
    INFO = "info"               # Observation / best-practice suggestion


# ---------------------------------------------------------------------------
# Extracted label fields
# ---------------------------------------------------------------------------

class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class ExtractedField(BaseModel):
    field_name: str
    value: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    bounding_box: Optional[BoundingBox] = None
    found: bool = False


class LabelExtraction(BaseModel):
    raw_text: str
    product_name: Optional[str] = None
    mrp: Optional[ExtractedField] = None
    net_quantity: Optional[ExtractedField] = None
    manufacturer_name: Optional[ExtractedField] = None
    manufacturer_address: Optional[ExtractedField] = None
    country_of_origin: Optional[ExtractedField] = None
    best_before: Optional[ExtractedField] = None
    batch_lot_number: Optional[ExtractedField] = None
    customer_care: Optional[ExtractedField] = None
    fssai_license: Optional[ExtractedField] = None
    ingredients: Optional[ExtractedField] = None
    nutritional_info: Optional[ExtractedField] = None
    allergen_info: Optional[ExtractedField] = None       # "Contains:" statement
    veg_nonveg_symbol: Optional[ExtractedField] = None   # Green/brown symbol declaration
    language_declaration: Optional[ExtractedField] = None # English/Hindi text presence
    all_fields: List[ExtractedField] = []


# ---------------------------------------------------------------------------
# Compliance violation / finding
# ---------------------------------------------------------------------------

class Violation(BaseModel):
    rule_id: str
    field: str
    severity: Severity
    title: str
    description: str
    regulation_ref: str
    evidence: Optional[str] = None          # Snippet of extracted text
    bounding_box: Optional[BoundingBox] = None


# ---------------------------------------------------------------------------
# Final compliance report
# ---------------------------------------------------------------------------

class ComplianceStatus(str, Enum):
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    NEEDS_REVIEW = "needs_review"


class ComplianceReport(BaseModel):
    report_id: str
    timestamp: str
    image_filename: str
    image_width: int
    image_height: int

    # Extraction results
    extraction: LabelExtraction

    # Compliance results
    overall_status: ComplianceStatus
    compliance_score: float = Field(ge=0.0, le=100.0)
    violations: List[Violation] = []
    passed_checks: List[str] = []

    # Counts
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0

    # Summary text
    summary: str = ""


# ---------------------------------------------------------------------------
# API request / response wrappers
# ---------------------------------------------------------------------------

class AnalyzeResponse(BaseModel):
    success: bool
    report: Optional[ComplianceReport] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Manual override request — sent from the frontend when the user corrects
# fields that OCR missed or got wrong. Keys match LabelExtraction field names.
# ---------------------------------------------------------------------------

class ManualOverrides(BaseModel):
    """
    Map of field_name → corrected value string.
    Only fields the user explicitly filled in should be present.
    Empty string means "user confirmed this field is absent".
    """
    overrides: dict[str, str] = {}
    # Pass back the original extraction so the backend can merge
    original_extraction: LabelExtraction


class RecheckResponse(BaseModel):
    success: bool
    report: Optional[ComplianceReport] = None
    # Which fields were overridden (so the UI can highlight them)
    overridden_fields: list[str] = []
    error: Optional[str] = None
