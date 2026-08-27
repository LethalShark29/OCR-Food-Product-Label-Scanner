# System Architecture — AI Compliance Copilot

---

## 1. High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER'S DEVICE                                  │
│                                                                             │
│   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│   │   Device Camera  │    │  Saved Photo /   │    │  Dragged File    │     │
│   │  (Live Capture)  │    │  Gallery Image   │    │  from Desktop    │     │
│   └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘     │
│            │                       │                        │               │
│            └───────────────────────┴────────────────────────┘               │
│                                    │                                        │
│                                    ▼                                        │
│   ╔═══════════════════════════════════════════════════════════════════╗     │
│   ║              NEXT.JS FRONTEND  (localhost:3000)                   ║     │
│   ╚═══════════════════════════════════════════════════════════════════╝     │
│                                    │                                        │
│                          HTTP POST /api/analyze                             │
│                          multipart/form-data                                │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │   NEXT.JS REWRITE PROXY           │
                    │   /api/* → localhost:8000/api/*   │
                    └────────────────┬─────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                   FASTAPI BACKEND  (localhost:8000)                          │
│                                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌────────────┐    ┌────────────┐  │
│   │   Validation │───►│  OCR Engine  │───►│  Rules     │───►│  Report    │  │
│   │  Middleware  │    │  + Extractor │    │  Engine    │    │  Builder   │  │
│   └──────────────┘    └──────────────┘    └────────────┘    └────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

```
frontend/src/
│
├── app/
│   ├── layout.tsx          ← Root shell (navbar, footer, fonts, global CSS)
│   ├── page.tsx            ← Main page controller
│   │                         States: idle → loading → done | error
│   └── globals.css         ← Tailwind base + glassmorphism + neon utilities
│
├── components/
│   │
│   ├── upload/
│   │   ├── DropZone.tsx        ← react-dropzone + camera button trigger
│   │   ├── CameraScanner.tsx   ← Live camera modal (MediaDevices API)
│   │   └── ImagePreview.tsx    ← Label photo + SVG annotation overlay
│   │
│   └── report/
│       ├── ComplianceReport.tsx  ← Main report panel (tabs + export)
│       ├── ScoreGauge.tsx        ← SVG ring chart (score 0–100)
│       ├── ViolationCard.tsx     ← Expandable violation item
│       └── ExtractionTable.tsx   ← Fields table + raw OCR toggle
│
├── lib/
│   ├── api.ts              ← fetch wrapper → POST /api/analyze
│   └── utils.ts            ← cn(), severity colours, label formatters
│
└── types/
    └── index.ts            ← TypeScript interfaces (mirrors Pydantic models)


  PAGE STATE MACHINE
  ──────────────────

  ┌─────────┐   file dropped /     ┌─────────┐
  │  idle   │──  camera capture  ──►│ loading │
  └─────────┘                       └────┬────┘
       ▲                API success  ┌────▼────┐
       │  reset()       ◄────────────│  done   │
       │                             └─────────┘
       │                API failure  ┌─────────┐
       └─────────────────────────────│  error  │
                        reset()      └─────────┘
```

---

## 3. Backend Architecture

```
backend/app/
│
├── main.py              ← FastAPI app, CORS middleware, startup hook
│
├── core/
│   └── config.py        ← pydantic-settings (reads .env)
│
├── models/
│   └── schemas.py       ← All Pydantic v2 data models
│
├── api/
│   └── routes.py        ← Route handlers
│                           POST /api/analyze
│                           GET  /api/health
│
└── services/
    ├── ocr_service.py       ← Image pre-processing + EasyOCR
    ├── rules_engine.py      ← 10 compliance rule functions
    └── report_service.py    ← Score calculation + report assembly


  REQUEST PROCESSING PIPELINE
  ────────────────────────────

  POST /api/analyze
        │
        ▼
  ┌─────────────────────────────────────────────────────┐
  │  VALIDATION LAYER (routes.py)                       │
  │                                                     │
  │  ① MIME type ∈ {jpeg, png, webp, bmp, tiff}?        │
  │     No  ──► 415 Unsupported Media Type              │
  │     Yes ──► continue                                │
  │                                                     │
  │  ② File size ≤ 10 MB?                               │
  │     No  ──► 413 Request Entity Too Large            │
  │     Yes ──► continue                                │
  └────────────────────┬────────────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────────────┐
  │  OCR SERVICE  (ocr_service.py)                      │
  │                                                     │
  │  ① Decode bytes                                     │
  │     OpenCV imdecode ──► fallback: Pillow            │
  │                                                     │
  │  ② Pre-process                                      │
  │     longest side < 1200px? ──► upscale (cubic)      │
  │     fastNlMeansDenoisingColored                     │
  │                                                     │
  │  ③ EasyOCR.readtext()                               │
  │     Detection model (CRAFT) → text region quads     │
  │     Recognition model       → characters per region │
  │     Output: [(quad, text, confidence), ...]         │
  │                                                     │
  │  ④ Reconstruct text                                 │
  │     Sort by vertical centre → group into lines      │
  │     → single text block                             │
  │                                                     │
  │  ⑤ Regex field extraction (11 fields)               │
  │     Each field: 1-3 patterns, first match wins      │
  │     → ExtractedField {value, confidence, bbox}      │
  │                                                     │
  │  Returns: LabelExtraction                           │
  └────────────────────┬────────────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────────────┐
  │  RULES ENGINE  (rules_engine.py)                    │
  │                                                     │
  │  10 rule functions, each returns                    │
  │  (violations[], passed_labels[])                    │
  │                                                     │
  │  rule_mrp()              LM-PC Rule 6(1)(d)         │
  │  rule_net_quantity()     LM-PC Rule 6(1)(b)         │
  │  rule_manufacturer()     LM-PC Rule 6(1)(c)         │
  │  rule_country_of_origin()LM-PC Rule 6(1)(k)         │
  │  rule_best_before()      FSSAI Reg 4(1)(b)          │
  │  rule_batch_number()     LM-PC Rule 6(1)(g)         │
  │  rule_customer_care()    LM-PC Rule 6(1)(j)         │
  │  rule_fssai_license()    FSSAI Reg 4(1)(a)          │
  │  rule_ingredients()      FSSAI Reg 4(1)(c)          │
  │  rule_nutritional_info() FSSAI Reg 5               │
  │                                                     │
  │  Each violation carries:                            │
  │  severity: critical | warning | info                │
  │  rule_id, field, title, description, reg_ref        │
  │  evidence (text snippet), bounding_box              │
  └────────────────────┬────────────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────────────┐
  │  REPORT SERVICE  (report_service.py)                │
  │                                                     │
  │  Score = 100 − Σ deductions                         │
  │    critical → −20 pts each                          │
  │    warning  → −8  pts each                          │
  │    info     → −2  pts each                          │
  │    clamped to [0, 100]                              │
  │                                                     │
  │  Status:                                            │
  │    any critical OR score < 50  → NON_COMPLIANT      │
  │    50 ≤ score < 75             → NEEDS_REVIEW       │
  │    score ≥ 75, no criticals    → COMPLIANT          │
  │                                                     │
  │  Assembles ComplianceReport {                       │
  │    report_id, timestamp, image metadata,            │
  │    extraction, violations, passed_checks,           │
  │    score, status, summary                           │
  │  }                                                  │
  └────────────────────┬────────────────────────────────┘
                       │
                       ▼
             JSON response 200 OK
```

---

## 4. Data Model Relationships

```
  AnalyzeResponse
  └── ComplianceReport
        ├── report_id : str (UUID)
        ├── timestamp : str (ISO 8601)
        ├── image_filename : str
        ├── image_width, image_height : int
        │
        ├── LabelExtraction
        │     ├── raw_text : str
        │     ├── product_name : str | null
        │     └── ExtractedField × 11
        │           ├── field_name : str
        │           ├── value : str | null
        │           ├── confidence : float [0,1]
        │           ├── found : bool
        │           └── BoundingBox | null
        │                 ├── x, y : int   (pixels, original scale)
        │                 ├── width : int
        │                 └── height : int
        │
        ├── Violation[]
        │     ├── rule_id : str
        │     ├── field : str
        │     ├── severity : critical | warning | info
        │     ├── title : str
        │     ├── description : str
        │     ├── regulation_ref : str
        │     ├── evidence : str | null
        │     └── BoundingBox | null
        │
        ├── passed_checks : str[]
        ├── overall_status : compliant | needs_review | non_compliant
        ├── compliance_score : float [0, 100]
        ├── critical_count : int
        ├── warning_count : int
        ├── info_count : int
        └── summary : str
```

---

## 5. Middleware & Cross-Cutting Concerns

```
  ┌───────────────────────────────────────────────────────────────────────┐
  │                         MIDDLEWARE LAYERS                             │
  ├───────────────────────────────────────────────────────────────────────┤
  │                                                                       │
  │  LAYER 1 — Next.js Rewrite Proxy  (next.config.js)                   │
  │  ┌─────────────────────────────────────────────────────────────────┐ │
  │  │  Browser calls /api/analyze (same origin → no CORS preflight)   │ │
  │  │  Next.js server rewrites → http://localhost:8000/api/analyze     │ │
  │  │  Backend URL never exposed to browser network tab               │ │
  │  └─────────────────────────────────────────────────────────────────┘ │
  │                                                                       │
  │  LAYER 2 — CORS Middleware  (FastAPI / main.py)                       │
  │  ┌─────────────────────────────────────────────────────────────────┐ │
  │  │  allow_origins = [localhost:3000, 127.0.0.1:3000]              │ │
  │  │  allow_methods = ["*"]                                         │ │
  │  │  allow_headers = ["*"]                                         │ │
  │  │  Handles OPTION preflight requests automatically               │ │
  │  └─────────────────────────────────────────────────────────────────┘ │
  │                                                                       │
  │  LAYER 3 — Request Validation  (routes.py)                            │
  │  ┌─────────────────────────────────────────────────────────────────┐ │
  │  │  ① MIME type check   → 415 if invalid                          │ │
  │  │  ② File size check   → 413 if > 10 MB                          │ │
  │  │  ③ OCR error catch   → 422 for corrupted images                │ │
  │  │  ④ General catch     → 500 with server-side traceback log      │ │
  │  └─────────────────────────────────────────────────────────────────┘ │
  │                                                                       │
  │  LAYER 4 — Logging  (Python logging / uvicorn access log)             │
  │  ┌─────────────────────────────────────────────────────────────────┐ │
  │  │  INFO  — EasyOCR init, model download, request timing          │ │
  │  │  DEBUG — raw OCR text (when DEBUG=true in .env)                │ │
  │  │  ERROR — full tracebacks for unexpected exceptions             │ │
  │  └─────────────────────────────────────────────────────────────────┘ │
  │                                                                       │
  └───────────────────────────────────────────────────────────────────────┘
```

---

## 6. Camera Scanner Flow

```
  User clicks "Use Camera Scanner"
            │
            ▼
  CameraScanner modal opens
            │
            ▼
  navigator.mediaDevices.getUserMedia()
  ┌─────────────────────────┐
  │ facingMode: environment │  ← rear camera (phone)
  │ width ideal: 1920       │
  │ height ideal: 1080      │
  └─────────────┬───────────┘
                │
        ┌───────┴────────┐
        │ Permission      │
        │ granted?        │
        └───┬────────┬───┘
           Yes       No
            │         │
            ▼         ▼
     Live video    Error state
     feeds into    "Allow camera
     <video> tag   access"
            │
            ▼
  SVG corner brackets overlay
  "Align label within frame"
            │
  User taps capture button
            │
            ▼
  canvas.drawImage(video)       ← freeze frame
  canvas.toBlob(jpeg, 0.92)     ← compress
  new File(blob, "capture.jpg") ← wrap as File
            │
  Scan line animation plays (600ms)
            │
            ▼
  Modal closes → handleFile(file) called
            │
            ▼
  Same pipeline as file upload ──► backend
```

---

## 7. OCR Engine Internal Flow (EasyOCR)

```
  Raw image bytes
        │
        ▼
  ┌─────────────────────────────────────────────────────────┐
  │  PRE-PROCESSING  (OpenCV)                               │
  │                                                         │
  │  cv2.imdecode()                                         │
  │       │                                                 │
  │       ▼                                                 │
  │  longest side < 1200px?                                 │
  │       │ yes                                             │
  │       ▼                                                 │
  │  cv2.resize(INTER_CUBIC)    ← upscale for small labels  │
  │       │                                                 │
  │       ▼                                                 │
  │  fastNlMeansDenoisingColored(h=6)  ← noise removal      │
  └─────────────────────┬───────────────────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────────────────┐
  │  DETECTION  (CRAFT neural network)                      │
  │                                                         │
  │  Input:  BGR image array                                │
  │  Output: heatmap of character/word regions              │
  │                                                         │
  │  ┌──────────┐   ┌──────────┐   ┌──────────────────┐    │
  │  │  VGG-16  │──►│  UNet    │──►│ Region Score +   │    │
  │  │ backbone │   │ decoder  │   │ Affinity Score   │    │
  │  └──────────┘   └──────────┘   └────────┬─────────┘    │
  │                                          │              │
  │                                          ▼              │
  │                              Quadrilateral bounding     │
  │                              boxes per text region      │
  └─────────────────────┬───────────────────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────────────────┐
  │  RECOGNITION  (CRNN / Transformer)                      │
  │                                                         │
  │  Each cropped region → character sequence               │
  │  CTC decoder → final text string + confidence score     │
  └─────────────────────┬───────────────────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────────────────┐
  │  TEXT RECONSTRUCTION                                    │
  │                                                         │
  │  Sort results by vertical centre (top-to-bottom)        │
  │  Group words within ±20px vertical threshold            │
  │  Join words per line with spaces                        │
  │  Join lines with newlines                               │
  │                                                         │
  │  Output: structured text block                          │
  └─────────────────────┬───────────────────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────────────────┐
  │  REGEX FIELD EXTRACTION (11 fields)                     │
  │                                                         │
  │  For each field:                                        │
  │    pattern_1 → re.search() → match? return value+bbox   │
  │    pattern_2 → re.search() → match? return value+bbox   │
  │    ...                                                  │
  │    no match  → found=False, value=None                  │
  └─────────────────────────────────────────────────────────┘
```

---

## 8. Compliance Rules Engine Detail

```
  LabelExtraction
        │
        ├──────────────────────────────────────────────────────────────────┐
        │                                                                  │
        ▼                                                                  │
  ┌─────────────────────────────────────────────────────────────────────┐  │
  │ RULE FUNCTIONS                         REGULATION                   │  │
  ├─────────────────────────────────────────────────────────────────────┤  │
  │                                                                     │  │
  │  rule_mrp()                                                         │  │
  │    ├─ mrp.found?                                                    │  │
  │    │   No  → CRITICAL  LM-PC-001  Rule 6(1)(d)                     │  │
  │    └─ "incl. of all taxes" in raw_text?                             │  │
  │        No  → WARNING   LM-PC-001b Rule 6(1)(d)                     │  │
  │                                                                     │  │
  │  rule_net_quantity()                                                │  │
  │    ├─ net_quantity.found?                                           │  │
  │    │   No  → CRITICAL  LM-PC-002  Rule 6(1)(b)                     │  │
  │    └─ value matches SI unit pattern?                                │  │
  │        No  → WARNING   LM-PC-002b Rule 6(1)(b)                     │  │
  │                                                                     │  │
  │  rule_manufacturer()                                                │  │
  │    ├─ manufacturer_name.found?   No → CRITICAL  LM-PC-003          │  │
  │    ├─ manufacturer_address.found? No → CRITICAL LM-PC-003b         │  │
  │    └─ 6-digit PIN in address?    No → WARNING   LM-PC-003c         │  │
  │                                                                     │  │
  │  rule_country_of_origin()                                           │  │
  │    └─ country_of_origin.found?   No → WARNING   LM-PC-004          │  │
  │                                                                     │  │
  │  rule_best_before()                                                 │  │
  │    └─ best_before.found?         No → CRITICAL  FSSAI-001          │  │
  │                                                                     │  │
  │  rule_batch_number()                                                │  │
  │    └─ batch_lot_number.found?    No → WARNING   LM-PC-005          │  │
  │                                                                     │  │
  │  rule_customer_care()                                               │  │
  │    └─ customer_care.found?       No → WARNING   LM-PC-006          │  │
  │                                                                     │  │
  │  rule_fssai_license()  [only if food detected]                      │  │
  │    ├─ fssai_license.found?       No → CRITICAL  FSSAI-002          │  │
  │    └─ len(digits) == 14?         No → WARNING   FSSAI-002b         │  │
  │                                                                     │  │
  │  rule_ingredients()    [only if food detected]                      │  │
  │    └─ ingredients.found?         No → CRITICAL  FSSAI-003          │  │
  │                                                                     │  │
  │  rule_nutritional_info()[only if food detected]                     │  │
  │    └─ nutritional_info.found?    No → WARNING   FSSAI-004          │  │
  │                                                                     │  │
  └─────────────────────────────────────────────────────────────────────┘  │
        │                                                                  │
        ▼                                                                  │
  (violations[], passed_checks[])                                          │
        │                                                                  │
        ▼                                                                  │
  ┌─────────────────────────────────┐                                      │
  │  SCORING                        │                                      │
  │                                 │                                      │
  │  score = 100                    │                                      │
  │  for v in violations:           │                                      │
  │    critical → score -= 20       │                                      │
  │    warning  → score -= 8        │                                      │
  │    info     → score -= 2        │                                      │
  │  score = max(0, score)          │                                      │
  │                                 │                                      │
  │  Grade:  ≥90 A  ≥75 B  ≥60 C   │                                      │
  │          ≥40 D  <40  F          │                                      │
  └─────────────────────────────────┘                                      │
                                                                           │
  ◄──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Frontend Rendering Pipeline

```
  API response JSON
        │
        ▼
  page.tsx  setState("done") + setReport(report)
        │
        ├──────────────────────────────────────────────────┐
        │                                                  │
        ▼                                                  ▼
  ImagePreview.tsx                          ComplianceReport.tsx
        │                                         │
        ├─ <img src={objectURL} />                ├─ ScoreGauge.tsx
        │                                         │     SVG ring chart
        └─ <svg overlay>                          │     score + grade
              │                                  │
              ├─ for each violation              ├─ Stat pills
              │  with bounding_box:              │  (critical/warning/passed)
              │                                  │
              │  <rect> coloured border          ├─ Tab: Violations
              │  <text> rule_id label            │     ViolationCard × N
              │  glow filter on hover            │       severity badge
              │  tooltip on hover                │       expandable details
              │                                  │       evidence snippet
              └─ annotation count badge          │       regulation ref
                                                 │
                                                 ├─ Tab: Passed Checks
                                                 │     check list items
                                                 │
                                                 └─ Tab: Extracted Fields
                                                       ExtractionTable.tsx
                                                         ✓/✗ per field
                                                         value preview
                                                         raw OCR toggle
```

---

## 10. Technology Stack Summary

```
  ┌───────────────────────────────────────────────────────────────────────┐
  │  LAYER              TECHNOLOGY              VERSION    PURPOSE         │
  ├───────────────────────────────────────────────────────────────────────┤
  │                                                                       │
  │  Frontend           Next.js                 15.3       Framework      │
  │                     React                   19.1       UI rendering   │
  │                     TypeScript               5.4       Type safety    │
  │                     Tailwind CSS             3.4        Styling       │
  │                     react-dropzone          14.2       File upload    │
  │                     lucide-react            0.37       Icons          │
  │                     framer-motion           11.2       Animation      │
  │                     MediaDevices API        native     Camera access  │
  │                     SVG                     native     Annotations    │
  │                                                                       │
  ├───────────────────────────────────────────────────────────────────────┤
  │                                                                       │
  │  Backend            FastAPI                 0.115      Web framework  │
  │                     Uvicorn                 0.30       ASGI server    │
  │                     Pydantic v2             2.9        Validation     │
  │                     pydantic-settings       2.5        Config         │
  │                     python-multipart        0.0.9      File uploads   │
  │                                                                       │
  ├───────────────────────────────────────────────────────────────────────┤
  │                                                                       │
  │  OCR / Vision       EasyOCR                 1.7        OCR engine     │
  │                     PyTorch                 2.13       DL runtime     │
  │                     torchvision             0.28       Image ops      │
  │                     OpenCV (headless)       4.10       Pre-process    │
  │                     Pillow                  12.3       Image decode   │
  │                     NumPy                   2.5        Array ops      │
  │                     scikit-image            0.26       Image utils    │
  │                                                                       │
  ├───────────────────────────────────────────────────────────────────────┤
  │                                                                       │
  │  Python             Python                  3.12       Runtime        │
  │  Runtime            Node.js                 ≥18        JS runtime     │
  │                                                                       │
  └───────────────────────────────────────────────────────────────────────┘
```

---

## 11. Deployment Topology (Local Development)

```
  localhost:3000                    localhost:8000
  ─────────────────────────         ─────────────────────────
  Next.js Dev Server                Uvicorn (ASGI)
        │                                 │
        │  next.config.js rewrite         │  app/main.py
        │  /api/* ──────────────────────► │
        │                                 │  app/api/routes.py
        │  JSON response ◄────────────────│
        │                                 │  services/
        │                                 │    ocr_service.py
  React renders UI                        │    rules_engine.py
                                          │    report_service.py
                                          │
                                    ~/.easyocr/
                                    (model cache)
                                      craft_mlt_25k.pth     ~87 MB
                                      english_g2.pth        ~12 MB
```

---

*AI Compliance Copilot — System Architecture v1.0*
