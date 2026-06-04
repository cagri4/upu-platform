"""
WA Templates retry #2

UTILITY (upu_panel_link) — INCORRECT_CATEGORY hatası için wording'i
"user-requested transactional" tonuna çek: "Talep ettiğiniz" / "Your requested" /
"Aangevraagde". Authentication-flow ya da account access bağlamı vurgu.

OTP NL — "Kopiëren" reject oldu (ë karakteri).
ASCII "Kopieren" (umlautsuz) dene.
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


PANEL_LINK_BY_LANG = {
    "tr": {
        "text": (
            "Merhaba {{1}}, hesabınıza giriş için talep ettiğiniz bağlantı hazırlandı.\n\n"
            "{{2}} paneline erişmek için:\n{{3}}\n\n"
            "Bu güvenli bağlantı {{4}} saat geçerlidir. Süre dolduğunda panelden yeniden talep "
            "edebilirsiniz. Güvenliğiniz için bağlantıyı kimseyle paylaşmayın."
        ),
        "example": ["Ahmet", "Bayi Paneli", "https://app.upu.dev/p/abc123", "24"],
    },
    "en": {
        "text": (
            "Hello {{1}}, the access link you requested has been prepared.\n\n"
            "To access your {{2}}:\n{{3}}\n\n"
            "This secure link is valid for {{4}} hours. After expiration you may request a new "
            "one from the panel. For your security, do not share this link with anyone."
        ),
        "example": ["Ahmet", "Dealer Panel", "https://app.upu.dev/p/abc123", "24"],
    },
    "nl": {
        "text": (
            "Hallo {{1}}, de aangevraagde toegangslink is gereed.\n\n"
            "Om je {{2}} te openen:\n{{3}}\n\n"
            "Deze beveiligde link is {{4}} uur geldig. Na het verstrijken kun je een nieuwe link "
            "aanvragen via het paneel. Deel deze link voor je eigen veiligheid met niemand."
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


def build_otp_nl_ascii() -> dict:
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
                    {"type": "OTP", "otp_type": "COPY_CODE", "text": "Kopieren"}
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

    for lang_code, body in PANEL_LINK_BY_LANG.items():
        payload = build_panel_link(lang_code, body)
        print(f"\n[retry2] upu_panel_link / {lang_code} ({len(body['text'])} chars)")
        resp = submit(payload)
        print(json.dumps(resp, ensure_ascii=False, indent=2))
        results.append({"template": "upu_panel_link", "lang": lang_code, "response": resp})

    payload = build_otp_nl_ascii()
    print(f"\n[retry2] upu_otp_giris / nl (button='Kopieren' ASCII)")
    resp = submit(payload)
    print(json.dumps(resp, ensure_ascii=False, indent=2))
    results.append({"template": "upu_otp_giris", "lang": "nl", "response": resp})

    out = ROOT / "scripts/wa_templates_retry2.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[done] saved: {out}")


if __name__ == "__main__":
    main()
