"""
Compliance Rules Engine
=======================

Checks a LabelExtraction against mandatory Indian labelling regulations:

  • Legal Metrology (Packaged Commodities) Rules, 2011 — Rule 6
    https://consumeraffairs.nic.in/acts-and-rules
  • Food Safety and Standards (Labelling and Display) Regulations, 2020
    https://www.fssai.gov.in

Each rule returns zero or more Violation objects.
Passed rules contribute to the `passed_checks` list.
"""

import re
import logging
from typing import List, Tuple

from app.models.schemas import (
    BoundingBox,
    ExtractedField,
    LabelExtraction,
    Severity,
    Violation,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

RuleResult = Tuple[List[Violation], List[str]]   # (violations, passed_labels)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _field_ok(field: ExtractedField | None) -> bool:
    return field is not None and field.found and bool(field.value)


def _violation(
    rule_id: str,
    field: str,
    severity: Severity,
    title: str,
    description: str,
    regulation_ref: str,
    evidence: str | None = None,
    bounding_box: BoundingBox | None = None,
) -> Violation:
    return Violation(
        rule_id=rule_id,
        field=field,
        severity=severity,
        title=title,
        description=description,
        regulation_ref=regulation_ref,
        evidence=evidence,
        bounding_box=bounding_box,
    )


# ---------------------------------------------------------------------------
# Individual rule functions
# ---------------------------------------------------------------------------

def rule_mrp(extraction: LabelExtraction) -> RuleResult:
    """LM-PC Rule 6(1)(d) — MRP must be declared as 'MRP ₹XX (Incl. of all taxes)'."""
    violations: List[Violation] = []
    passed: List[str] = []

    if not _field_ok(extraction.mrp):
        violations.append(_violation(
            rule_id="LM-PC-001",
            field="mrp",
            severity=Severity.CRITICAL,
            title="MRP not found",
            description=(
                "Maximum Retail Price (MRP) is mandatory on all packaged commodities. "
                "It must be printed as 'MRP ₹XX (Incl. of all taxes)' or equivalent."
            ),
            regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(1)(d)",
        ))
    else:
        value = extraction.mrp.value or ""
        # Check for inclusive-tax statement
        raw = extraction.raw_text.lower()
        has_tax_clause = any(phrase in raw for phrase in [
            "incl. of all taxes", "inclusive of all taxes",
            "incl of all taxes", "including all taxes",
        ])
        if not has_tax_clause:
            violations.append(_violation(
                rule_id="LM-PC-001b",
                field="mrp",
                severity=Severity.WARNING,
                title="MRP missing 'inclusive of all taxes' clause",
                description=(
                    f"MRP detected as '{value}' but the mandatory phrase "
                    "'Incl. of all taxes' is absent or unclear."
                ),
                regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(1)(d)",
                evidence=value,
                bounding_box=extraction.mrp.bounding_box,
            ))
        else:
            passed.append("MRP declared with inclusive-tax clause ✓")

    return violations, passed


def rule_net_quantity(extraction: LabelExtraction) -> RuleResult:
    """LM-PC Rule 6(1)(b) — Net quantity in standard units."""
    violations: List[Violation] = []
    passed: List[str] = []

    if not _field_ok(extraction.net_quantity):
        violations.append(_violation(
            rule_id="LM-PC-002",
            field="net_quantity",
            severity=Severity.CRITICAL,
            title="Net quantity not found",
            description=(
                "Net quantity / weight / volume must be declared in standard units "
                "(g, kg, ml, l, pcs). It must appear in the principal display panel."
            ),
            regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(1)(b)",
        ))
    else:
        value = extraction.net_quantity.value or ""
        # Check it ends with a legal unit
        if not re.search(
            r"\d+\s*(?:g|gm|gms|kg|ml|l|ltr|litre|pcs|pieces|nos|tabs?)\b",
            value,
            re.IGNORECASE,
        ):
            violations.append(_violation(
                rule_id="LM-PC-002b",
                field="net_quantity",
                severity=Severity.WARNING,
                title="Net quantity unit unclear or non-standard",
                description=(
                    f"Detected quantity '{value}' does not appear to use a standard SI unit. "
                    "Acceptable units: g, kg, ml, l, pcs."
                ),
                regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(1)(b)",
                evidence=value,
                bounding_box=extraction.net_quantity.bounding_box,
            ))
        else:
            passed.append(f"Net quantity declared: {value} ✓")

    return violations, passed


def rule_manufacturer(extraction: LabelExtraction) -> RuleResult:
    """LM-PC Rule 6(1)(c) — Manufacturer name & full address mandatory."""
    violations: List[Violation] = []
    passed: List[str] = []

    if not _field_ok(extraction.manufacturer_name):
        violations.append(_violation(
            rule_id="LM-PC-003",
            field="manufacturer_name",
            severity=Severity.CRITICAL,
            title="Manufacturer name not found",
            description=(
                "Name and full address of the manufacturer / packer / importer "
                "is mandatory on every packaged commodity."
            ),
            regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(1)(c)",
        ))
    else:
        passed.append(f"Manufacturer name found: {extraction.manufacturer_name.value} ✓")

    if not _field_ok(extraction.manufacturer_address):
        violations.append(_violation(
            rule_id="LM-PC-003b",
            field="manufacturer_address",
            severity=Severity.CRITICAL,
            title="Manufacturer address not found",
            description=(
                "A complete postal address (including PIN code) of the manufacturer "
                "must appear on the label."
            ),
            regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(1)(c)",
        ))
    else:
        addr = extraction.manufacturer_address.value or ""
        # Check for PIN code (6-digit Indian postal code)
        if not re.search(r"\b\d{6}\b", addr):
            violations.append(_violation(
                rule_id="LM-PC-003c",
                field="manufacturer_address",
                severity=Severity.WARNING,
                title="PIN code missing from manufacturer address",
                description=(
                    f"Address found ('{addr[:60]}…') but no 6-digit PIN code detected. "
                    "A complete address with PIN is required."
                ),
                regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(1)(c)",
                evidence=addr,
                bounding_box=extraction.manufacturer_address.bounding_box,
            ))
        else:
            passed.append("Manufacturer address with PIN code ✓")

    return violations, passed


def rule_country_of_origin(extraction: LabelExtraction) -> RuleResult:
    """LM-PC Rule 6(1)(k) — Country of origin mandatory for imported goods."""
    violations: List[Violation] = []
    passed: List[str] = []

    if not _field_ok(extraction.country_of_origin):
        violations.append(_violation(
            rule_id="LM-PC-004",
            field="country_of_origin",
            severity=Severity.WARNING,
            title="Country of origin not detected",
            description=(
                "Country of origin is mandatory for imported goods and recommended "
                "for all packaged commodities ('Made in India' / 'Product of India')."
            ),
            regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(1)(k)",
        ))
    else:
        passed.append(f"Country of origin: {extraction.country_of_origin.value} ✓")

    return violations, passed


def rule_best_before(extraction: LabelExtraction) -> RuleResult:
    """FSSAI Labelling Regs 2020 Reg 4(1)(b) & LM-PC — Date of expiry / best before."""
    violations: List[Violation] = []
    passed: List[str] = []

    if not _field_ok(extraction.best_before):
        violations.append(_violation(
            rule_id="FSSAI-001",
            field="best_before",
            severity=Severity.CRITICAL,
            title="Best before / expiry date not found",
            description=(
                "A 'Best Before' or 'Use By' date must be declared on all packaged "
                "food products in DD/MM/YYYY or MM/YYYY format."
            ),
            regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 4(1)(b)",
        ))
    else:
        passed.append(f"Best before date found: {extraction.best_before.value} ✓")

    return violations, passed


def rule_batch_number(extraction: LabelExtraction) -> RuleResult:
    """LM-PC Rule 6(1)(g) — Batch / lot number for traceability."""
    violations: List[Violation] = []
    passed: List[str] = []

    if not _field_ok(extraction.batch_lot_number):
        violations.append(_violation(
            rule_id="LM-PC-005",
            field="batch_lot_number",
            severity=Severity.WARNING,
            title="Batch / lot number not found",
            description=(
                "A batch or lot number is required for traceability and recall purposes. "
                "It is mandatory for food and several other product categories."
            ),
            regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(1)(g)",
        ))
    else:
        passed.append(f"Batch/lot number: {extraction.batch_lot_number.value} ✓")

    return violations, passed


def rule_customer_care(extraction: LabelExtraction) -> RuleResult:
    """LM-PC Rule 6(1)(j) — Consumer care number mandatory."""
    violations: List[Violation] = []
    passed: List[str] = []

    if not _field_ok(extraction.customer_care):
        violations.append(_violation(
            rule_id="LM-PC-006",
            field="customer_care",
            severity=Severity.WARNING,
            title="Consumer care contact not found",
            description=(
                "A consumer care telephone number or email address must be printed "
                "on all packaged commodities sold in India."
            ),
            regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(1)(j)",
        ))
    else:
        passed.append(f"Consumer care contact: {extraction.customer_care.value} ✓")

    return violations, passed


def rule_fssai_license(extraction: LabelExtraction) -> RuleResult:
    """FSSAI Labelling Regs 2020 — FSSAI licence number on food products."""
    violations: List[Violation] = []
    passed: List[str] = []

    # Only flag if product looks like food (ingredients present → likely food)
    is_food = _field_ok(extraction.ingredients) or _field_ok(extraction.nutritional_info)

    if is_food and not _field_ok(extraction.fssai_license):
        violations.append(_violation(
            rule_id="FSSAI-002",
            field="fssai_license",
            severity=Severity.CRITICAL,
            title="FSSAI licence number not found",
            description=(
                "All food products sold in India must display a valid 14-digit FSSAI "
                "licence or registration number."
            ),
            regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 4(1)(a)",
        ))
    elif _field_ok(extraction.fssai_license):
        lic = extraction.fssai_license.value or ""
        digits = re.sub(r"\D", "", lic)
        if len(digits) != 14:
            violations.append(_violation(
                rule_id="FSSAI-002b",
                field="fssai_license",
                severity=Severity.WARNING,
                title="FSSAI licence number format incorrect",
                description=(
                    f"Detected FSSAI number '{lic}' does not contain exactly 14 digits "
                    f"(found {len(digits)}). Please verify."
                ),
                regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 4(1)(a)",
                evidence=lic,
                bounding_box=extraction.fssai_license.bounding_box,
            ))
        else:
            passed.append(f"FSSAI licence ({lic}) — 14 digits ✓")

    return violations, passed


def rule_ingredients(extraction: LabelExtraction) -> RuleResult:
    """FSSAI Labelling Regs 2020 Reg 4(1)(c) — Ingredients list on food products."""
    violations: List[Violation] = []
    passed: List[str] = []

    is_food = _field_ok(extraction.nutritional_info)

    if is_food and not _field_ok(extraction.ingredients):
        violations.append(_violation(
            rule_id="FSSAI-003",
            field="ingredients",
            severity=Severity.CRITICAL,
            title="Ingredients list not found",
            description=(
                "All packaged food products must declare a complete list of ingredients "
                "in descending order of composition."
            ),
            regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 4(1)(c)",
        ))
    elif _field_ok(extraction.ingredients):
        passed.append("Ingredients list present ✓")

    return violations, passed


def rule_nutritional_info(extraction: LabelExtraction) -> RuleResult:
    """FSSAI Labelling Regs 2020 Reg 5 — Nutritional info on food products."""
    violations: List[Violation] = []
    passed: List[str] = []

    is_food = _field_ok(extraction.ingredients)

    if is_food and not _field_ok(extraction.nutritional_info):
        violations.append(_violation(
            rule_id="FSSAI-004",
            field="nutritional_info",
            severity=Severity.WARNING,
            title="Nutritional information not found",
            description=(
                "Nutritional information per 100 g / 100 ml (energy, protein, "
                "carbohydrates, fat, sodium) must appear on packaged food labels."
            ),
            regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 5",
        ))
    elif _field_ok(extraction.nutritional_info):
        passed.append("Nutritional information present ✓")

    return violations, passed


def rule_allergen_declaration(extraction: LabelExtraction) -> RuleResult:
    """
    FSSAI Labelling Regs 2020 Reg 4(1)(c) — Allergen 'Contains:' statement.
    Required for food products containing any of the 8 major allergens
    (gluten, milk, eggs, fish, shellfish, tree nuts, peanuts, soy).
    """
    violations: List[Violation] = []
    passed: List[str] = []

    is_food = _field_ok(extraction.ingredients) or _field_ok(extraction.nutritional_info)
    if not is_food:
        return violations, passed

    raw = extraction.raw_text.lower()

    # Check if any major allergen is mentioned in ingredients
    MAJOR_ALLERGENS = [
        "gluten", "wheat", "milk", "dairy", "egg", "fish", "shellfish",
        "crustacean", "tree nut", "peanut", "groundnut", "soy", "soybean",
        "sesame", "sulphite", "sulphur dioxide", "mustard", "celery",
    ]
    allergen_present_in_ingredients = any(a in raw for a in MAJOR_ALLERGENS)

    if _field_ok(extraction.allergen_info):
        val = extraction.allergen_info.value or ""
        passed.append(f"Allergen declaration found: '{val[:60]}' ✓")
    elif allergen_present_in_ingredients:
        # Allergen detected in ingredients but no explicit 'Contains:' statement
        violations.append(_violation(
            rule_id="FSSAI-005",
            field="allergen_info",
            severity=Severity.CRITICAL,
            title="Allergen 'Contains:' statement missing",
            description=(
                "Allergen ingredients detected in the ingredients list but no explicit "
                "'Contains:' allergen declaration found. FSSAI mandates a separate "
                "bold 'Contains: [allergen]' statement for all major allergens."
            ),
            regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 4(1)(c) & Schedule IX",
        ))
    else:
        # No allergens found and no declaration — soft info flag
        violations.append(_violation(
            rule_id="FSSAI-005b",
            field="allergen_info",
            severity=Severity.INFO,
            title="Allergen declaration not detected",
            description=(
                "No 'Contains:' allergen statement found. If the product contains or "
                "may contain any major allergen (gluten, milk, nuts, soy, eggs, fish), "
                "a declaration is mandatory."
            ),
            regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 4(1)(c) & Schedule IX",
        ))

    return violations, passed


def rule_veg_nonveg_symbol(extraction: LabelExtraction) -> RuleResult:
    """
    FSSAI Labelling Regs 2020 Reg 6 — Mandatory veg/non-veg symbol.
    Veg: green filled circle inside green square border.
    Non-veg: brown/red filled circle inside brown square border.
    OCR can detect the text declaration; colour is flagged as a reminder.
    """
    violations: List[Violation] = []
    passed: List[str] = []

    is_food = _field_ok(extraction.ingredients) or _field_ok(extraction.nutritional_info)
    if not is_food:
        return violations, passed

    raw = extraction.raw_text.lower()

    # Quick scan of raw text for veg/non-veg markers
    has_veg_text = bool(re.search(
        r"\b(?:100\s*%\s*)?(?:pure\s+)?veg(?:etarian)?\b", raw, re.IGNORECASE
    ))
    has_nonveg_text = bool(re.search(
        r"\bnon[\s\-]*veg(?:etarian)?\b", raw, re.IGNORECASE
    ))

    if _field_ok(extraction.veg_nonveg_symbol):
        val = extraction.veg_nonveg_symbol.value or ""
        is_non_veg = re.search(r"non[\s\-]*veg", val, re.IGNORECASE)
        symbol_type = "Non-Vegetarian" if is_non_veg else "Vegetarian"
        expected_colour = "brown/dark red circle" if is_non_veg else "green circle"
        passed.append(f"Veg/Non-veg symbol declared: {val[:40]} ✓")
        violations.append(_violation(
            rule_id="FSSAI-006b",
            field="veg_nonveg_symbol",
            severity=Severity.INFO,
            title=f"Verify {symbol_type} symbol colour",
            description=(
                f"Symbol text detected as '{val[:40]}'. Ensure the printed symbol uses "
                f"the correct FSSAI colour: {expected_colour} inside a square border. "
                "OCR cannot verify printed colours — manual visual check required."
            ),
            regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 6 & Schedule III",
            evidence=val,
            bounding_box=extraction.veg_nonveg_symbol.bounding_box,
        ))
    elif has_veg_text or has_nonveg_text:
        symbol_type = "Non-Veg" if has_nonveg_text else "Veg"
        passed.append(f"{symbol_type} text detected in label ✓")
        violations.append(_violation(
            rule_id="FSSAI-006b",
            field="veg_nonveg_symbol",
            severity=Severity.INFO,
            title="Verify printed veg/non-veg symbol colour",
            description=(
                "Veg/non-veg text detected but the mandatory printed colour symbol "
                "(green square = veg, brown square = non-veg) must also be present. "
                "OCR cannot verify printed colours — manual visual check required."
            ),
            regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 6 & Schedule III",
        ))
    else:
        violations.append(_violation(
            rule_id="FSSAI-006",
            field="veg_nonveg_symbol",
            severity=Severity.CRITICAL,
            title="Veg / Non-veg symbol not found",
            description=(
                "All packaged food products sold in India must display a mandatory "
                "veg or non-veg symbol: a green filled circle in a green square border "
                "(vegetarian) or a brown/dark-red filled circle in a brown square border "
                "(non-vegetarian)."
            ),
            regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 6 & Schedule III",
        ))

    return violations, passed


def rule_fssai_license_format(extraction: LabelExtraction) -> RuleResult:
    """
    FSSAI Labelling Regs 2020 — Deep format validation of FSSAI licence number.
    14-digit structure:
      Digits 1–2  : State code (10–32 for Indian states/UTs, or 11 for central)
      Digit 3     : Licence type (1=manufacturer, 2=retailer, 3=importer)
      Digits 4–14 : Unique serial number
    """
    violations: List[Violation] = []
    passed: List[str] = []

    if not _field_ok(extraction.fssai_license):
        return violations, passed  # Already handled by rule_fssai_license

    lic = extraction.fssai_license.value or ""
    digits = re.sub(r"\D", "", lic)

    # Must be exactly 14 digits (handled in rule_fssai_license, skip if not)
    if len(digits) != 14:
        return violations, passed

    state_code = int(digits[:2])
    licence_type = digits[2]

    # Valid state codes: 10–35 (FSSAI state codes)
    valid_state = 10 <= state_code <= 35
    # Valid licence types: 1, 2, 3
    valid_type = licence_type in ("1", "2", "3")

    if not valid_state:
        violations.append(_violation(
            rule_id="FSSAI-002c",
            field="fssai_license",
            severity=Severity.WARNING,
            title="FSSAI licence — state code looks invalid",
            description=(
                f"The first two digits of the FSSAI number '{digits}' are '{digits[:2]}', "
                "which does not match a known FSSAI state/UT code (valid range: 10–35). "
                "Please verify the number with the FSSAI FoSCoS portal."
            ),
            regulation_ref="FSSAI Licencing & Registration Rules 2011, Schedule 1",
            evidence=lic,
            bounding_box=extraction.fssai_license.bounding_box,
        ))
    elif not valid_type:
        violations.append(_violation(
            rule_id="FSSAI-002d",
            field="fssai_license",
            severity=Severity.WARNING,
            title="FSSAI licence — type digit looks invalid",
            description=(
                f"The third digit of the FSSAI number '{digits}' is '{licence_type}'. "
                "Expected 1 (manufacturer/processor), 2 (retailer/distributor), or "
                "3 (importer)."
            ),
            regulation_ref="FSSAI Licencing & Registration Rules 2011, Schedule 1",
            evidence=lic,
            bounding_box=extraction.fssai_license.bounding_box,
        ))
    else:
        TYPE_LABELS = {"1": "Manufacturer/Processor", "2": "Retailer/Distributor", "3": "Importer"}
        passed.append(
            f"FSSAI licence format valid — state code {digits[:2]}, "
            f"type: {TYPE_LABELS.get(licence_type, licence_type)} ✓"
        )

    return violations, passed


def rule_ingredients_order_declaration(extraction: LabelExtraction) -> RuleResult:
    """
    FSSAI Labelling Regs 2020 Reg 4(1)(c) — Ingredients must be listed in
    descending order of composition by weight. OCR cannot verify the actual
    ordering, so this rule checks the ingredients list is present and flags
    a reminder to verify order manually.
    """
    violations: List[Violation] = []
    passed: List[str] = []

    is_food = _field_ok(extraction.nutritional_info) or _field_ok(extraction.allergen_info)
    if not is_food:
        return violations, passed

    if not _field_ok(extraction.ingredients):
        # Already flagged by FSSAI-003; skip duplicate
        return violations, passed

    ingr = extraction.ingredients.value or ""

    # Heuristic: count comma-separated items — a proper list should have several
    item_count = len([i for i in ingr.split(",") if i.strip()])

    if item_count < 2:
        violations.append(_violation(
            rule_id="FSSAI-003b",
            field="ingredients",
            severity=Severity.WARNING,
            title="Ingredients list appears incomplete",
            description=(
                f"Only {item_count} ingredient item(s) detected in the ingredients list. "
                "A complete ingredients list must name every ingredient in descending "
                "order of weight at the time of manufacture."
            ),
            regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 4(1)(c)",
            evidence=ingr[:80],
            bounding_box=extraction.ingredients.bounding_box,
        ))
    else:
        passed.append(
            f"Ingredients list present with ~{item_count} items — "
            "verify descending weight order manually ✓"
        )
        violations.append(_violation(
            rule_id="FSSAI-003c",
            field="ingredients",
            severity=Severity.INFO,
            title="Verify ingredients are in descending weight order",
            description=(
                f"{item_count} ingredient items detected. FSSAI requires them to be listed "
                "in descending order of composition by weight or volume as used in manufacture. "
                "Automated ordering verification is not possible — manual review required."
            ),
            regulation_ref="FSSAI Labelling & Display Regulations 2020, Reg 4(1)(c)",
            evidence=ingr[:100],
            bounding_box=extraction.ingredients.bounding_box,
        ))

    return violations, passed


def rule_language_compliance(extraction: LabelExtraction) -> RuleResult:
    """
    LM-PC Rule 6(3) & FSSAI Regs — Mandatory declarations must appear in
    English and/or Hindi. Checks for presence of Devanagari script (Hindi)
    or explicit bilingual markers in the OCR text.
    """
    violations: List[Violation] = []
    passed: List[str] = []

    raw = extraction.raw_text

    # Detect Devanagari Unicode characters (Hindi/Marathi/Sanskrit block U+0900–U+097F)
    has_hindi = bool(re.search(r"[\u0900-\u097F]", raw))

    # Detect common Hindi transliterations used on bilingual labels
    HINDI_MARKERS = [
        "saamgri", "samgri", "nirmata", "nirman", "mulya", "shudh",
        "matra", "jankari", "poshan", "tatva", "sarvottam",
        # Common Hindi words in Roman script on bilingual labels
        "anusuchit", "khane",
    ]
    has_hindi_roman = any(m in raw.lower() for m in HINDI_MARKERS)

    # English is assumed present if OCR extracted any meaningful text
    has_english = len([w for w in raw.split() if re.match(r"[A-Za-z]{3,}", w)]) > 5

    if has_hindi or has_hindi_roman:
        script = "Devanagari (Hindi)" if has_hindi else "Hindi (Roman script)"
        passed.append(f"Bilingual label detected — English + {script} ✓")
    elif has_english:
        violations.append(_violation(
            rule_id="LM-PC-007",
            field="language_declaration",
            severity=Severity.WARNING,
            title="Hindi / regional language declaration not detected",
            description=(
                "Mandatory declarations (product name, net quantity, MRP, manufacturer) "
                "should appear in Hindi or the language of the state where the product "
                "is sold, in addition to English. No Hindi text detected on this label."
            ),
            regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(3); FSSAI Labelling Regs 2020, Reg 4(3)",
        ))
    else:
        violations.append(_violation(
            rule_id="LM-PC-007b",
            field="language_declaration",
            severity=Severity.WARNING,
            title="No recognisable language text detected",
            description=(
                "OCR could not extract sufficient text to verify language compliance. "
                "Ensure mandatory declarations appear clearly in English and/or Hindi."
            ),
            regulation_ref="Legal Metrology (PC) Rules 2011, Rule 6(3)",
        ))

    return violations, passed


# ---------------------------------------------------------------------------
# Master rule runner
# ---------------------------------------------------------------------------

ALL_RULES = [
    rule_mrp,
    rule_net_quantity,
    rule_manufacturer,
    rule_country_of_origin,
    rule_best_before,
    rule_batch_number,
    rule_customer_care,
    rule_fssai_license,
    rule_ingredients,
    rule_nutritional_info,
    rule_allergen_declaration,
    rule_veg_nonveg_symbol,
    rule_fssai_license_format,
    rule_ingredients_order_declaration,
    rule_language_compliance,
]


def run_compliance_checks(extraction: LabelExtraction) -> Tuple[List[Violation], List[str]]:
    """
    Run all rules against the extraction.
    Returns (all_violations, all_passed_labels).
    """
    all_violations: List[Violation] = []
    all_passed: List[str] = []

    for rule_fn in ALL_RULES:
        try:
            violations, passed = rule_fn(extraction)
            all_violations.extend(violations)
            all_passed.extend(passed)
        except Exception as exc:
            logger.exception("Rule %s raised unexpectedly: %s", rule_fn.__name__, exc)

    return all_violations, all_passed
