"""
upu_panel_link — MARKETING kategorisi ile yeniden submit (3 dil)
Brief'in orijinal kısa içeriği. Reject olursa otomatik genişlet+retry.
"""

import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env.production.local")

TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
WABA_ID = "2102998087158466"
API = "https://graph.facebook.com/v23.0"

# Brief orijinal (kısa) içerik
PANEL_LINK_SHORT = {
    "tr": {
        "text": (
            "Merhaba {{1}}, {{2}} paneliniz için bağlantı: {{3}}\n\n"
            "Link {{4}} saat geçerli."
        ),
        "example": ["Ahmet", "Bayi Paneli", "https://app.upu.dev/p/abc123", "24"],
    },
    "en": {
        "text": (
            "Hello {{1}}, your link to {{2}}: {{3}}\n\nValid for {{4}} hours."
        ),
        "example": ["Ahmet", "Dealer Panel", "https://app.upu.dev/p/abc123", "24"],
    },
    "nl": {
        "text": (
            "Hallo {{1}}, je link naar {{2}}: {{3}}\n\n{{4}} uur geldig."
        ),
        "example": ["Ahmet", "Dealer Paneel", "https://app.upu.dev/p/abc123", "24"],
    },
}

# Reject olursa kullanılacak genişletilmiş içerik
PANEL_LINK_LONG = {
    "tr": {
        "text": (
            "Merhaba {{1}}, hesabınıza giriş için kişisel bağlantınız hazır.\n\n"
            "{{2}} paneline erişmek için: {{3}}\n\n"
            "Bu bağlantı {{4}} saat boyunca geçerlidir. Süresi dolduğunda yenisini "
            "talep edebilirsiniz. Güvenliğiniz için kimseyle paylaşmayın."
        ),
        "example": ["Ahmet", "Bayi Paneli", "https://app.upu.dev/p/abc123", "24"],
    },
    "en": {
        "text": (
            "Hello {{1}}, your personal access link is ready.\n\n"
            "To enter your {{2}}: {{3}}\n\n"
            "This link is valid for {{4}} hours. You can request a new one when it "
            "expires. For your security, do not share it with anyone."
        ),
        "example": ["Ahmet", "Dealer Panel", "https://app.upu.dev/p/abc123", "24"],
    },
    "nl": {
        "text": (
            "Hallo {{1}}, je persoonlijke toegangslink is gereed.\n\n"
            "Om je {{2}} te openen: {{3}}\n\n"
            "Deze link is {{4}} uur geldig. Je kunt na het verstrijken een nieuwe "
            "aanvragen. Deel deze link voor je veiligheid met niemand."
        ),
        "example": ["Ahmet", "Dealer Paneel", "https://app.upu.dev/p/abc123", "24"],
    },
}


def build_payload(lang_code: str, body: dict) -> dict:
    return {
        "name": "upu_panel_link",
        "language": lang_code,
        "category": "MARKETING",
        "components": [
            {
                "type": "BODY",
                "text": body["text"],
                "example": {"body_text": [body["example"]]},
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


def poll_status(template_id: str, max_wait_sec: int = 180) -> dict:
    deadline = time.time() + max_wait_sec
    while time.time() < deadline:
        r = requests.get(
            f"{API}/{template_id}",
            params={"access_token": TOKEN, "fields": "id,name,language,status,category,rejected_reason"},
            timeout=15,
        )
        data = r.json()
        status = data.get("status")
        if status in ("APPROVED", "REJECTED"):
            return data
        print(f"  ... {status}, polling...")
        time.sleep(5)
    return {"status": "TIMEOUT", "id": template_id}


def main():
    results = []
    for lang_code in ["tr", "en", "nl"]:
        body = PANEL_LINK_SHORT[lang_code]
        print(f"\n[submit MARKETING short] upu_panel_link / {lang_code} ({len(body['text'])} chars)")
        resp = submit(build_payload(lang_code, body))
        print(json.dumps(resp, ensure_ascii=False, indent=2))

        # değişken/karakter oranı hatası ise long ile retry
        err_sub = resp.get("error", {}).get("error_subcode")
        if err_sub == 2388293:
            print(f"  → ratio limit, retry with LONG body...")
            body = PANEL_LINK_LONG[lang_code]
            print(f"[submit MARKETING long] / {lang_code} ({len(body['text'])} chars)")
            resp = submit(build_payload(lang_code, body))
            print(json.dumps(resp, ensure_ascii=False, indent=2))

        results.append({"lang": lang_code, "submit": resp})

        # Polling — pending ise dakikalar içinde sonuç bekle
        if resp.get("id"):
            print(f"  polling {resp['id']}...")
            poll = poll_status(resp["id"])
            print(f"  final status: {poll.get('status')}, category: {poll.get('category')}")
            if poll.get("rejected_reason"):
                print(f"  reject reason: {poll['rejected_reason']}")
            results[-1]["final"] = poll

    out = ROOT / "scripts/wa_panel_link_marketing.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[done] saved: {out}")

    print("\n=== FINAL ===")
    for r in results:
        f = r.get("final") or r.get("submit", {})
        status = f.get("status") or f.get("error", {}).get("message", "?")
        print(f"  {r['lang']}: {status}  id={f.get('id', '-')}")


if __name__ == "__main__":
    main()
