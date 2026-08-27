# 🏷️ AI Compliance Copilot

> Automated first-pass inspection of packaged-product labels against Indian Legal Metrology and FSSAI regulations.

**Upload a label photo → OCR extraction → rules engine → instant compliance report.**

---

## What it does

| Step | What happens |
|------|-------------|
| 📷 **Upload** | Drag-and-drop or browse a product label photo (JPEG / PNG / WebP / BMP / TIFF) |
| 🔍 **OCR** | Tesseract + OpenCV extract MRP, net quantity, manufacturer, FSSAI licence, best-before, batch number, ingredients, nutritional info |
| ⚖️ **Rules Engine** | 10+ rules checked against Legal Metrology (PC) Rules 2011 and FSSAI Labelling & Display Regulations 2020 |
| 📊 **Report** | Compliance score (0–100), severity-graded violations with regulation references, bounding-box highlights on the image, JSON export |

---

## Project structure

```
compliance-copilot/
├── backend/                    # Python · FastAPI
│   ├── app/
│   │   ├── main.py             # App entry point
│   │   ├── core/config.py      # Settings (env-driven)
│   │   ├── models/schemas.py   # Pydantic models
│   │   ├── api/routes.py       # POST /api/analyze · GET /api/health
│   │   └── services/
│   │       ├── ocr_service.py      # Image pre-processing + Tesseract OCR
│   │       ├── rules_engine.py     # Compliance rule functions
│   │       └── report_service.py   # Score, status, summary assembly
│   ├── tests/
│   │   ├── generate_test_images.py  # Generates synthetic label PNGs
│   │   └── sample_images/           # Created by the script above
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/                   # TypeScript · Next.js 14 · Tailwind CSS
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx       # Root layout + nav
    │   │   ├── page.tsx         # Main page (upload → report flow)
    │   │   └── globals.css
    │   ├── components/
    │   │   ├── upload/
    │   │   │   ├── DropZone.tsx      # react-dropzone upload area
    │   │   │   └── ImagePreview.tsx  # Image + SVG bounding-box overlay
    │   │   └── report/
    │   │       ├── ComplianceReport.tsx  # Full report panel (tabs)
    │   │       ├── ScoreGauge.tsx        # Circular score ring
    │   │       ├── ViolationCard.tsx     # Expandable violation item
    │   │       └── ExtractionTable.tsx   # Extracted fields table
    │   ├── lib/
    │   │   ├── api.ts           # Fetch wrapper → backend
    │   │   └── utils.ts         # cn(), severity colours, formatters
    │   └── types/index.ts       # TypeScript interfaces (mirrors Pydantic)
    ├── next.config.js           # Rewrites /api/* → backend
    └── package.json
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | ≥ 3.11 | [python.org](https://python.org) |
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| Tesseract OCR | ≥ 5 | `brew install tesseract` (macOS) · `apt install tesseract-ocr` (Ubuntu) |

---

## Quick start

### 1. Backend

```bash
cd compliance-copilot/backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env if Tesseract is not on your PATH:
#   TESSERACT_CMD=/opt/homebrew/bin/tesseract

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API is now live at **http://localhost:8000**
- Swagger UI: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

### 2. Frontend

```bash
cd compliance-copilot/frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Generate test images

The repo ships a script that draws two synthetic label PNGs you can upload immediately:

```bash
cd backend
python tests/generate_test_images.py
# → tests/sample_images/compliant_label.png
# → tests/sample_images/noncompliant_label.png
```

| Image | Expected result |
|-------|----------------|
| `compliant_label.png` | Score ≥ 80, all fields detected, few/no violations |
| `noncompliant_label.png` | Score < 50, critical violations: missing MRP, FSSAI, best-before, consumer care |

---

## Compliance rules covered

| Rule ID | Field | Regulation |
|---------|-------|------------|
| LM-PC-001 | MRP (+ inclusive-tax clause) | Legal Metrology (PC) Rules 2011, Rule 6(1)(d) |
| LM-PC-002 | Net quantity in SI units | Rule 6(1)(b) |
| LM-PC-003 | Manufacturer name + address + PIN | Rule 6(1)(c) |
| LM-PC-004 | Country of origin | Rule 6(1)(k) |
| LM-PC-005 | Batch / lot number | Rule 6(1)(g) |
| LM-PC-006 | Consumer care contact | Rule 6(1)(j) |
| FSSAI-001 | Best before / expiry date | FSSAI Labelling Regs 2020, Reg 4(1)(b) |
| FSSAI-002 | 14-digit FSSAI licence number | Reg 4(1)(a) |
| FSSAI-003 | Ingredients list | Reg 4(1)(c) |
| FSSAI-004 | Nutritional information | Reg 5 |

---

## API reference

### `POST /api/analyze`

Upload a label image and receive a full compliance report.

**Request:** `multipart/form-data` with a `file` field (image).

**Response:**
```json
{
  "success": true,
  "report": {
    "report_id": "uuid",
    "timestamp": "2024-08-01T10:30:00Z",
    "image_filename": "label.jpg",
    "overall_status": "non_compliant",
    "compliance_score": 48.0,
    "critical_count": 2,
    "warning_count": 1,
    "violations": [
      {
        "rule_id": "LM-PC-001",
        "field": "mrp",
        "severity": "critical",
        "title": "MRP not found",
        "description": "...",
        "regulation_ref": "Legal Metrology (PC) Rules 2011, Rule 6(1)(d)",
        "evidence": null,
        "bounding_box": null
      }
    ],
    "passed_checks": ["Net quantity declared: 500 g ✓", "..."],
    "extraction": { "raw_text": "...", "mrp": { ... }, ... },
    "summary": "NON-COMPLIANT (score 48/100). ..."
  }
}
```

### `GET /api/health`
```json
{ "status": "ok", "service": "AI Compliance Copilot", "version": "1.0.0" }
```

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `TESSERACT_CMD` | `tesseract` | Full path to Tesseract binary if not on PATH |
| `GEMINI_API_KEY` | *(empty)* | Optional Google Gemini key for enhanced extraction |
| `DEBUG` | `false` | Enable verbose logging |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Framer Motion |
| Backend | FastAPI, Python 3.11, Pydantic v2 |
| OCR | Tesseract 5 via pytesseract |
| Image processing | OpenCV, Pillow, NumPy |
| Rules | Pure Python — no external service required |

---

## Limitations & next steps

- **OCR accuracy** depends on image quality. Blurry, low-res, or skewed photos will reduce field detection rates.
- **Rules scope**: Currently covers FMCG food products. Cosmetics (BIS), pharmaceuticals (CDSCO), and electronics (BEE) rules can be added as new rule modules.
- **Language**: OCR is configured for English. Adding Hindi (`-l hin+eng`) improves bilingual labels.
- **Gemini integration**: Set `GEMINI_API_KEY` to enable the Gemini Vision fallback for unreadable labels (hook is in `ocr_service.py`).

---

## Disclaimer

This tool is for **informational and educational purposes only**. Compliance determinations should always be verified by a qualified regulatory officer. The authors accept no liability for decisions made based on this tool's output.
