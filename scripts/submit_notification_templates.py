"""
Meta WhatsApp Business — generic bildirim template'leri (tüm SaaS'a ortak).

4 UTILITY template, hepsi değişkenlerle her SaaS'ta kullanılabilir:
  1. upu_yeni_kayit       — panele yeni kayıt geldi
  2. upu_bekleyen_islem   — ilgilenilmesi gereken iş var
  3. upu_durum_guncelleme — bir kaydın durumu değişti (link yok)
  4. upu_gunluk_ozet      — günlük panel özeti

Kurallar:
- Panel linki BODY'de değişken (upu_panel_erisim ile aynı kanıtlanmış yöntem) —
  URL butonu yok çünkü paneller farklı subdomain'de, Meta buton URL'inde
  subdomain değişkenine izin vermiyor.
- Meta kuralı: değişken metnin BAŞINDA veya SONUNDA olamaz → her template sabit
  bir etiketle başlar ("Bildirim:" vb.) ve "— UPU" imzasıyla biter.
- Kelimeler kuru/işlevsel (Marketing'e reclassify edilmesin). Dil: TR + EN + NL.
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

# name -> { lang -> { text, example[] } }
TEMPLATES = {
    "upu_yeni_kayit": {
        "tr": {
            "text": "Bildirim: {{1}} panelinize yeni {{2}} geldi — {{3}}\n\nGörüntülemek için: {{4}}\n\n— UPU",
            "example": ["Emlak", "talep", "Ahmet B. — 3+1 daire arıyor", "https://estateai.upudev.nl/tr/panel"],
        },
        "en": {
            "text": "Notification: New {{2}} in your {{1}} panel — {{3}}\n\nView it here: {{4}}\n\n— UPU",
            "example": ["Real Estate", "request", "Ahmet B. — looking for 3+1", "https://estateai.upudev.nl/en/panel"],
        },
        "nl": {
            "text": "Melding: Nieuwe {{2}} in je {{1}}-paneel — {{3}}\n\nBekijk hier: {{4}}\n\n— UPU",
            "example": ["Vastgoed", "aanvraag", "Ahmet B. — zoekt 3+1", "https://estateai.upudev.nl/nl/panel"],
        },
    },
    "upu_bekleyen_islem": {
        "tr": {
            "text": "Hatırlatma: {{1}} panelinizde {{2}} ilginizi bekliyor.\n\nPanelinize gidin: {{3}}\n\n— UPU",
            "example": ["Bayi", "5 onaysız sipariş", "https://retailai.upudev.nl/tr/bayi-panel"],
        },
        "en": {
            "text": "Reminder: {{2}} awaiting your attention in your {{1}} panel.\n\nGo to your panel: {{3}}\n\n— UPU",
            "example": ["Dealer", "5 unapproved orders", "https://retailai.upudev.nl/en/bayi-panel"],
        },
        "nl": {
            "text": "Herinnering: {{2}} wacht op je in je {{1}}-paneel.\n\nGa naar je paneel: {{3}}\n\n— UPU",
            "example": ["Dealer", "5 niet-goedgekeurde bestellingen", "https://retailai.upudev.nl/nl/bayi-panel"],
        },
    },
    "upu_durum_guncelleme": {
        "tr": {
            "text": "Güncelleme: {{1}} — {{2}} durumu artık {{3}}.\n\n— UPU",
            "example": ["Otel", "Rezervasyon #45", "Onaylandı"],
        },
        "en": {
            "text": "Update: {{1}} — {{2}} status is now {{3}}.\n\n— UPU",
            "example": ["Hotel", "Reservation #45", "Confirmed"],
        },
        "nl": {
            "text": "Update: {{1}} — status van {{2}} is nu {{3}}.\n\n— UPU",
            "example": ["Hotel", "Reservering #45", "Bevestigd"],
        },
    },
    "upu_gunluk_ozet": {
        "tr": {
            "text": "Günlük özet — {{1}}: {{2}}\n\nPanelinize gidin: {{3}}\n\n— UPU",
            "example": ["Site Yönetimi", "2 yeni talep, 4 aidat ödendi, 1 toplantı", "https://residenceai.upudev.nl/tr/site"],
        },
        "en": {
            "text": "Daily summary — {{1}}: {{2}}\n\nGo to your panel: {{3}}\n\n— UPU",
            "example": ["Building Mgmt", "2 new requests, 4 dues paid, 1 meeting", "https://residenceai.upudev.nl/en/site"],
        },
        "nl": {
            "text": "Dagoverzicht — {{1}}: {{2}}\n\nGa naar je paneel: {{3}}\n\n— UPU",
            "example": ["Beheer", "2 nieuwe aanvragen, 4 contributies betaald, 1 vergadering", "https://residenceai.upudev.nl/nl/site"],
        },
    },
}


def build_payload(name: str, lang_code: str, body: dict) -> dict:
    return {
        "name": name,
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
    for name, by_lang in TEMPLATES.items():
        for lang_code, body in by_lang.items():
            payload = build_payload(name, lang_code, body)
            print(f"\n[submit] {name} / {lang_code}")
            resp = submit(payload)
            ok = "id" in resp
            status = resp.get("status", resp.get("error", {}).get("error_user_msg", resp.get("error", {}).get("message", "?")))
            print(f"  -> {'OK' if ok else 'FAIL'} | {resp.get('id', '')} {status}")
            results.append({"template": name, "lang": lang_code, "ok": ok, "response": resp})

    out = ROOT / "scripts/notification_templates_submission.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    n_ok = sum(1 for r in results if r["ok"])
    print(f"\n[done] {n_ok}/{len(results)} OK — saved: {out}")


if __name__ == "__main__":
    main()
