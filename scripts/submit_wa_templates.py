"""
Meta WhatsApp Business Templates — başvuru script'i

Submit edilenler:
1. upu_panel_link (UTILITY)  TR + EN + NL — magic-link bağlantısı
2. upu_otp_giris  (AUTHENTICATION, modern OTP) TR + EN + NL — 6 haneli giriş kodu

NOT: AUTHENTICATION kategorisinde Meta'nın modern formatında body text otomatik
üretilir (add_security_recommendation=true). COPY_CODE button ile kullanıcı
kodu tek tuşla kopyalar. Brief'teki custom text yerine bu hızlı onaylı format
kullanılır (dakikalar içinde aktif). UTILITY 1-3 iş günü beklenecek.
"""

import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env.production.local")

TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
WABA_ID = "2102998087158466"  # Assistant UPU (production)
API = "https://graph.facebook.com/v23.0"

# --- TEMPLATE 1: upu_panel_link (UTILITY) ---

PANEL_LINK_BY_LANG = {
    "tr": {
        "text": "Merhaba {{1}}, {{2}} paneliniz için bağlantı: {{3}}\n\nLink {{4}} saat geçerli.",
        "example": ["Ahmet", "Bayi Paneli", "https://app.upu.dev/p/abc123", "24"],
    },
    "en": {
        "text": "Hello {{1}}, your link to {{2}}: {{3}}\n\nValid for {{4}} hours.",
        "example": ["Ahmet", "Dealer Panel", "https://app.upu.dev/p/abc123", "24"],
    },
    "nl": {
        "text": "Hallo {{1}}, je link naar {{2}}: {{3}}\n\n{{4}} uur geldig.",
        "example": ["Ahmet", "Dealer Paneel", "https://app.upu.dev/p/abc123", "24"],
    },
}


def build_panel_link_payload(lang_code: str, body: dict) -> dict:
    return {
        "name": "upu_panel_link",
        "language": lang_code,
        "category": "UTILITY",
        "components": [
            {
                "type": "BODY",
                "text": body["text"],
                "example": {"body_text": [body["example"]]},
            },
        ],
    }


# --- TEMPLATE 2: upu_otp_giris (AUTHENTICATION modern format) ---

OTP_BUTTON_TEXT = {"tr": "Kodu Kopyala", "en": "Copy Code", "nl": "Kopieer Code"}


def build_otp_payload(lang_code: str) -> dict:
    return {
        "name": "upu_otp_giris",
        "language": lang_code,
        "category": "AUTHENTICATION",
        "components": [
            {
                "type": "BODY",
                "add_security_recommendation": True,
            },
            {
                "type": "FOOTER",
                "code_expiration_minutes": 10,
            },
            {
                "type": "BUTTONS",
                "buttons": [
                    {
                        "type": "OTP",
                        "otp_type": "COPY_CODE",
                        "text": OTP_BUTTON_TEXT[lang_code],
                    }
                ],
            },
        ],
    }


def submit(payload: dict) -> dict:
    url = f"{API}/{WABA_ID}/message_templates"
    r = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    return r.json()


def main():
    if not TOKEN:
        print("ERROR: WHATSAPP_ACCESS_TOKEN missing")
        sys.exit(1)

    results = []
    for lang_code, body in PANEL_LINK_BY_LANG.items():
        payload = build_panel_link_payload(lang_code, body)
        print(f"\n[submit] upu_panel_link / {lang_code}")
        resp = submit(payload)
        print(json.dumps(resp, ensure_ascii=False, indent=2))
        results.append({"template": "upu_panel_link", "lang": lang_code, "response": resp})

    for lang_code in ["tr", "en", "nl"]:
        payload = build_otp_payload(lang_code)
        print(f"\n[submit] upu_otp_giris / {lang_code}")
        resp = submit(payload)
        print(json.dumps(resp, ensure_ascii=False, indent=2))
        results.append({"template": "upu_otp_giris", "lang": lang_code, "response": resp})

    out = ROOT / "scripts/wa_templates_submission.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[done] saved: {out}")


if __name__ == "__main__":
    main()
