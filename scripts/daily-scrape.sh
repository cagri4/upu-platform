#!/bin/bash
# Günlük Sahibinden Scraper V3 — 3 Partili Cron Job
#
# Parti 1: Gece 03:00 → İlk 25 URL
# Parti 2: Gece 04:30 → Sonraki 25 URL
# Parti 3: Gece 06:00 → Son 26 URL
#
# Kullanım:
#   ./daily-scrape.sh          → Tüm URL'ler
#   ./daily-scrape.sh part1    → İlk 25 URL
#   ./daily-scrape.sh part2    → Sonraki 25 URL
#   ./daily-scrape.sh part3    → Son 26 URL

export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"

PROJECT_DIR="/home/cagr/Masaüstü/upu-platform"
PART="${1:-full}"

if [ -f "$PROJECT_DIR/.env.local" ]; then
  export SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL "$PROJECT_DIR/.env.local" | cut -d= -f2)
  export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY "$PROJECT_DIR/.env.local" | cut -d= -f2)
fi

LOG_FILE="$PROJECT_DIR/scrape-log.txt"
SCRAPE_DETAIL="$PROJECT_DIR/scripts/output/scrape-detail-${PART}.log"
NODE=$(which node)
DATE=$(date '+%Y-%m-%d %H:%M')

echo "───────────────────────────────" >> "$LOG_FILE"
echo "$DATE — Başlatılıyor [$PART]" >> "$LOG_FILE"

cd "$PROJECT_DIR"

# 1. Chrome debug check → varsa connect mode (gerçek user session, anti-bot
# bypass). Yoksa eski cookie + headless launch akışına düş.
if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:9222/json/version"; then
  CONNECT_FLAG="--connect-running"
  echo "$DATE — 🔗 Chrome debug aktif (9222) → connect mode" >> "$LOG_FILE"
else
  CONNECT_FLAG=""
  echo "$DATE — ⚠️ Chrome debug yok (9222) → launch fallback (cookie refresh)" >> "$LOG_FILE"

  # Launch fallback için cookie'leri yenile (connect mode'da gerek yok)
  COOKIE_OUT=$($NODE scripts/export-cookies.mjs 2>&1)
  COOKIE_EXIT=$?
  if [ $COOKIE_EXIT -ne 0 ]; then
    echo "$DATE — ❌ Cookie yenileme BAŞARISIZ" >> "$LOG_FILE"
    echo "  $COOKIE_OUT" >> "$LOG_FILE"
    exit 1
  fi
  COOKIE_COUNT=$(echo "$COOKIE_OUT" | grep -oP '\d+ cookie' | head -1)
  echo "$DATE — ✅ Cookie: $COOKIE_COUNT" >> "$LOG_FILE"
fi

# 2. Scrape V3 — partiye göre URL seçimi (23 URL toplam, sadece sahibi)
# Daily leads pipeline: sahibi ilanları 3 partide çekilir
# part1: ilk 8, part2: 8-16, part3: 16-23
SCRAPE_ARGS="--days=1 --sahibi-only $CONNECT_FLAG"

# Part1 her gün taze başlamalı: yesterday'in progress file'ı varsa sil.
# (scrape-v3.mjs persistent PROGRESS_FILE kullanıyor, gün sonunda reset
# etmediği için günü atlatıp eski veriyi tekrar import ediyordu.)
if [ "$PART" = "part1" ] || [ "$PART" = "full" ]; then
  rm -f "$PROJECT_DIR/scripts/output/v3-progress.json" "$PROJECT_DIR/scripts/output/v3-bodrum.json"
  echo "$(date '+%Y-%m-%d %H:%M') — 🗑️  Progress reset (taze scrape için)" >> "$LOG_FILE"
fi

if [ "$PART" = "part1" ]; then
  SCRAPE_ARGS="$SCRAPE_ARGS --take=8"
elif [ "$PART" = "part2" ]; then
  SCRAPE_ARGS="$SCRAPE_ARGS --skip=8 --take=8"
elif [ "$PART" = "part3" ]; then
  SCRAPE_ARGS="$SCRAPE_ARGS --skip=16"
fi

$NODE scripts/scrape-v3.mjs $SCRAPE_ARGS > "$SCRAPE_DETAIL" 2>&1
SCRAPE_EXIT=$?

TOTAL=$(grep -oP 'Toplam: \K\d+' "$SCRAPE_DETAIL")
URL_DONE=$(grep -oP 'URL tamamlanan: \K\d+/\d+' "$SCRAPE_DETAIL")
BLOCKED=$(grep -c "Engel\|Giriş duvarı\|IP engeli" "$SCRAPE_DETAIL")

DATE2=$(date '+%Y-%m-%d %H:%M')
if [ $SCRAPE_EXIT -ne 0 ] || [ "$BLOCKED" -gt 0 ]; then
  echo "$DATE2 — ⚠️ Scrape [$PART] TAMAMLANMADI — $URL_DONE URL, $TOTAL ilan" >> "$LOG_FILE"
  grep -E "❌|⚠️|Engel|blocked" "$SCRAPE_DETAIL" >> "$LOG_FILE" 2>/dev/null
else
  echo "$DATE2 — ✅ Scrape [$PART] OK — $URL_DONE URL, $TOTAL ilan" >> "$LOG_FILE"
fi

# 3. DB'ye import (V3)
if [ -n "$TOTAL" ] && [ "$TOTAL" -gt 0 ] 2>/dev/null; then
  IMPORT_OUT=$($NODE scripts/import-v3.mjs 2>&1)
  IMPORT_EXIT=$?
  DATE3=$(date '+%Y-%m-%d %H:%M')

  INSERTED=$(echo "$IMPORT_OUT" | grep -oP 'Eklenen: \K\d+')
  SKIPPED=$(echo "$IMPORT_OUT" | grep -oP 'Atlanan.*: \K\d+')
  IMPORT_ERR=$(echo "$IMPORT_OUT" | grep -oP 'Hata: \K\d+')

  if [ $IMPORT_EXIT -eq 0 ]; then
    echo "$DATE3 — ✅ DB Import [$PART]: +$INSERTED yeni, $SKIPPED duplicate, $IMPORT_ERR hata" >> "$LOG_FILE"
  else
    echo "$DATE3 — ❌ DB Import [$PART] BAŞARISIZ" >> "$LOG_FILE"
    echo "  $IMPORT_OUT" | tail -5 >> "$LOG_FILE"
  fi
else
  echo "$(date '+%Y-%m-%d %H:%M') — ⏭️ DB Import atlandı (ilan yok)" >> "$LOG_FILE"
fi

# 4. Cleanup (sadece son partide, günde 1 kez)
# Not: today-only retention import-v3.mjs içinde yapılıyor
# (DELETE WHERE snapshot_date < CURRENT_DATE).
# Enrich adımı KALDIRILDI — kullanıcı sahibinden linkine tıklayıp telefonu
# kendi hesabından görecek. IP block/anti-bot sorununu bu şekilde aşıyoruz.
if [ "$PART" = "part3" ] || [ "$PART" = "full" ]; then
  echo "$(date '+%Y-%m-%d %H:%M') — 🧹 Cleanup: import-v3 içinde today-only retention uygulandı" >> "$LOG_FILE"

  # 6. Tracking notifications
  DEPLOY_URL="${DEPLOY_URL:-https://upu-platform.vercel.app}"
  NOTIFY_OUT=$(curl -s "${DEPLOY_URL}/api/cron/tracking-notify" 2>&1)
  echo "$(date '+%Y-%m-%d %H:%M') — 🔔 Takip bildirimi: $NOTIFY_OUT" >> "$LOG_FILE"

  # 7. Sabah özet rapor — admin'e WA bildirimi
  if [ -f "$PROJECT_DIR/.env.production.local" ] && [ -z "$CRON_SECRET" ]; then
    CRON_SECRET=$(grep ^CRON_SECRET "$PROJECT_DIR/.env.production.local" | cut -d= -f2 | tr -d '"')
  fi
  REPORT_OUT=$(curl -s -H "Authorization: Bearer ${CRON_SECRET}" "${DEPLOY_URL}/api/cron/scrape-report" 2>&1)
  echo "$(date '+%Y-%m-%d %H:%M') — 📤 Sabah raporu: $REPORT_OUT" >> "$LOG_FILE"
fi

# 7. 5-imza monitoring — bug sinyali tetiklenirse WA admin'e alert
bash "$PROJECT_DIR/scripts/monitor-scrape.sh" "$PART" >> "$LOG_FILE" 2>&1
