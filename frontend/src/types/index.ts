// ---------------------------------------------------------------------------
// Mirrors backend app/models/schemas.py
// ---------------------------------------------------------------------------

export type Severity = "critical" | "warning" | "info";
export type ComplianceStatus = "compliant" | "non_compliant" | "needs_review";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedField {
  field_name: string;
  value: string | null;
  confidence: number;
  bounding_box: BoundingBox | null;
  found: boolean;
}

export interface LabelExtraction {
  raw_text: string;
  product_name: string | null;
  mrp: ExtractedField | null;
  net_quantity: ExtractedField | null;
  manufacturer_name: ExtractedField | null;
  manufacturer_address: ExtractedField | null;
  country_of_origin: ExtractedField | null;
  best_before: ExtractedField | null;
  batch_lot_number: ExtractedField | null;
  customer_care: ExtractedField | null;
  fssai_license: ExtractedField | null;
  ingredients: ExtractedField | null;
  nutritional_info: ExtractedField | null;
  allergen_info: ExtractedField | null;
  veg_nonveg_symbol: ExtractedField | null;
  language_declaration: ExtractedField | null;
  all_fields: ExtractedField[];
  // Image quality
  image_clarity_score: number;
  image_is_blurry: boolean;
  image_quality_warning: string | null;
}

export interface Violation {
  rule_id: string;
  field: string;
  severity: Severity;
  title: string;
  description: string;
  regulation_ref: string;
  evidence: string | null;
  bounding_box: BoundingBox | null;
}

export interface ComplianceReport {
  report_id: string;
  timestamp: string;
  image_filename: string;
  image_width: number;
  image_height: number;
  extraction: LabelExtraction;
  overall_status: ComplianceStatus;
  compliance_score: number;
  violations: Violation[];
  passed_checks: string[];
  critical_count: number;
  warning_count: number;
  info_count: number;
  summary: string;
}

export interface AnalyzeResponse {
  success: boolean;
  report: ComplianceReport | null;
  error: string | null;
}

// Manual override types
export interface ManualOverrides {
  overrides: Record<string, string>;
  original_extraction: LabelExtraction;
}

export interface RecheckResponse {
  success: boolean;
  report: ComplianceReport | null;
  overridden_fields: string[];
  error: string | null;
}
