"""
PWA app icon — UPU Emlak markalı 1024x1024 base ikon + boyut varyasyonları.

gpt-image-1 ile premium gradient app icon üretilir, sonra PIL ile:
  - 192x192 (Android Chrome)
  - 512x512 (Android splash)
  - 180x180 (Apple touch icon)
  - 32x32 (favicon)
  - 192x192 maskable (safe zone padding ile)

Çıktı: public/icons/app/*.png
"""

import base64
import os
import sys
from pathlib import Path

from openai import OpenAI
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "icons" / "app"
OUT_DIR.mkdir(parents=True, exist_ok=True)
BASE = OUT_DIR / "icon-base-1024.png"

PROMPT = (
    "App icon — friendly blue robot character ONLY. "
    "Cute mascot robot head: rounded square face, small antenna on top, "
    "two big round friendly eyes (white sclera, blue iris), warm smile. "
    "Solid Facebook blue (#1877F2) robot character on a clean white "
    "square background (icon will be OS-masked, full bleed white). "
    "Centered with generous padding, premium SaaS feel like Notion / Linear. "
    "STRICT: NO TEXT, NO LETTERS, NO WORDS, NO 'UPU' WRITING anywhere on the icon — "
    "only the robot character itself, nothing else. "
    "Crisp, professional, glossy minimal vector look. 1024x1024."
)

def generate_base():
    if BASE.exists():
        print(f"[skip] {BASE.name} zaten var")
        return
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY env yok", file=sys.stderr)
        sys.exit(1)
    client = OpenAI(api_key=api_key)
    print("[gen] icon-base-1024 ...")
    result = client.images.generate(
        model="gpt-image-1",
        prompt=PROMPT,
        size="1024x1024",
        quality="high",
        n=1,
    )
    BASE.write_bytes(base64.b64decode(result.data[0].b64_json))
    print(f"  → {BASE.relative_to(ROOT)} ({BASE.stat().st_size // 1024} KB)")

def make_variants():
    base = Image.open(BASE).convert("RGBA")

    targets = {
        "icon-192.png":         192,
        "icon-512.png":         512,
        "apple-touch-icon.png": 180,
        "favicon-32.png":       32,
    }
    for name, size in targets.items():
        img = base.copy()
        img.thumbnail((size, size), Image.LANCZOS)
        out = OUT_DIR / name
        img.save(out, "PNG", optimize=True)
        print(f"  → {out.name} ({size}×{size}, {out.stat().st_size // 1024} KB)")

    # Maskable: %20 safe zone padding ile (Android adaptive icon kuralı)
    for size in (192, 512):
        canvas_size = size
        safe = int(size * 0.8)  # %80 inner safe zone
        canvas = Image.new("RGBA", (canvas_size, canvas_size), (16, 185, 129, 255))  # emerald
        # base'i safe boyutuna küçült
        inner = base.copy()
        inner.thumbnail((safe, safe), Image.LANCZOS)
        offset = ((canvas_size - inner.width) // 2, (canvas_size - inner.height) // 2)
        canvas.paste(inner, offset, inner)
        out = OUT_DIR / f"icon-maskable-{size}.png"
        canvas.save(out, "PNG", optimize=True)
        print(f"  → {out.name} (maskable {size}×{size}, {out.stat().st_size // 1024} KB)")

def main():
    generate_base()
    make_variants()
    print(f"\n✅ {OUT_DIR}/ → {len(list(OUT_DIR.glob('*.png')))} PNG")

if __name__ == "__main__":
    main()
