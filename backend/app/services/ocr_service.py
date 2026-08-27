"""
OCR + field extraction service — powered by EasyOCR (no system binary needed).

Pipeline:
  1. Pre-process image (denoise, upscale, sharpen)
  2. Run EasyOCR → list of (bbox, text, confidence) tuples
  3. Reconstruct full text from results
  4. Apply regex patterns to extract mandatory label fields
  5. Return LabelExtraction with per-field confidence & bounding boxes
"""

import re
import io
import logging
from typing import Optional, Tuple

import cv2
import numpy as np
import easyocr
from PIL import Image

from app.models.schemas import (
    BoundingBox,
    ExtractedField,
    LabelExtraction,
)

logger = logging.getLogger(__name__)

# ── EasyOCR reader — initialised once at module load ─────────────────────────
# gpu=False ensures it runs on CPU without CUDA; set True if you have a GPU.
_reader: Optional[easyocr.Reader] = None


def _get_reader() -> easyocr.Reader:
    global _reader
    if _reader is None:
        logger.info("Initialising EasyOCR reader (first call downloads ~100 MB model)…")
        _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        logger.info("EasyOCR reader ready.")
    return _reader


# ── Image pre-processing ──────────────────────────────────────────────────────

def _preprocess(image_bytes: bytes) -> np.ndarray:
    """
    Decode → upscale small images → denoise → return as BGR numpy array.
    EasyOCR works best on colour images, so we skip binarisation.
    """
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        # Fallback via Pillow (handles WebP / TIFF / BMP)
        pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)

    h, w = img.shape[:2]

    # Upscale if image is too small — EasyOCR reads small text poorly
    if max(h, w) < 1200:
        scale = 1200 / max(h, w)
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Mild denoising on the colour image
    img = cv2.fastNlMeansDenoisingColored(img, None, 6, 6, 7, 21)

    return img


# ── EasyOCR result type: list of ([tl, tr, br, bl], text, conf) ──────────────

EasyResult = list[tuple[list, str, float]]


def _to_bbox(quad: list) -> BoundingBox:
    """Convert EasyOCR quadrilateral [[x,y]×4] to axis-aligned BoundingBox."""
    xs = [pt[0] for pt in quad]
    ys = [pt[1] for pt in quad]
    x, y = int(min(xs)), int(min(ys))
    w = int(max(xs)) - x
    h = int(max(ys)) - y
    return BoundingBox(x=x, y=y, width=w, height=h)


def _reconstruct_text(results: EasyResult) -> str:
    """
    Re-assemble full label text from EasyOCR word results.
    Sorts top-to-bottom, groups words on the same line.
    """
    if not results:
        return ""

    # Sort by vertical centre of each word
    sorted_results = sorted(results, key=lambda r: (r[0][0][1] + r[0][2][1]) / 2)

    lines: list[list[str]] = []
    current_line: list[str] = []
    prev_y: float = -1
    line_height_threshold = 20  # pixels — words within this y-range are on the same line

    for quad, text, _conf in sorted_results:
        cy = (quad[0][1] + quad[2][1]) / 2
        if prev_y < 0 or abs(cy - prev_y) < line_height_threshold:
            current_line.append(text)
        else:
            if current_line:
                lines.append(current_line)
            current_line = [text]
        prev_y = cy

    if current_line:
        lines.append(current_line)

    return "\n".join(" ".join(line) for line in lines)


# ── Bounding box lookup ───────────────────────────────────────────────────────

def _bbox_for_value(results: EasyResult, value: str) -> Optional[BoundingBox]:
    """
    Find the bounding box of the first result whose text overlaps with `value`.
    """
    value_lower = value.lower().strip()[:30]
    for quad, text, _conf in results:
        if value_lower in text.lower() or text.lower() in value_lower:
            return _to_bbox(quad)
    return None


# ── Regex patterns for mandatory label fields ─────────────────────────────────

_PATTERNS: dict[str, list[str]] = {
    "mrp": [
        r"(?:MRP|M\.R\.P\.?|Max\.?\s*Retail\s*Price)[^\d₹Rs]*[₹Rs\.]*\s*(\d+(?:[.,]\d+)?)",
        r"(?:₹|Rs\.?)\s*(\d+(?:[.,]\d+)?)\s*(?:\/\-|/-)?",
    ],
    "net_quantity": [
        r"(?:Net\s*(?:Wt\.?|Weight|Qty|Quantity|Contents?)[:\s]*)([\d.,]+\s*(?:g|gm|gms|kg|ml|l|ltr|litre|pcs|pieces|tabs|nos))",
        r"([\d.,]+\s*(?:g|gm|gms|kg|ml|l|ltr|litre))\b",
    ],
    "manufacturer_name": [
        r"(?:Manufactured\s+by|Mfg\.?\s*by|Manufacturer)[:\s]+([A-Z][^\n,;]{3,60}(?:Ltd\.?|Pvt\.?|Inc\.?|LLP|Co\.?|Corp\.?)?[^\n,;]{0,30})",
        r"(?:Marketed\s+by|Mktd\.?\s*by)[:\s]+([A-Z][^\n,;]{3,60})",
    ],
    "manufacturer_address": [
        r"(?:Manufactured\s+by|Mfg\.?\s*by|Manufacturer)[:\s]+[^\n]{0,80}\n([^\n]{10,120}(?:India|Bharat)?)",
        r"(?:Address|Addr\.?|Regd\.?\s*Office)[:\s]+([^\n]{10,150})",
    ],
    "country_of_origin": [
        r"(?:Country\s+of\s+Origin|Origin)[:\s]+([A-Za-z]{3,30})",
        r"(?:Made\s+in|Product\s+of)\s+([A-Za-z]{3,30})",
    ],
    "best_before": [
        r"(?:Best\s+Before|BB|Use\s+Before|Expiry|Exp\.?)[:\s]+([^\n]{3,30})",
        r"(?:Mfg\.?\s*Date|Date\s+of\s+Mfg|DOM)[:\s]+([^\n]{3,20})",
    ],
    "batch_lot_number": [
        r"(?:Batch\s*(?:No\.?|#)|Lot\s*(?:No\.?|#)|B\.No\.?)[:\s]*([A-Z0-9\-/]{2,20})",
    ],
    "customer_care": [
        r"(?:Consumer\s+Care|Customer\s+(?:Care|Service|Helpline)|Toll[\s-]Free)[:\s]*([+0-9\-\s]{7,20}|[^\n]{5,60})",
    ],
    "fssai_license": [
        r"(?:FSSAI[:\s]+Lic(?:ense|ence)?\.?\s*No\.?|FSSAI\s*#|Lic\.?\s*No\.?)[:\s]*(\d[\d\s]{10,18}\d)",
        r"\bFSSAI\b[^\n]*?(\d{14})",
    ],
    "ingredients": [
        r"(?:Ingredients?|INGREDIENTS?)[:\s]+([^\n]{10,500})",
    ],
    "nutritional_info": [
        r"(?:Nutritional\s+(?:Information|Facts|Value)|Nutrition\s+(?:Facts|Info))[:\s\n]+([^\n]{5,}(?:\n[^\n]{5,}){0,10})",
    ],
    "allergen_info": [
        r"(?:Contains?|Allergen\s+(?:Info|Information|Declaration))[:\s]+([^\n]{5,200})",
        r"(?:May\s+contain|Free\s+from)[:\s]+([^\n]{5,150})",
    ],
    "veg_nonveg_symbol": [
        r"((?:100\s*%\s*)?(?:Pure\s+)?(?:Veg(?:etarian)?|Non[\s\-]*Veg(?:etarian)?)(?:\s+(?:Product|Food|Symbol))?)",
        r"((?:Green|Brown|Red)\s+(?:dot|circle|square|symbol|mark))",
    ],
    "language_declaration": [
        r"((?:सामग्री|निर्माता|मूल्य|शुद्ध मात्रा|सर्वोत्तम|अवयव)[^\n]{0,100})",
        r"((?:MRP|मूल्य|निर्मित|वजन)[^\n]{0,60})",
    ],
}


def _extract_field(
    name: str,
    raw_text: str,
    results: EasyResult,
) -> ExtractedField:
    for pattern in _PATTERNS.get(name, []):
        match = re.search(pattern, raw_text, re.IGNORECASE | re.MULTILINE)
        if match:
            value = match.group(1).strip()
            bbox = _bbox_for_value(results, value[:30])
            return ExtractedField(
                field_name=name,
                value=value,
                confidence=0.85,
                bounding_box=bbox,
                found=True,
            )
    return ExtractedField(
        field_name=name,
        value=None,
        confidence=0.0,
        bounding_box=None,
        found=False,
    )


def _extract_product_name(raw_text: str) -> Optional[str]:
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    if not lines:
        return None
    for line in lines[:5]:
        if line.isupper() and len(line) > 3:
            return line
    return lines[0]


# ── Public API ────────────────────────────────────────────────────────────────

def extract_label(image_bytes: bytes) -> LabelExtraction:
    """
    Main entry point. Returns a populated LabelExtraction from raw image bytes.
    No system binary required — EasyOCR is a pure Python/PyTorch package.
    """
    reader = _get_reader()

    img = _preprocess(image_bytes)

    # EasyOCR returns: list of ([tl,tr,br,bl], text, confidence)
    results: EasyResult = reader.readtext(img, detail=1, paragraph=False)

    raw_text = _reconstruct_text(results)
    logger.debug("OCR raw text (%d chars):\n%s", len(raw_text), raw_text[:500])

    field_names = [
        "mrp", "net_quantity", "manufacturer_name", "manufacturer_address",
        "country_of_origin", "best_before", "batch_lot_number",
        "customer_care", "fssai_license", "ingredients", "nutritional_info",
        "allergen_info", "veg_nonveg_symbol", "language_declaration",
    ]

    extracted_fields = {
        name: _extract_field(name, raw_text, results)
        for name in field_names
    }

    return LabelExtraction(
        raw_text=raw_text,
        product_name=_extract_product_name(raw_text),
        mrp=extracted_fields["mrp"],
        net_quantity=extracted_fields["net_quantity"],
        manufacturer_name=extracted_fields["manufacturer_name"],
        manufacturer_address=extracted_fields["manufacturer_address"],
        country_of_origin=extracted_fields["country_of_origin"],
        best_before=extracted_fields["best_before"],
        batch_lot_number=extracted_fields["batch_lot_number"],
        customer_care=extracted_fields["customer_care"],
        fssai_license=extracted_fields["fssai_license"],
        ingredients=extracted_fields["ingredients"],
        nutritional_info=extracted_fields["nutritional_info"],
        allergen_info=extracted_fields["allergen_info"],
        veg_nonveg_symbol=extracted_fields["veg_nonveg_symbol"],
        language_declaration=extracted_fields["language_declaration"],
        all_fields=list(extracted_fields.values()),
    )
