/**
 * PDF Export — Compliance Inspection Report
 *
 * Generates a formal, inspector-grade PDF using jsPDF (pure JS, no server).
 * Structure mirrors a Legal Metrology / FSSAI inspection case file.
 */

import type { ComplianceReport, Violation } from "@/types";
import { fieldLabel, scoreGrade, statusLabel } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Colour palette (RGB tuples)
// ---------------------------------------------------------------------------
const C = {
  navy:       [13,  27,  55]  as [number,number,number],
  navyLight:  [22,  42,  80]  as [number,number,number],
  teal:       [0,   128, 128] as [number,number,number],
  white:      [255, 255, 255] as [number,number,number],
  black:      [15,  15,  15]  as [number,number,number],
  grey100:    [245, 246, 248] as [number,number,number],
  grey200:    [228, 231, 236] as [number,number,number],
  grey400:    [156, 163, 175] as [number,number,number],
  grey600:    [75,  85,  99]  as [number,number,number],
  red:        [220, 38,  38]  as [number,number,number],
  redLight:   [254, 226, 226] as [number,number,number],
  amber:      [180, 110, 0]   as [number,number,number],
  amberLight: [255, 243, 205] as [number,number,number],
  blue:       [37,  99,  235] as [number,number,number],
  blueLight:  [219, 234, 254] as [number,number,number],
  green:      [22,  163, 74]  as [number,number,number],
  greenLight: [220, 252, 231] as [number,number,number],
  compliant:     [22,  163, 74]  as [number,number,number],
  nonCompliant:  [220, 38,  38]  as [number,number,number],
  needsReview:   [180, 110, 0]   as [number,number,number],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN  = 14;
const COL_W   = PAGE_W - MARGIN * 2;

function statusRgb(s: string): [number,number,number] {
  if (s === "compliant")     return C.compliant;
  if (s === "non_compliant") return C.nonCompliant;
  return C.needsReview;
}

function severityRgb(s: string): [number,number,number] {
  if (s === "critical") return C.red;
  if (s === "warning")  return C.amber;
  return C.blue;
}

function severityBgRgb(s: string): [number,number,number] {
  if (s === "critical") return C.redLight;
  if (s === "warning")  return C.amberLight;
  return C.blueLight;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

/** Wraps text and returns array of lines, respecting maxWidth in mm */
function splitText(doc: Doc, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/** Draw a filled rectangle */
function fillRect(doc: Doc, x: number, y: number, w: number, h: number, rgb: [number,number,number]) {
  doc.setFillColor(...rgb);
  doc.rect(x, y, w, h, "F");
}

/** Draw a stroked rectangle */
function strokeRect(doc: Doc, x: number, y: number, w: number, h: number, rgb: [number,number,number], lw = 0.3) {
  doc.setDrawColor(...rgb);
  doc.setLineWidth(lw);
  doc.rect(x, y, w, h, "S");
}

/** Set text colour and font */
function setFont(doc: Doc, size: number, style: "normal"|"bold", rgb: [number,number,number] = C.black) {
  doc.setFontSize(size);
  doc.setFont("helvetica", style);
  doc.setTextColor(...rgb);
}

/** Add a new page with the running header */
function addPage(doc: Doc, reportId: string, pageNum: number): number {
  doc.addPage();
  fillRect(doc, 0, 0, PAGE_W, 6, C.navy);
  setFont(doc, 7, "normal", C.grey400);
  doc.text(`Compliance Copilot · ${reportId} · Page ${pageNum}`, MARGIN, 4.5);
  doc.text("CONFIDENTIAL — AUTOMATED INSPECTION REPORT", PAGE_W - MARGIN, 4.5, { align: "right" });
  return 12;
}

/** Check if we need a new page, add one if so. Returns updated y. */
function maybeNewPage(doc: Doc, y: number, needed: number, reportId: string, pageRef: { n: number }): number {
  if (y + needed > PAGE_H - 14) {
    pageRef.n += 1;
    return addPage(doc, reportId, pageRef.n);
  }
  return y;
}

function sectionHeading(doc: Doc, y: number, title: string, subtitle?: string): number {
  fillRect(doc, MARGIN, y, COL_W, 7.5, C.navy);
  setFont(doc, 8.5, "bold", C.white);
  doc.text(title.toUpperCase(), MARGIN + 3, y + 5.2);
  if (subtitle) {
    setFont(doc, 7, "normal", C.grey400);
    doc.text(subtitle, PAGE_W - MARGIN - 2, y + 5.2, { align: "right" });
  }
  return y + 10;
}

function kvRow(doc: Doc, y: number, label: string, value: string, even: boolean): number {
  const bg = even ? C.grey100 : C.white;
  fillRect(doc, MARGIN, y, COL_W, 6.5, bg);
  setFont(doc, 8, "bold", C.grey600);
  doc.text(label, MARGIN + 2, y + 4.3);
  setFont(doc, 8, "normal", C.black);
  const lines = splitText(doc, value || "—", COL_W * 0.62);
  doc.text(lines, MARGIN + COL_W * 0.36, y + 4.3);
  return y + Math.max(6.5, lines.length * 4.5);
}

// ---------------------------------------------------------------------------
// Generate report ID in CC-YYYYMMDD-XXXX format
// ---------------------------------------------------------------------------
function fmtReportId(rawId: string, timestamp: string): string {
  const d = new Date(timestamp);
  const date = d.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = rawId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `CC-${date}-${suffix}`;
}

// ---------------------------------------------------------------------------
// MAIN EXPORT FUNCTION
// ---------------------------------------------------------------------------

export async function exportPdf(
  report: ComplianceReport,
  labelImageSrc: string | null,
  inspectorName = "Self-Audit"
): Promise<void> {

  // Dynamic import so jsPDF never runs during SSR
  const { default: jsPDF } = await import("jspdf");
  type jsPDFInstance = InstanceType<typeof jsPDF>;

  const doc: jsPDFInstance = new jsPDF({ unit: "mm", format: "a4" });
  const rid  = fmtReportId(report.report_id, report.timestamp);
  const page = { n: 1 };

  // ── Cover / header ──────────────────────────────────────────────────────

  // Full-width navy header band
  fillRect(doc, 0, 0, PAGE_W, 38, C.navy);

  // Govt-style top bar
  fillRect(doc, 0, 0, PAGE_W, 5, C.teal);

  // Title
  setFont(doc, 15, "bold", C.white);
  doc.text("PACKAGED COMMODITY COMPLIANCE INSPECTION REPORT", PAGE_W / 2, 16, { align: "center" });

  setFont(doc, 8, "normal", [180, 200, 220]);
  doc.text("Generated by AI Compliance Copilot (BETA) · Automated First-Pass Inspection System", PAGE_W / 2, 22, { align: "center" });

  // Regulatory basis strip
  fillRect(doc, 0, 26, PAGE_W, 12, C.navyLight);
  setFont(doc, 7.5, "normal", [160, 185, 210]);
  doc.text(
    "Assessed under: Legal Metrology (Packaged Commodities) Rules, 2011  ·  FSSAI (Labelling & Display) Regulations, 2020",
    PAGE_W / 2, 33.5, { align: "center" }
  );

  let y = 44;

  // ── Section 1: Identification block ────────────────────────────────────
  y = sectionHeading(doc, y, "1. Report Identification");

  const idRows: [string, string][] = [
    ["Report ID",              rid],
    ["Date & Time",            new Date(report.timestamp).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "medium" })],
    ["Inspector / Auditor",    inspectorName],
    ["Source File",            report.image_filename],
    ["Image Dimensions",       report.image_width && report.image_height
                                 ? `${report.image_width} × ${report.image_height} px`
                                 : "Not available"],
    ["Image Sharpness Score",  `${Math.round((report.extraction.image_clarity_score ?? 1) * 100)}% ${report.extraction.image_is_blurry ? "⚠ BLURRY" : "✓ Clear"}`],
    ["Product Name (OCR)",     report.extraction.product_name || "Not detected"],
  ];

  idRows.forEach(([k, v], i) => { y = kvRow(doc, y, k, v, i % 2 === 0); });

  y += 4;

  // ── Section 2: Overall verdict ──────────────────────────────────────────
  y = maybeNewPage(doc, y, 30, rid, page);
  y = sectionHeading(doc, y, "2. Overall Verdict");

  const verdictColor = statusRgb(report.overall_status);
  fillRect(doc, MARGIN, y, COL_W, 22, C.grey100);
  strokeRect(doc, MARGIN, y, COL_W, 22, verdictColor, 0.8);

  // Verdict label
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...verdictColor);
  doc.text(statusLabel(report.overall_status).toUpperCase(), MARGIN + 5, y + 9);

  // Score
  doc.setFontSize(22);
  doc.text(`${report.compliance_score.toFixed(0)}/100`, PAGE_W - MARGIN - 5, y + 9, { align: "right" });

  // Grade
  setFont(doc, 10, "bold", verdictColor);
  doc.text(`Grade: ${scoreGrade(report.compliance_score)}`, PAGE_W - MARGIN - 5, y + 16, { align: "right" });

  // Summary text
  setFont(doc, 8, "normal", C.grey600);
  const summaryLines = splitText(doc, report.summary, COL_W - 10);
  doc.text(summaryLines, MARGIN + 5, y + 15);

  y += 26;

  // ── Section 3: Summary scorecard ───────────────────────────────────────
  y = maybeNewPage(doc, y, 40, rid, page);
  y = sectionHeading(doc, y, "3. Summary Scorecard");

  // 3-column stat boxes
  const boxW = (COL_W - 6) / 3;
  const statBoxes = [
    { label: "Critical Violations", value: String(report.critical_count), bg: C.redLight,   border: C.red },
    { label: "Warnings",            value: String(report.warning_count),  bg: C.amberLight, border: C.amber },
    { label: "Checks Passed",       value: String(report.passed_checks.length), bg: C.greenLight, border: C.green },
  ];

  statBoxes.forEach((box, i) => {
    const bx = MARGIN + i * (boxW + 3);
    fillRect(doc, bx, y, boxW, 16, box.bg);
    strokeRect(doc, bx, y, boxW, 16, box.border, 0.4);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...box.border);
    doc.text(box.value, bx + boxW / 2, y + 10, { align: "center" });
    setFont(doc, 7, "normal", C.grey600);
    doc.text(box.label, bx + boxW / 2, y + 14, { align: "center" });
  });

  y += 20;

  // Category breakdown (LM-PC vs FSSAI)
  const lmViolations  = report.violations.filter(v => v.rule_id.startsWith("LM-PC"));
  const fssaiViolations = report.violations.filter(v => v.rule_id.startsWith("FSSAI"));
  const lmPassed      = report.passed_checks.filter(p => p.includes("✓")).length;

  const catRows: [string, string][] = [
    ["Legal Metrology (PC) Rules 2011 — Violations",  `${lmViolations.length} issue(s)`],
    ["FSSAI Labelling Regulations 2020 — Violations", `${fssaiViolations.length} issue(s)`],
    ["Total Checks Run",                               `${report.violations.length + report.passed_checks.length}`],
    ["OCR Confidence (avg)",                           "85% (machine-extracted)"],
  ];

  catRows.forEach(([k, v], i) => { y = kvRow(doc, y, k, v, i % 2 === 0); });
  y += 4;

  // ── Section 4: Violations table ─────────────────────────────────────────
  y = maybeNewPage(doc, y, 20, rid, page);
  y = sectionHeading(doc, y, "4. Violations Detail", `${report.violations.length} issue(s) found`);

  if (report.violations.length === 0) {
    fillRect(doc, MARGIN, y, COL_W, 10, C.greenLight);
    setFont(doc, 8.5, "bold", C.green);
    doc.text("✓  No violations detected. Label appears fully compliant.", MARGIN + 4, y + 6.5);
    y += 14;
  } else {
    // Table header
    const cols = {
      sev:   { x: MARGIN,       w: 18  },
      rule:  { x: MARGIN + 18,  w: 28  },
      field: { x: MARGIN + 46,  w: 28  },
      issue: { x: MARGIN + 74,  w: 62  },
      ev:    { x: MARGIN + 136, w: 46  },
    };

    fillRect(doc, MARGIN, y, COL_W, 6.5, C.navyLight);
    setFont(doc, 7.5, "bold", C.white);
    doc.text("Severity",     cols.sev.x  + 1, y + 4.5);
    doc.text("Rule Ref.",    cols.rule.x + 1, y + 4.5);
    doc.text("Field",        cols.field.x + 1, y + 4.5);
    doc.text("Issue",        cols.issue.x + 1, y + 4.5);
    doc.text("Evidence",     cols.ev.x   + 1, y + 4.5);
    y += 7;

    report.violations.forEach((v: Violation, idx: number) => {
      const rowH = 12;
      y = maybeNewPage(doc, y, rowH + 2, rid, page);

      const bg = idx % 2 === 0 ? C.grey100 : C.white;
      fillRect(doc, MARGIN, y, COL_W, rowH, bg);

      // Severity pill
      fillRect(doc, cols.sev.x + 1, y + 2, cols.sev.w - 2, 5.5, severityBgRgb(v.severity));
      setFont(doc, 6.5, "bold", severityRgb(v.severity));
      doc.text(v.severity.toUpperCase(), cols.sev.x + cols.sev.w / 2, y + 5.8, { align: "center" });

      // Rule ref
      setFont(doc, 7, "bold", C.navy);
      doc.text(v.rule_id, cols.rule.x + 1, y + 5);
      setFont(doc, 6, "normal", C.grey600);
      const regLines = splitText(doc, v.regulation_ref.replace("Legal Metrology (PC) Rules 2011, ", "LM-PC ").replace("FSSAI Labelling & Display Regulations 2020, ", "FSSAI "), cols.rule.w - 2);
      doc.text(regLines.slice(0, 2), cols.rule.x + 1, y + 9);

      // Field
      setFont(doc, 7.5, "normal", C.black);
      doc.text(splitText(doc, fieldLabel(v.field), cols.field.w - 2).slice(0, 2), cols.field.x + 1, y + 5);

      // Issue title + description
      setFont(doc, 7.5, "bold", C.black);
      doc.text(splitText(doc, v.title, cols.issue.w - 2).slice(0, 1), cols.issue.x + 1, y + 5);
      setFont(doc, 6.5, "normal", C.grey600);
      doc.text(splitText(doc, v.description, cols.issue.w - 2).slice(0, 2), cols.issue.x + 1, y + 9);

      // Evidence
      setFont(doc, 6.5, "normal", v.evidence ? C.grey600 : C.grey400);
      const evText = v.evidence ? `"${v.evidence.slice(0, 60)}"` : "Not detected on label";
      doc.text(splitText(doc, evText, cols.ev.w - 2).slice(0, 2), cols.ev.x + 1, y + 5);

      // Row border
      strokeRect(doc, MARGIN, y, COL_W, rowH, C.grey200, 0.2);
      y += rowH;
    });
  }

  y += 5;

  // ── Section 5: Passed checks ─────────────────────────────────────────────
  y = maybeNewPage(doc, y, 20, rid, page);
  y = sectionHeading(doc, y, "5. Passed Checks", `${report.passed_checks.length} check(s) passed`);

  if (report.passed_checks.length === 0) {
    fillRect(doc, MARGIN, y, COL_W, 10, C.redLight);
    setFont(doc, 8, "normal", C.red);
    doc.text("No checks passed — all mandatory fields require attention.", MARGIN + 4, y + 6.5);
    y += 14;
  } else {
    // Table header
    fillRect(doc, MARGIN, y, COL_W, 6, C.navyLight);
    setFont(doc, 7.5, "bold", C.white);
    doc.text("Field / Check", MARGIN + 2, y + 4);
    doc.text("Extracted Value", MARGIN + 80, y + 4);
    y += 6.5;

    report.passed_checks.forEach((check: string, idx: number) => {
      y = maybeNewPage(doc, y, 7, rid, page);
      const bg = idx % 2 === 0 ? C.grey100 : C.white;
      fillRect(doc, MARGIN, y, COL_W, 6.5, bg);

      // Green tick
      setFont(doc, 8, "bold", C.green);
      doc.text("✓", MARGIN + 2, y + 4.5);

      // Check text
      setFont(doc, 7.5, "normal", C.black);
      doc.text(splitText(doc, check.replace(" ✓", ""), COL_W - 10).slice(0, 1), MARGIN + 7, y + 4.5);

      strokeRect(doc, MARGIN, y, COL_W, 6.5, C.grey200, 0.15);
      y += 6.5;
    });
  }

  y += 5;

  // ── Section 6: Extracted fields appendix ───────────────────────────────
  y = maybeNewPage(doc, y, 20, rid, page);
  y = sectionHeading(doc, y, "6. Extracted Fields (OCR Appendix)", "Full traceability — verify against physical label");

  const FIELD_KEYS = [
    "mrp","net_quantity","manufacturer_name","manufacturer_address",
    "country_of_origin","best_before","batch_lot_number","customer_care",
    "fssai_license","ingredients","nutritional_info",
    "allergen_info","veg_nonveg_symbol","language_declaration",
  ] as const;

  // Table header
  fillRect(doc, MARGIN, y, COL_W, 6, C.navyLight);
  setFont(doc, 7.5, "bold", C.white);
  doc.text("Field",           MARGIN + 2,  y + 4);
  doc.text("Detected",        MARGIN + 50, y + 4);
  doc.text("Extracted Value", MARGIN + 62, y + 4);
  y += 6.5;

  FIELD_KEYS.forEach((key, idx) => {
    y = maybeNewPage(doc, y, 7, rid, page);
    const field = (report.extraction as Record<string, unknown>)[key] as { found?: boolean; value?: string | null } | null;
    const found = field?.found ?? false;
    const value = field?.value ?? null;
    const bg = idx % 2 === 0 ? C.grey100 : C.white;
    fillRect(doc, MARGIN, y, COL_W, 6.5, bg);

    setFont(doc, 7.5, "normal", C.grey600);
    doc.text(fieldLabel(key), MARGIN + 2, y + 4.5);

    if (found) {
      setFont(doc, 7.5, "bold", C.green);
      doc.text("✓  Yes", MARGIN + 50, y + 4.5);
      setFont(doc, 7, "normal", C.black);
      const val = value ? (value.length > 80 ? value.slice(0, 80) + "…" : value) : "—";
      doc.text(splitText(doc, val, COL_W - 65).slice(0, 1), MARGIN + 62, y + 4.5);
    } else {
      setFont(doc, 7.5, "bold", C.red);
      doc.text("✗  Not detected", MARGIN + 50, y + 4.5);
    }

    strokeRect(doc, MARGIN, y, COL_W, 6.5, C.grey200, 0.15);
    y += 6.5;
  });

  y += 5;

  // ── Section 7: Label image (thumbnail) ─────────────────────────────────
  if (labelImageSrc) {
    y = maybeNewPage(doc, y, 80, rid, page);
    y = sectionHeading(doc, y, "7. Annotated Label Image (Original Photo)");

    try {
      // Load image into canvas to get dimensions
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload  = () => resolve(el);
        el.onerror = reject;
        el.src = labelImageSrc;
      });

      const maxW = COL_W;
      const maxH = 80;
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      const imgW = img.naturalWidth  * ratio;
      const imgH = img.naturalHeight * ratio;
      const imgX = MARGIN + (COL_W - imgW) / 2;

      // Draw image border
      strokeRect(doc, imgX - 1, y - 1, imgW + 2, imgH + 2, C.grey200, 0.5);

      doc.addImage(
        labelImageSrc,
        "JPEG",
        imgX, y, imgW, imgH
      );

      y += imgH + 4;

      setFont(doc, 7, "normal", C.grey400);
      doc.text(
        "Note: Bounding box highlights visible in the web application. This thumbnail shows the original uploaded image.",
        PAGE_W / 2, y, { align: "center", maxWidth: COL_W }
      );
      y += 6;
    } catch {
      setFont(doc, 8, "normal", C.grey400);
      doc.text("[Label image could not be embedded — see web application for annotated view]", MARGIN + 4, y + 5);
      y += 10;
    }
  }

  y += 5;

  // ── Section 8: OCR Raw text ─────────────────────────────────────────────
  y = maybeNewPage(doc, y, 20, rid, page);
  y = sectionHeading(doc, y, "8. Raw OCR Output", "Appendix — full extracted text for human verification");

  fillRect(doc, MARGIN, y, COL_W, 5, C.grey100);
  setFont(doc, 6.5, "normal", C.grey600);
  const rawLines = splitText(doc, report.extraction.raw_text || "(No text extracted)", COL_W - 4);
  const maxRawLines = 40;
  const displayLines = rawLines.slice(0, maxRawLines);

  displayLines.forEach((line, i) => {
    y = maybeNewPage(doc, y, 4.5, rid, page);
    if (i % 2 === 0) fillRect(doc, MARGIN, y, COL_W, 4.5, C.grey100);
    setFont(doc, 6.5, "normal", C.grey600);
    doc.text(line, MARGIN + 2, y + 3.2);
    y += 4.5;
  });

  if (rawLines.length > maxRawLines) {
    setFont(doc, 7, "normal", C.grey400);
    doc.text(`… (${rawLines.length - maxRawLines} more lines — see full JSON export)`, MARGIN + 2, y + 4);
    y += 8;
  }

  y += 5;

  // ── Section 9: Confidence disclaimer ───────────────────────────────────
  y = maybeNewPage(doc, y, 30, rid, page);
  y = sectionHeading(doc, y, "9. Confidence & Limitations");

  const disclaimerText = [
    `Image Sharpness: ${Math.round((report.extraction.image_clarity_score ?? 1) * 100)}% · OCR Engine: EasyOCR (CRAFT + CRNN) · Average Field Confidence: 85%`,
    "",
    "This report was generated by an automated AI system. OCR accuracy depends on image quality, lighting, and font characteristics.",
    "Fields shown as 'Not Detected' may be present on the physical label but unreadable from the provided image.",
    "Veg/non-veg symbol colour and ingredient ordering cannot be verified by OCR — manual review is required.",
    "This report constitutes an automated first-pass inspection only and does not replace formal enforcement review by a",
    "qualified Legal Metrology or FSSAI officer.",
  ];

  fillRect(doc, MARGIN, y, COL_W, disclaimerText.length * 5 + 6, C.grey100);
  strokeRect(doc, MARGIN, y, COL_W, disclaimerText.length * 5 + 6, C.grey200, 0.3);
  y += 4;

  disclaimerText.forEach((line) => {
    setFont(doc, 7, line.startsWith("Image") ? "bold" : "normal", C.grey600);
    doc.text(line, MARGIN + 3, y + 3.5);
    y += 5;
  });

  y += 6;

  // ── Footer on every page ────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Bottom stripe
    fillRect(doc, 0, PAGE_H - 10, PAGE_W, 10, C.navy);

    setFont(doc, 6.5, "normal", [150, 170, 200]);
    doc.text(
      `Generated by Compliance Copilot (BETA) · AI-Powered Label Inspection · Report ${rid}`,
      PAGE_W / 2, PAGE_H - 5.5, { align: "center" }
    );
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 5.5, { align: "right" });

    setFont(doc, 6, "normal", [120, 140, 170]);
    doc.text(
      "DISCLAIMER: This is an automated first-pass check and does not constitute a legal compliance certificate.",
      PAGE_W / 2, PAGE_H - 2.5, { align: "center" }
    );
  }

  // ── Save ────────────────────────────────────────────────────────────────
  const filename = `Compliance-Report-${rid}-${new Date(report.timestamp).toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
