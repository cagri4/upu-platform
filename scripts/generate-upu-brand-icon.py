"""
UPU Brand PWA Icon — mevcut WA bot avatarı + "UPU" yazısı.

Kullanıcı isteği: WA profil resmindeki mavi robot + "UPU" yazısı tek tasarım.
Tüm SaaS'larda (emlak/bayi/market/otel/restoran) PWA install için aynı icon.

PIL kompozit (gpt-image-1 yerine — daha hızlı + WA avatarıyla birebir tutarlı):
  - Bg: beyaz 1024×1024
  - Robot avatarı (mevcut /tmp/upu-bot-icon-v3.png) ~640×640, üst-merkez
  - "UPU" yazısı, bold sans-serif, FB blue (#1877F2), alt-merkez

Variants: 192/512/maskable-192/maskable-512/apple-touch-180/favicon-32
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "icons" / "app"
OUT_DIR.mkdir(parents=True, exist_ok=True)

ROBOT_SRC = Path("/tmp/upu-bot-icon-v3.png")
BASE = OUT_DIR / "icon-base-1024.png"

UPU_BLUE = (24, 119, 242, 255)  # Facebook blue (#1877F2)
WHITE = (255, 255, 255, 255)

def find_bold_font():
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            return c
    return None

def build_base():
    if not ROBOT_SRC.exists():
        print(f"Robot avatarı bulunamadı: {ROBOT_SRC}", file=sys.stderr)
        sys.exit(1)

    canvas = Image.new("RGBA", (1024, 1024), WHITE)

    # Robot avatarı: ~620x620, top-center
    robot = Image.open(ROBOT_SRC).convert("RGBA")
    robot.thumbnail((620, 620), Image.LANCZOS)
    rx = (1024 - robot.width) // 2
    ry = 80  # üst boşluk
    canvas.paste(robot, (rx, ry), robot)

    # "UPU" yazısı: alt-center, bold sans, FB blue
    font_path = find_bold_font()
    if not font_path:
        print("Bold font bulunamadı (dejavu/liberation/freefont).", file=sys.stderr)
        sys.exit(1)

    draw = ImageDraw.Draw(canvas)
    text = "UPU"
    font_size = 240
    font = ImageFont.truetype(font_path, font_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (1024 - tw) // 2 - bbox[0]
    ty = 1024 - th - 80 - bbox[1]  # alt 80px boşluk
    draw.text((tx, ty), text, fill=UPU_BLUE, font=font)

    canvas.save(BASE, "PNG", optimize=True)
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

    # Maskable: %80 safe zone padding (Android adaptive)
    for size in (192, 512):
        canvas = Image.new("RGBA", (size, size), WHITE)
        safe = int(size * 0.8)
        inner = base.copy()
        inner.thumbnail((safe, safe), Image.LANCZOS)
        offset = ((size - inner.width) // 2, (size - inner.height) // 2)
        canvas.paste(inner, offset, inner)
        out = OUT_DIR / f"icon-maskable-{size}.png"
        canvas.save(out, "PNG", optimize=True)
        print(f"  → {out.name} (maskable {size}×{size}, {out.stat().st_size // 1024} KB)")

def main():
    print("[base] kompozit oluşturuluyor (robot + UPU)...")
    build_base()
    print("[variants] PWA boyutları...")
    make_variants()
    print(f"\n✅ {OUT_DIR}/ → {len(list(OUT_DIR.glob('*.png')))} PNG")

if __name__ == "__main__":
    main()
