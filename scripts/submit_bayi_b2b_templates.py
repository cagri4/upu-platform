#!/usr/bin/env python3
"""
B2B Portal WA template submission — Faz 4 (14 template, TR).

Template metinleri src/platform/bayi/events/templates.ts ile BİREBİR aynı
olmalı (çift kaynak riski: değişiklikte ikisini birden güncelle).

KULLANIM (canlı geçiş kararı sonrası, Çağrı onayıyla):
    WHATSAPP_ACCESS_TOKEN=... python3 scripts/submit_bayi_b2b_templates.py

Çıktı: scripts/bayi_b2b_templates_submission.json (id + PENDING status).
Onay 24-48 saat; onaylananlar templates.ts:APPROVED_NOTIFICATION_TEMPLATES
set'ine eklenir (sync scripti #91 pattern'i ile kontrol edilir).

NOT: upu_bayi_hosgeldin + upu_bayi_kampanya kategorisi MARKETING (Meta
pazarlama içeriğini UTILITY'de reddediyor); kalanlar UTILITY.
"""
import json
import os
import sys
import urllib.request

TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
WABA_ID = "2102998087158466"  # Assistant UPU (production)
API = "https://graph.facebook.com/v23.0"

# name -> { category, text, example[] }  (TR-only — Faz 4 kapsamı)
TEMPLATES = {
    "upu_bayi_hosgeldin": {
        "category": "MARKETING",
        "text": "Merhaba {{1}}! 👋 {{2}} bayi portalına hoşgeldin. Kataloğu incele, kampanyaları gör, ilk siparişini birkaç dakikada ver.\n\nPortala git: {{3}}\n\n— UPU",
        "example": ["Yıldız Market", "Mehmet Gıda", "https://retailai.upudev.nl/tr/bayi"],
    },
    "upu_bayi_kampanya": {
        "category": "MARKETING",
        "text": "{{1}} yeni kampanya başlattı 🎉 {{2}}\n\nDetaylar ve sipariş: {{3}}\n\n— UPU",
        "example": ["Mehmet Gıda", "30 koli al 35 koli öde — A-segment, 1 hafta", "https://retailai.upudev.nl/tr/bayi/katalog"],
    },
    "upu_bayi_siparis_alindi": {
        "category": "UTILITY",
        "text": "Siparişin alındı ✅ #{{1}} — {{2}} tutarında. Dağıtıcı onayı sonrası tekrar bilgilendireceğiz.\n\nSipariş detayı: {{3}}\n\n— UPU",
        "example": ["202606-0042", "4.250,00 TL", "https://retailai.upudev.nl/tr/bayi/siparislerim"],
    },
    "upu_bayi_siparis_onay": {
        "category": "UTILITY",
        "text": "Siparişin onaylandı 🎉 #{{1}} hazırlığa alındı. {{2}}\n\nDetay: {{3}}\n\n— UPU",
        "example": ["202606-0042", "Tahmini teslim: 2-3 iş günü", "https://retailai.upudev.nl/tr/bayi/siparislerim"],
    },
    "upu_bayi_siparis_red": {
        "category": "UTILITY",
        "text": "Siparişin onaylanamadı ❌ #{{1}} — Sebep: {{2}}\n\nDetay ve tekrar sipariş: {{3}}\n\n— UPU",
        "example": ["202606-0042", "Stok yetersiz", "https://retailai.upudev.nl/tr/bayi/siparislerim"],
    },
    "upu_bayi_kargo": {
        "category": "UTILITY",
        "text": "Kargon yola çıktı 🚚 #{{1}} — {{2}} takip numarası: {{3}}\n\nCanlı takip: {{4}}\n\n— UPU",
        "example": ["202606-0042", "Aras Kargo", "ARS1234567890", "https://kargotakip.araskargo.com.tr"],
    },
    "upu_bayi_vade_yaklasti": {
        "category": "UTILITY",
        "text": "Hatırlatma: {{1}} numaralı faturanın vadesine {{2}} kaldı. Tutar: {{3}}\n\nÖdeme seçenekleri: {{4}}\n\n— UPU",
        "example": ["MCK-202606-000042", "3 gün", "15.000,00 TL", "https://retailai.upudev.nl/tr/bayi/faturalarim"],
    },
    "upu_bayi_vade_gecti": {
        "category": "UTILITY",
        "text": "Önemli: {{1}} numaralı faturanın vadesi geçti. Tutar: {{2}}\n\nLütfen en kısa sürede ödemeni yap: {{3}}\n\n— UPU",
        "example": ["MCK-202606-000042", "15.000,00 TL", "https://retailai.upudev.nl/tr/bayi/faturalarim"],
    },
    "upu_bayi_fatura": {
        "category": "UTILITY",
        "text": "Faturan hazır 🧾 {{1}} — Tutar: {{2}}, vade: {{3}}\n\nPDF indir: {{4}}\n\n— UPU",
        "example": ["MCK-202606-000042", "4.250,00 TL", "10.07.2026", "https://retailai.upudev.nl/tr/bayi/faturalarim"],
    },
    "upu_bayi_odeme_tesekkur": {
        "category": "UTILITY",
        "text": "Ödemen alındı, teşekkürler 🙏 {{1}} tutarındaki ödemen işlendi.\n\nGüncel hesabın: {{2}}\n\n— UPU",
        "example": ["4.250,00 TL", "https://retailai.upudev.nl/tr/bayi/faturalarim"],
    },
    "upu_dagitici_yeni_siparis": {
        "category": "UTILITY",
        "text": "Yeni sipariş 📦 {{1}} bayisinden #{{2}} — {{3}} tutarında.\n\nİncele ve onayla: {{4}}\n\n— UPU",
        "example": ["Yıldız Market", "202606-0042", "4.250,00 TL", "https://retailai.upudev.nl/tr/dagitici-panel/siparisler"],
    },
    "upu_dagitici_onay_bekleyen": {
        "category": "UTILITY",
        "text": "Hatırlatma: {{1}} sipariş onayını bekliyor.\n\nSipariş kuyruğu: {{2}}\n\n— UPU",
        "example": ["5", "https://retailai.upudev.nl/tr/dagitici-panel/siparisler"],
    },
    "upu_dagitici_kritik_stok": {
        "category": "UTILITY",
        "text": "Kritik stok ⚠️ {{1}} — kalan: {{2}}.\n\nStok yönetimi: {{3}}\n\n— UPU",
        "example": ["Spagetti 500g (SP-500)", "8 koli", "https://retailai.upudev.nl/tr/dagitici-panel/urunler"],
    },
    "upu_dagitici_geciken": {
        "category": "UTILITY",
        "text": "Günlük tahsilat raporu: {{1}} bayinin vadesi geçmiş, toplam {{2}}.\n\nDetaylar: {{3}}\n\n— UPU",
        "example": ["3", "42.500,00 TL", "https://retailai.upudev.nl/tr/dagitici-panel/bayiler"],
    },
}


def build_payload(name: str, body: dict) -> dict:
    return {
        "name": name,
        "language": "tr",
        "category": body["category"],
        "components": [
            {
                "type": "BODY",
                "text": body["text"],
                "example": {"body_text": [body["example"]]},
            }
        ],
    }


def submit(payload: dict) -> dict:
    url = f"{API}/{WABA_ID}/message_templates"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return {"ok": True, "response": json.loads(r.read())}
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": json.loads(e.read())}


def main():
    if not TOKEN:
        print("WHATSAPP_ACCESS_TOKEN env gerekli.", file=sys.stderr)
        sys.exit(1)
    results = []
    for name, body in TEMPLATES.items():
        payload = build_payload(name, body)
        result = submit(payload)
        results.append({"template": name, "lang": "tr", **result})
        status = result.get("response", {}).get("status") if result.get("ok") else "ERROR"
        print(f"{name}: {status}")
    out = os.path.join(os.path.dirname(__file__), "bayi_b2b_templates_submission.json")
    with open(out, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nSonuç: {out}")


if __name__ == "__main__":
    main()
