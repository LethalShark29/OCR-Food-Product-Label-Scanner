# AI Compliance Copilot — Technical Documentation

## What is this?

AI Compliance Copilot is a web application that automates the inspection of packaged product labels. You photograph or scan a product label, upload it to the app, and within seconds it tells you exactly which mandatory declarations are present, which are missing or incorrect, and which regulation each issue maps to. It produces a scored compliance report that would otherwise require a person to manually read the label and cross-reference a rulebook.

---

## The Problem It Solves

In India, every packaged commodity sold to consumers must carry specific mandatory declarations — MRP, net quantity, manufacturer's address, FSSAI licence number, best-before date, and more. These requirements come from two main pieces of legislation:

- **Legal Metrology (Packaged Commodities) Rules, 2011** — governs all packaged goods
- **Food Safety and Standards (Labelling and Display) Regulations, 2020** — governs food products

Checking a label manually against these rules is repetitive, time-consuming, and inconsistent. This app automates the first-pass check and explains every finding in plain language with the exact regulation reference.

---

## System Architecture Overview

```
Browser
  │
  │  drag & drop image
  ▼
┌─────────────────────────────┐
│   FRONTEND  (Next.js :3000) │
│   React 19 + TypeScript     │
│   Tailwind CSS              │
└────────────┬────────────────┘
             │  POST /api/analyze (multipart image)
             │  via Next.js rewrite proxy
             ▼
┌─────────────────────────────┐
│   BACKEND  (FastAPI :8000)  │
│                             │
│  ┌──────────────────────┐   │
│  │  Image Pre-processor │   │  ← OpenCV + Pillow
│  └──────────┬───────────┘   │
│             ▼               │
│  ┌──────────────────────┐   │
│  │    OCR Engine        │   │  ← EasyOCR (PyTorch)
│  └──────────┬───────────┘   │
│             ▼               │
│  ┌──────────────────────┐   │
│  │  Field Extractor     │   │  ← Regex patterns
│  └──────────┬───────────┘   │
│             ▼               │
│  ┌──────────────────────┐   │
│  │  Rules Engine        │   │  ← 10 compliance rules
│  └──────────┬───────────┘   │
│             ▼               │
│  ┌──────────────────────┐   │
│  │  Report Builder      │   │  ← Scoring + summary
│  └──────────┬───────────┘   │
└─────────────┼───────────────┘
              │  JSON ComplianceReport
              ▼
┌─────────────────────────────┐
│   FRONTEND  renders:        │
│   Score gauge               │
│   Violation cards           │
│   Bounding box overlay      │
│   Extracted fields table    │
│   JSON export               │
└─────────────────────────────┘
```

---

## Frontend

The frontend is a **Next.js 15** application written in **TypeScript**. It runs on port 3000 and is entirely client-rendered after the initial page load. There is no database — it is a pure UI that communicates with the backend over a single API call.

### Pages and Layout

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root HTML shell, sticky navigation bar, footer |
| `src/app/page.tsx` | Main page — manages the full upload → loading → report flow |
| `src/app/globals.css` | Tailwind base styles, custom component classes (btn-primary, card) |

The main page (`page.tsx`) controls four application states:

- **idle** — shows the hero section, feature pills, and the dropzone
- **loading** — shows a spinner with status messages while the API call is in flight
- **done** — switches to a two-column layout: image preview on the left, report on the right
- **error** — shows the error message with a reset button

### Components

#### Upload Components (`src/components/upload/`)

**`DropZone.tsx`**
Built on `react-dropzone`. Accepts JPEG, PNG, WebP, BMP, and TIFF files up to 10 MB. Shows visual feedback when a file is dragged over it (border colour change, bounce animation on the icon). Rejects unsupported file types immediately with an inline error.

**`ImagePreview.tsx`**
Displays the uploaded label photo and overlays an SVG layer on top of it. The SVG is positioned absolutely over the image using `position: absolute` and scales with the image using `preserveAspectRatio="none"`. Each violation that has a bounding box gets a coloured rectangle drawn on the SVG — red for critical, amber for warning, blue for info. Hovering a rectangle shows a tooltip with the violation title and regulation reference. A `ResizeObserver` keeps the scale factors in sync if the container is resized.

#### Report Components (`src/components/report/`)

**`ComplianceReport.tsx`**
The main report panel. Contains the status header card, the score gauge, stat pills (critical / warning / passed counts), image metadata, and a tabbed interface with three tabs: Violations, Passed Checks, and Extracted Fields. Also contains the JSON export button which creates a Blob from the report object and triggers a browser download.

**`ScoreGauge.tsx`**
An SVG ring chart. Draws two concentric circles — a grey track and a coloured progress arc. The arc length is calculated from `strokeDasharray` and `strokeDashoffset`. The colour switches from green (≥75) to amber (≥50) to red (<50). The numeric score and letter grade are rendered as text centred inside the ring.

**`ViolationCard.tsx`**
A collapsible card for a single violation. The header row always shows severity badge, rule ID, field name, and title. Clicking the chevron expands the card to show the full description, an evidence snippet (the actual text found on the label that triggered the rule), and the regulation reference. Each card has a staggered entrance animation based on its index.

**`ExtractionTable.tsx`**
A table of all 11 mandatory fields showing whether each was detected (green tick or red cross) and its extracted value truncated to 80 characters. At the bottom is a collapsible section showing the full raw OCR text output.

### Types (`src/types/index.ts`)

TypeScript interfaces that exactly mirror the Pydantic models on the backend:

- `BoundingBox` — x, y, width, height in pixels
- `ExtractedField` — field name, value, confidence, bounding box, found flag
- `LabelExtraction` — all 11 fields plus raw text and product name
- `Violation` — rule ID, field, severity, title, description, regulation reference, evidence, bounding box
- `ComplianceReport` — the full report object
- `AnalyzeResponse` — the API response wrapper

### Utilities (`src/lib/`)

**`api.ts`** — A thin fetch wrapper. `analyzeLabel(file)` builds a `FormData` object and posts it to `/api/analyze`. Throws a typed error if the response is not OK.

**`utils.ts`** — Pure helper functions: `cn()` for merging Tailwind class names, colour mappings for severity and status values, `fieldLabel()` for human-readable field names, `formatTimestamp()` for locale-formatted dates, and `scoreRingColor()` / `scoreGrade()` for the gauge display.

### Configuration

**`next.config.js`** — Defines a rewrite rule that proxies all `/api/*` requests to `http://localhost:8000/api/*`. This means the frontend never exposes the backend URL to the browser and avoids CORS issues in development.

**`tailwind.config.ts`** — Extends the default theme with a `brand` colour palette (blues), custom `Inter` and `JetBrains Mono` fonts, and three custom keyframe animations: `fadeIn`, `slideUp`, and `pulse-slow`.

### Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 15.3.4 | React framework, routing, API proxy |
| react | 19.1.0 | UI rendering |
| typescript | 5.4.5 | Static typing |
| tailwindcss | 3.4.3 | Utility-first CSS |
| react-dropzone | 14.2.3 | File upload with drag-and-drop |
| lucide-react | 0.379.0 | Icon library |
| framer-motion | 11.2.10 | Animation |
| clsx + tailwind-merge | — | Conditional class name merging |

---

## Backend

The backend is a **FastAPI** application written in **Python 3.12**. It runs on port 8000 and exposes two endpoints. All heavy processing (image decoding, OCR, rules evaluation) happens synchronously inside the request handler — there is no queue or background worker for the MVP.

### Endpoints

**`POST /api/analyze`**
Accepts a multipart image upload. Validates file type and size. Runs the full OCR + extraction + rules pipeline. Returns a `ComplianceReport` JSON object.

**`GET /api/health`**
Returns `{ "status": "ok" }`. Used to check if the backend is running.

### File Structure

```
backend/
├── app/
│   ├── main.py              ← FastAPI app, CORS config, startup hook
│   ├── core/
│   │   └── config.py        ← Settings loaded from .env
│   ├── models/
│   │   └── schemas.py       ← Pydantic models for all data shapes
│   ├── api/
│   │   └── routes.py        ← Route handlers
│   └── services/
│       ├── ocr_service.py   ← Image pre-processing + EasyOCR
│       ├── rules_engine.py  ← 10 compliance rule functions
│       └── report_service.py← Score, status, summary assembly
├── requirements.txt
└── .env.example
```

### `app/main.py`

Creates the FastAPI application instance, adds CORS middleware allowing requests from `localhost:3000`, registers the router, and defines a startup hook that initialises the EasyOCR reader in a background thread so the model weights are loaded before the first request arrives.

### `app/core/config.py`

Uses `pydantic-settings` to load configuration from environment variables (or a `.env` file). Settings include:

- `GEMINI_API_KEY` — optional, reserved for a future Gemini Vision fallback
- `DEBUG` — toggles verbose logging
- `MAX_UPLOAD_SIZE` — default 10 MB
- `ALLOWED_MIME_TYPES` — list of accepted image formats

### `app/models/schemas.py`

Pydantic v2 models that define the shape of every data object in the system:

- `BoundingBox` — pixel coordinates of a detected text region
- `ExtractedField` — one extracted label field with value, confidence, and position
- `LabelExtraction` — all 11 fields plus raw OCR text and product name
- `Violation` — a single compliance finding with severity, description, evidence, and regulation reference
- `ComplianceReport` — the complete output: extraction results, violations, passed checks, score, status, summary, image metadata, timestamp
- `AnalyzeResponse` — the top-level API response wrapper

### `app/services/ocr_service.py`

Responsible for turning raw image bytes into a `LabelExtraction` object.

**Pre-processing pipeline:**
1. Decode image bytes using OpenCV (`cv2.imdecode`). Falls back to Pillow for formats OpenCV cannot handle (WebP, TIFF).
2. If the image's longest side is less than 1200 pixels, upscale with cubic interpolation.
3. Apply colour denoising (`cv2.fastNlMeansDenoisingColored`) to reduce JPEG artefacts and noise.

**OCR:**
An `easyocr.Reader` instance is created once at module level and reused across requests (lazy singleton). It is configured for English (`["en"]`) with `gpu=False`. Calling `reader.readtext(image)` returns a list of `(quadrilateral, text, confidence)` tuples.

**Text reconstruction:**
The word-level results are sorted by vertical centre position. Words within 20 pixels of the same vertical position are grouped onto the same line. Lines are joined with spaces and separated by newlines to produce a readable block of text.

**Field extraction:**
The reconstructed text is scanned with `re.search()` against two or more regex patterns per field. The first match wins. If found, the matched value is looked up in the EasyOCR word list to retrieve the original bounding box coordinates.

**Patterns cover:**
- MRP with currency symbols (₹, Rs.)
- Net quantity with SI units (g, gm, kg, ml, l, ltr)
- Manufacturer / marketed-by declarations
- Country of origin (Made in / Product of)
- Best before / expiry / manufacturing date
- Batch and lot numbers
- Consumer care phone numbers and email addresses
- FSSAI licence numbers (14-digit)
- Ingredients lists
- Nutritional information blocks

### `app/services/rules_engine.py`

Contains one function per compliance rule. Each function receives the `LabelExtraction` object and returns a tuple of `(violations, passed_labels)`.

**Rule severity logic:**

- A field being completely absent → **Critical**
- A field present but with a formatting problem → **Warning**
- An observation with no direct regulatory consequence → **Info**

**Smart context detection:**
Some FSSAI rules (FSSAI-002 for FSSAI licence, FSSAI-003 for ingredients, FSSAI-004 for nutritional info) only fire if the product appears to be food. The heuristic: if `ingredients` or `nutritional_info` was detected, the product is treated as food.

**PIN code validation:**
Rule LM-PC-003 checks that the manufacturer address contains a 6-digit number matching the Indian postal code format.

**FSSAI digit count validation:**
Rule FSSAI-002 strips non-digits from the detected licence number and checks that exactly 14 remain.

**MRP tax clause check:**
Rule LM-PC-001b scans the raw text (not just the MRP field) for the phrase "incl. of all taxes" or equivalent, since this clause often appears near but not within the numeric MRP value.

### `app/services/report_service.py`

Takes the image bytes, filename, and `LabelExtraction` and produces the final `ComplianceReport`.

**Scoring:**
Starts at 100. Deducts 20 per critical violation, 8 per warning, 2 per info. Clamped to 0.

**Status determination:**
- Any critical violation OR score < 50 → Non-Compliant
- Score 50–74 → Needs Review
- Score ≥ 75, no criticals → Compliant

**Summary generation:**
Assembles a 2–4 sentence plain-English paragraph stating the overall status, how many checks passed, how many critical violations were found, and whether any fields need correction.

### Backend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.115.0 | Web framework and request routing |
| uvicorn | 0.30.6 | ASGI server to run FastAPI |
| python-multipart | 0.0.9 | Multipart form / file upload parsing |
| easyocr | 1.7.1 | Deep learning OCR engine |
| torch | 2.13.0 | PyTorch runtime for EasyOCR models |
| torchvision | 0.28.0 | Image transforms used by EasyOCR |
| opencv-python-headless | 4.10.0 | Image pre-processing |
| Pillow | 12.3.0 | Image decoding (WebP, TIFF, BMP fallback) |
| numpy | 2.5.2 | Array operations on image data |
| pydantic | 2.9.2 | Data validation and serialisation |
| pydantic-settings | 2.5.2 | Environment-based configuration |
| python-dotenv | 1.0.1 | Loads .env files |
| httpx | 0.27.2 | Async HTTP client (reserved for future use) |

---

## Middleware

In this application the term "middleware" covers two layers: the HTTP middleware built into FastAPI, and the request routing proxy in Next.js.

### CORS Middleware (FastAPI)

Added in `main.py` using FastAPI's built-in `CORSMiddleware`:

```
allow_origins  = ["http://localhost:3000", "http://127.0.0.1:3000"]
allow_methods  = ["*"]
allow_headers  = ["*"]
allow_credentials = True
```

This tells the browser that the backend accepts cross-origin requests from the Next.js dev server. Without this, the browser would block the `POST /api/analyze` request before it even reached the route handler.

### Next.js Rewrite Proxy (Frontend)

Configured in `next.config.js`:

```js
async rewrites() {
  return [{
    source: "/api/:path*",
    destination: "http://localhost:8000/api/:path*"
  }]
}
```

When the frontend calls `/api/analyze`, Next.js intercepts the request server-side and forwards it to the FastAPI backend. From the browser's perspective it is talking to its own origin (`localhost:3000`), so no CORS preflight is triggered. This also means the backend URL is never exposed in the browser's network tab.

### Request Validation Middleware (FastAPI route handler)

Before the OCR pipeline runs, the route handler in `routes.py` performs two checks:

1. **MIME type check** — the `Content-Type` of the uploaded file must be in the `ALLOWED_MIME_TYPES` list. If not, a `415 Unsupported Media Type` response is returned immediately.
2. **Size check** — the file bytes are read and checked against `MAX_UPLOAD_SIZE` (10 MB). If exceeded, a `413 Request Entity Too Large` response is returned.

These checks prevent malformed or oversized uploads from ever reaching the expensive OCR stage.

### Error Handling

The route handler wraps the OCR and report stages in separate `try/except` blocks:

- A `ValueError` from the OCR service (e.g. corrupted image) returns `422 Unprocessable Entity` with the error message.
- Any unexpected exception returns `500 Internal Server Error` with a generic message. The full traceback is logged server-side via Python's standard `logging` module.

---

## Compliance Rules Covered

| Rule ID | Field checked | Severity if failed | Regulation |
|---------|--------------|-------------------|------------|
| LM-PC-001 | MRP present | Critical | LM-PC Rules 2011, Rule 6(1)(d) |
| LM-PC-001b | MRP includes "Incl. of all taxes" | Warning | Rule 6(1)(d) |
| LM-PC-002 | Net quantity in SI units | Critical | Rule 6(1)(b) |
| LM-PC-002b | Net quantity unit is standard | Warning | Rule 6(1)(b) |
| LM-PC-003 | Manufacturer name present | Critical | Rule 6(1)(c) |
| LM-PC-003b | Manufacturer address present | Critical | Rule 6(1)(c) |
| LM-PC-003c | Address contains 6-digit PIN code | Warning | Rule 6(1)(c) |
| LM-PC-004 | Country of origin declared | Warning | Rule 6(1)(k) |
| LM-PC-005 | Batch / lot number present | Warning | Rule 6(1)(g) |
| LM-PC-006 | Consumer care contact present | Warning | Rule 6(1)(j) |
| FSSAI-001 | Best before / expiry date present | Critical | FSSAI Regs 2020, Reg 4(1)(b) |
| FSSAI-002 | FSSAI licence number present | Critical | Reg 4(1)(a) |
| FSSAI-002b | FSSAI licence is exactly 14 digits | Warning | Reg 4(1)(a) |
| FSSAI-003 | Ingredients list present (food) | Critical | Reg 4(1)(c) |
| FSSAI-004 | Nutritional information present (food) | Warning | Reg 5 |

---

## How It Works — End to End

### Step 1: Upload

The user drags a product label photo onto the dropzone or clicks to browse. `react-dropzone` validates the file type and size client-side, then `analyzeLabel(file)` in `api.ts` sends a `FormData` POST to `/api/analyze`.

### Step 2: Image Pre-Processing

OpenCV decodes the image. If smaller than 1200px on the longest side it is upscaled. Colour denoising reduces noise that would confuse the OCR model.

### Step 3: OCR

EasyOCR's detection model (CRAFT neural network) locates text regions. The recognition model reads each region. The output is a list of word-level results with positions and confidence scores.

### Step 4: Field Extraction

Words are sorted spatially and reassembled into lines of text. Regular expressions scan the text block for each of the 11 mandatory fields and record the matched value plus the pixel coordinates of where it appeared on the image.

### Step 5: Rules Evaluation

Ten rule functions check the extracted fields. Each produces zero or more `Violation` objects (with severity, description, and regulation reference) and zero or more passed-check labels.

### Step 6: Report Assembly

The report service calculates a 0–100 score, determines compliant / needs review / non-compliant status, and writes a plain-English summary paragraph.

### Step 7: Rendering

The frontend receives the JSON report. It renders the score gauge, violation cards (expandable with evidence and regulation text), the extracted fields table, and draws coloured SVG bounding boxes directly on the uploaded label photo.

---

## Limitations

- **OCR accuracy** — Clear, well-lit, perpendicular photos give the best results. Blurry or low-resolution images will reduce field detection rates.
- **Scope** — Covers FMCG food and general packaged goods. Cosmetics (BIS), pharmaceuticals (CDSCO), and electronics (BEE) rules are not included.
- **Language** — OCR is configured for English. Hindi text on bilingual labels may not be read accurately.
- **First-pass only** — Designed to automate initial screening. Final compliance determinations must be verified by a qualified regulatory officer.

---

*AI Compliance Copilot — for informational use only.*
