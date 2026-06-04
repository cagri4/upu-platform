"""
WA Templates — başarısız olanları yeniden submit et.

Düzeltmeler:
- UTILITY (upu_panel_link): body text 3 dilde uzatıldı (değişken/karakter oranı için)
- AUTH (upu_otp_giris NL): button text "Kopieer Code" → "Kopiëren" (tek kelime, NL standart)
"""

import json
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env.production.local")

TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
WABA_ID = "2102998087158466"
API = "https://graph.facebook.com/v23.0"

# --- UTILITY: upu_panel_link — uzatılmış body ---
PANEL_LINK_BY_LANG = {
    "tr": {
        "text": (
            "Merhaba {{1}},\n\n"
            "{{2}} paneliniz için güvenli giriş bağlantınız hazır:\n\n"
            "{{3}}\n\n"
            "Bu bağlantı {{4}} saat boyunca geçerlidir. Süre dolduktan sonra yeni bir bağlantı "
            "talep etmeniz gerekir. Lütfen bu bağlantıyı kimseyle paylaşmayın."
        ),
        "example": ["Ahmet", "Bayi Paneli", "https://app.upu.dev/p/abc123", "24"],
    },
    "en": {
        "text": (
            "Hello {{1}},\n\n"
            "Your secure access link for {{2}} is ready:\n\n"
            "{{3}}\n\n"
            "This link is valid for {{4}} hours. After expiration you will need to request a new "
            "one. Please do not share this link with anyone."
        ),
        "example": ["Ahmet", "Dealer Panel", "https://app.upu.dev/p/abc123", "24"],
    },
    "nl": {
        "text": (
            "Hallo {{1}},\n\n"
            "Je veilige toegangslink voor {{2}} is klaar:\n\n"
            "{{3}}\n\n"
            "Deze link is {{4}} uur geldig. Na het verstrijken moet je een nieuwe link aanvragen. "
            "Deel deze link alstublieft met niemand."
        ),
        "example": ["Ahmet", "Dealer Paneel", "https://app.upu.dev/p/abc123", "24"],
    },
}


def build_panel_link(lang_code: str, body: dict) -> dict:
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


# --- AUTH NL retry: button text düzeltildi ---
def build_otp_nl() -> dict:
    return {
        "name": "upu_otp_giris",
        "language": "nl",
        "category": "AUTHENTICATION",
        "components": [
            {"type": "BODY", "add_security_recommendation": True},
            {"type": "FOOTER", "code_expiration_minutes": 10},
            {
                "type": "BUTTONS",
                "buttons": [
                    {
                        "type": "OTP",
                        "otp_type": "COPY_CODE",
                        "text": "Kopiëren",
                    }
                ],
            },
        ],
    }


def submit(payload: dict) -> dict:
    r = requests.post(
        f"{API}/{WABA_ID}/message_templates",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )
    return r.json()


def main():
    results = []

    # 1) UTILITY retry — 3 dil
    for lang_code, body in PANEL_LINK_BY_LANG.items():
        payload = build_panel_link(lang_code, body)
        print(f"\n[retry] upu_panel_link / {lang_code} (body length={len(body['text'])} chars)")
        resp = submit(payload)
        print(json.dumps(resp, ensure_ascii=False, indent=2))
        results.append({"template": "upu_panel_link", "lang": lang_code, "response": resp})

    # 2) AUTH NL retry — fixed button text
    payload = build_otp_nl()
    print(f"\n[retry] upu_otp_giris / nl (button='Kopiëren')")
    resp = submit(payload)
    print(json.dumps(resp, ensure_ascii=False, indent=2))
    results.append({"template": "upu_otp_giris", "lang": "nl", "response": resp})

    out = ROOT / "scripts/wa_templates_retry.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[done] saved: {out}")


if __name__ == "__main__":
    main()
