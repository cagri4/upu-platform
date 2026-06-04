"""
Meta Graph API'den 4 generic notification template'in TR+EN+NL durumlarını çek.

Çıktı:
  scripts/notification_templates_status.json  → her template_id için latest_status
                                                 (PENDING/APPROVED/REJECTED + ts)
  Stdout summary tablosu.

Kullanım:
  cd <repo>
  python scripts/check_template_status.py

Bağımlılık: notification_templates_submission.json (önce submit_notification_templates.py çalıştırılmış olmalı).
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env.production.local")

TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
API = "https://graph.facebook.com/v23.0"
SUBMISSION_FILE = ROOT / "scripts/notification_templates_submission.json"
STATUS_FILE = ROOT / "scripts/notification_templates_status.json"


def fetch_status(template_id: str) -> dict:
    """Tek bir template ID'sinin güncel status'unu döner."""
    r = requests.get(
        f"{API}/{template_id}",
        params={"fields": "id,name,language,status,category,quality_score,last_updated_time"},
        headers={"Authorization": f"Bearer {TOKEN}"},
        timeout=30,
    )
    try:
        return r.json()
    except Exception as e:
        return {"error": {"message": str(e), "http_status": r.status_code}}


def main():
    if not TOKEN:
        print("ERROR: WHATSAPP_ACCESS_TOKEN missing", file=sys.stderr)
        sys.exit(1)
    if not SUBMISSION_FILE.exists():
        print(f"ERROR: {SUBMISSION_FILE} not found — submit_notification_templates.py önce çalıştırılmalı", file=sys.stderr)
        sys.exit(1)

    submissions = json.loads(SUBMISSION_FILE.read_text(encoding="utf-8"))

    results = []
    checked_at = datetime.now(timezone.utc).isoformat()
    for s in submissions:
        tpl_id = (s.get("response") or {}).get("id")
        if not tpl_id:
            results.append({
                "template": s["template"],
                "lang": s["lang"],
                "id": None,
                "latest_status": "MISSING_ID",
                "checked_at": checked_at,
            })
            continue
        live = fetch_status(tpl_id)
        if "error" in live:
            results.append({
                "template": s["template"],
                "lang": s["lang"],
                "id": tpl_id,
                "latest_status": "API_ERROR",
                "error": live["error"],
                "checked_at": checked_at,
            })
            continue
        results.append({
            "template": s["template"],
            "lang": s["lang"],
            "id": tpl_id,
            "latest_status": live.get("status", "UNKNOWN"),
            "category": live.get("category"),
            "quality_score": live.get("quality_score"),
            "last_updated_time": live.get("last_updated_time"),
            "checked_at": checked_at,
        })

    STATUS_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    # Stdout özet
    print(f"\nKontrol: {checked_at}")
    print(f"Toplam: {len(results)} kayıt\n")
    print(f"{'Template':<25} {'Lang':<6} {'Status':<12} {'Quality':<10}")
    print("-" * 60)
    counts = {"APPROVED": 0, "PENDING": 0, "REJECTED": 0, "OTHER": 0}
    for r in results:
        status = r["latest_status"]
        bucket = status if status in counts else "OTHER"
        counts[bucket] += 1
        quality = (r.get("quality_score") or {}).get("score", "—") if isinstance(r.get("quality_score"), dict) else "—"
        print(f"{r['template']:<25} {r['lang']:<6} {status:<12} {quality}")
    print("-" * 60)
    for k, v in counts.items():
        if v:
            print(f"  {k}: {v}")
    print(f"\nKaydedildi: {STATUS_FILE}")

    # APPROVED listesini ayrıca ekle — runtime allowlist için manuel kopyalama
    approved_names = sorted({r["template"] for r in results if r["latest_status"] == "APPROVED"})
    if approved_names:
        print("\nAPPROVED template adları (templates.ts APPROVED_NOTIFICATION_TEMPLATES set'ine ekle):")
        for n in approved_names:
            print(f"  - {n}")


if __name__ == "__main__":
    main()
