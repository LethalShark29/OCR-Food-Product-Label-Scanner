"""
Generate synthetic product label test images for development / demo purposes.

Usage:
    cd backend
    python tests/generate_test_images.py

Outputs two PNG files in tests/sample_images/:
  - compliant_label.png   — a label with all mandatory fields
  - noncompliant_label.png — a label with several fields missing
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).parent / "sample_images"
OUT_DIR.mkdir(exist_ok=True)

W, H = 900, 1200
BG_WHITE = (255, 255, 255)
BG_CREAM = (255, 252, 240)


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Try to load a system font; fall back to PIL default."""
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _draw_label(
    filename: str,
    product_name: str,
    lines: list[tuple[str, int, bool]],   # (text, font_size, bold)
    bg: tuple[int, int, int] = BG_WHITE,
    border_color: tuple[int, int, int] = (30, 60, 120),
) -> None:
    img = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)

    # Outer border
    draw.rectangle([10, 10, W - 10, H - 10], outline=border_color, width=4)
    # Inner accent bar
    draw.rectangle([10, 10, W - 10, 90], fill=border_color)

    # Product name in header
    hfont = _font(36)
    draw.text((W // 2, 50), product_name, fill=(255, 255, 255), font=hfont, anchor="mm")

    # Body lines
    y = 110
    for text, size, bold in lines:
        f = _font(size)
        color = (20, 20, 20) if not bold else (10, 10, 80)
        draw.text((30, y), text, fill=color, font=f)
        y += size + 10

        # Thin separator after section headers
        if text.endswith(":") or text.isupper():
            draw.line([(30, y - 4), (W - 30, y - 4)], fill=(200, 200, 200), width=1)

    img.save(OUT_DIR / filename)
    print(f"  ✓  Saved: {OUT_DIR / filename}")


def make_compliant():
    """All mandatory fields present and correctly formatted."""
    lines = [
        ("PRODUCT DETAILS", 18, True),
        ("Net Wt.: 500 g", 20, False),
        ("MRP: ₹ 149 (Incl. of all taxes)", 22, True),
        ("", 6, False),
        ("MANUFACTURER:", 16, True),
        ("Sunrise Foods Pvt. Ltd.", 20, False),
        ("Plot 42, MIDC Industrial Area,", 18, False),
        ("Pune, Maharashtra – 411 019", 18, False),
        ("", 6, False),
        ("CONSUMER CARE:", 16, True),
        ("1800-123-4567 | care@sunrisefoods.in", 18, False),
        ("", 6, False),
        ("FSSAI Lic. No.: 10019022003456", 18, False),
        ("", 6, False),
        ("Country of Origin: India", 18, False),
        ("Batch No.: BT-2024-0815", 18, False),
        ("Mfg. Date: Aug 2024", 18, False),
        ("Best Before: 12 months from manufacture", 18, False),
        ("", 6, False),
        ("INGREDIENTS:", 16, True),
        ("Wheat flour (60%), Sugar, Edible vegetable oil,", 17, False),
        ("Salt, Baking soda, Milk solids, Emulsifier (E471).", 17, False),
        ("Contains: Gluten, Milk. May contain traces of nuts.", 17, False),
        ("", 6, False),
        ("NUTRITIONAL INFORMATION:", 16, True),
        ("Per 100 g serving:", 17, False),
        ("Energy: 420 kcal | Protein: 8 g", 17, False),
        ("Carbohydrates: 68 g | Total Sugars: 18 g", 17, False),
        ("Total Fat: 12 g | Saturated Fat: 5 g", 17, False),
        ("Sodium: 320 mg", 17, False),
    ]
    _draw_label("compliant_label.png", "SUNRISE WHEAT BISCUITS", lines, BG_CREAM)


def make_noncompliant():
    """Missing MRP, FSSAI licence, Best Before, and Consumer Care."""
    lines = [
        ("PRODUCT DETAILS", 18, True),
        ("Net Wt.: 250 g", 20, False),
        # MRP deliberately absent
        ("", 6, False),
        ("MANUFACTURER:", 16, True),
        ("Generic Snacks Co.", 20, False),
        # Address present but no PIN code
        ("Sector 9, Industrial Zone, Delhi", 18, False),
        ("", 6, False),
        # Consumer care absent
        # FSSAI absent
        ("Country of Origin: India", 18, False),
        # Batch number absent
        ("", 6, False),
        ("INGREDIENTS:", 16, True),
        ("Potato starch, Refined oil, Salt, Spices,", 17, False),
        ("Artificial flavour, Colour (E110).", 17, False),
        ("", 6, False),
        ("NUTRITIONAL INFORMATION:", 16, True),
        ("Energy: 510 kcal per 100 g", 17, False),
        ("Fat: 28 g | Carbs: 62 g | Protein: 5 g", 17, False),
        ("", 20, False),
        ("** FOR RETAIL SALE ONLY **", 16, True),
    ]
    _draw_label(
        "noncompliant_label.png",
        "GENERIC POTATO CHIPS",
        lines,
        BG_WHITE,
        border_color=(160, 30, 30),
    )


if __name__ == "__main__":
    print("Generating test label images …")
    make_compliant()
    make_noncompliant()
    print("Done. Images saved in tests/sample_images/")
