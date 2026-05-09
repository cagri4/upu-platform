"""
Emlak panel ikonları için OpenAI gpt-image-1 batch generator.

Kullanım:
    cd /home/cagr/Masaüstü/upu-platform
    OPENAI_API_KEY=... python3 scripts/generate-emlak-icons.py

Çıktı: public/icons/emlak/{name}.png (10 ikon, transparent bg, 1024x1024)
"""

import base64
import os
import sys
import time
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Önce: pip install openai", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "icons" / "emlak"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Ortak stil — her prompt'un başına eklenir
STYLE_PREFIX = (
    "Modern minimalist SaaS panel icon, flat duotone style with emerald green "
    "accent (#10b981) and dark slate strokes (#1e293b), clean geometric lines, "
    "rounded corners, soft subtle shadows, professional, similar to Linear / "
    "Stripe / Notion design language. Centered subject, generous padding, "
    "white/transparent background. "
)

ICONS = [
    ("panelim",      "Dashboard home icon: a stylized house silhouette with subtle grid + analytics widget overlay symbolizing 'my panel'."),
    ("mulkler",      "Real estate building icon: modern apartment block with multiple windows, clean architectural style."),
    ("musteriler",   "Customer/contacts icon: two abstract people figures side by side, friendly minimalist."),
    ("sozlesme",     "Contract document icon: paper sheet with horizontal text lines and a signature line at bottom."),
    ("sunumlar",     "Presentation chart icon: bar chart with an upward trending arrow above, professional analytics."),
    ("takip",        "Tracking target icon: bullseye with concentric circles and a small radar pulse, monitoring concept."),
    ("ara",          "Property search icon: magnifying glass over a small house outline, discovery concept."),
    ("takvim",       "Calendar icon: monthly grid with a highlighted day cell, simple date marker."),
    ("profil",       "User profile icon: clean abstract person silhouette in a circle, settings/account concept."),
    ("websitem",     "Personal website globe icon: stylized globe with a small cursor or browser frame, 'my website' concept."),
]

def main():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY env değişkeni bulunamadı", file=sys.stderr)
        sys.exit(1)

    client = OpenAI(api_key=api_key)

    for slug, body in ICONS:
        out_path = OUT_DIR / f"{slug}.png"
        if out_path.exists():
            print(f"[skip] {out_path.name} (zaten var)")
            continue
        prompt = STYLE_PREFIX + body
        print(f"[gen] {slug} ...")
        t0 = time.time()
        result = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            size="1024x1024",
            quality="medium",
            n=1,
            background="transparent",
        )
        b64 = result.data[0].b64_json
        out_path.write_bytes(base64.b64decode(b64))
        dt = time.time() - t0
        print(f"  → {out_path.relative_to(ROOT)} ({out_path.stat().st_size // 1024} KB, {dt:.1f}s)")

    print(f"\n✅ Tamam. {OUT_DIR}/ içinde {len(list(OUT_DIR.glob('*.png')))} ikon.")

if __name__ == "__main__":
    main()
