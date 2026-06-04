"""
upu_panel_link — allow_category_change=true ile submit.

INCORRECT_CATEGORY reddinin gerçek çözümü: Meta'ya kategori tercihini bildir
ama "değiştirebilirsin" izni ver. Meta içeriği analiz eder, uygun kategoriyi
(UTILITY/MARKETING) kendi atar ve onaylar.

Body: inline URL kalır (magic-link tenant'a göre değişken, sabit-base button uygun değil).
Uzun body kullanılır (kısa body değişken/karakter oranını aşıyor).
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

PANEL_LINK = {
    "tr": {
        "text": (
            "Merhaba {{1}}, hesabınıza giriş için kişisel bağlantınız hazır.\n\n"
            "{{2}} paneline erişmek için: {{3}}\n\n"
            "Bu bağlantı {{4}} saat boyunca geçerlidir. Süresi dolduğunda yenisini "
            "talep edebilirsiniz. Güvenliğiniz için kimseyle paylaşmayın."
        ),
        "example": ["Ahmet", "Bayi Paneli", "https://retailai.upudev.nl/tr/bayiler?t=abc123", "24"],
    },
    "en": {
        "text": (
            "Hello {{1}}, your personal access link is ready.\n\n"
            "To enter your {{2}}: {{3}}\n\n"
            "This link is valid for {{4}} hours. You can request a new one when it "
            "expires. For your security, do not share it with anyone."
        ),
        "example": ["Ahmet", "Dealer Panel", "https://retailai.upudev.nl/tr/bayiler?t=abc123", "24"],
    },
    "nl": {
        "text": (
            "Hallo {{1}}, je persoonlijke toegangslink is gereed.\n\n"
            "Om je {{2}} te openen: {{3}}\n\n"
            "Deze link is {{4}} uur geldig. Je kunt na het verstrijken een nieuwe "
            "aanvragen. Deel deze link voor je veiligheid met niemand."
        ),
        "example": ["Ahmet", "Dealer Paneel", "https://retailai.upudev.nl/tr/bayiler?t=abc123", "24"],
    },
}


def get_existing_panel_link_ids() -> list:
    r = requests.get(
        f"{API}/{WABA_ID}/message_templates",
        params={"access_token": TOKEN, "fields": "id,name,language,status", "limit": 100},
        timeout=15,
    )
    return [
        (t["id"], t["language"], t["status"])
        for t in r.json().get("data", [])
        if t.get("name") == "upu_panel_link"
    ]


def delete_template(template_id: str):
    r = requests.delete(
        f"{API}/{WABA_ID}/message_templates",
        params={"access_token": TOKEN, "hsm_id": template_id, "name": "upu_panel_link"},
        timeout=15,
    )
    return r.json()


def build_payload(lang_code: str, body: dict) -> dict:
    return {
        "name": "upu_panel_link",
        "language": lang_code,
        "category": "UTILITY",  # tercih; allow_category_change ile Meta override edebilir
        "allow_category_change": True,
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


def poll_status(template_id: str, max_wait_sec: int = 120) -> dict:
    deadline = time.time() + max_wait_sec
    while time.time() < deadline:
        r = requests.get(
            f"{API}/{template_id}",
            params={"access_token": TOKEN, "fields": "id,name,language,status,category,rejected_reason"},
            timeout=15,
        )
        data = r.json()
        if data.get("status") in ("APPROVED", "REJECTED"):
            return data
        print(f"    ... {data.get('status')}")
        time.sleep(5)
    return {"status": "TIMEOUT", "id": template_id}


def main():
    # 1) Mevcut (rejected) panel_link'leri sil
    existing = get_existing_panel_link_ids()
    print(f"Existing panel_link templates: {len(existing)}")
    for tid, lang, status in existing:
        resp = delete_template(tid)
        print(f"  DELETE {lang} ({status}) id={tid}: {resp}")
    if existing:
        print("  waiting 5s after deletion...")
        time.sleep(5)

    # 2) allow_category_change ile yeniden submit
    results = []
    for lang_code in ["tr", "en", "nl"]:
        body = PANEL_LINK[lang_code]
        print(f"\n[submit autocat] upu_panel_link / {lang_code} ({len(body['text'])} chars)")
        resp = submit(build_payload(lang_code, body))
        print(json.dumps(resp, ensure_ascii=False, indent=2))
        entry = {"lang": lang_code, "submit": resp}
        if resp.get("id"):
            print(f"  polling {resp['id']}...")
            entry["final"] = poll_status(resp["id"])
            print(f"  → {entry['final'].get('status')} / category={entry['final'].get('category')}")
            if entry["final"].get("rejected_reason"):
                print(f"  → reject: {entry['final']['rejected_reason']}")
        results.append(entry)

    out = ROOT / "scripts/wa_panel_link_autocat.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[saved] {out}")

    print("\n=== FINAL ===")
    for r in results:
        f = r.get("final") or r.get("submit", {})
        status = f.get("status") or f.get("error", {}).get("message", "?")
        cat = f.get("category", "-")
        print(f"  {r['lang']}: {status} (category={cat}) id={f.get('id', '-')}")


if __name__ == "__main__":
    main()
