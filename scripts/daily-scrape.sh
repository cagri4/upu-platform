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

# 1. Cookie'leri yenile
cd "$PROJECT_DIR"
COOKIE_OUT=$($NODE scripts/export-cookies.mjs 2>&1)
COOKIE_EXIT=$?

if [ $COOKIE_EXIT -ne 0 ]; then
  echo "$DATE — ❌ Cookie yenileme BAŞARISIZ" >> "$LOG_FILE"
  echo "  $COOKIE_OUT" >> "$LOG_FILE"
  exit 1
fi

COOKIE_COUNT=$(echo "$COOKIE_OUT" | grep -oP '\d+ cookie' | head -1)
echo "$DATE — ✅ Cookie: $COOKIE_COUNT" >> "$LOG_FILE"

# 2. Scrape V3 — partiye göre URL seçimi (38 URL toplam, sadece sahibi)
# Daily leads pipeline: sahibi ilanları 3 partide çekilir
# part1: ilk 13, part2: 13-26, part3: 26-38
SCRAPE_ARGS="--days=1 --sahibi-only"
if [ "$PART" = "part1" ]; then
  SCRAPE_ARGS="$SCRAPE_ARGS --take=13"
elif [ "$PART" = "part2" ]; then
  SCRAPE_ARGS="$SCRAPE_ARGS --skip=13 --take=13"
elif [ "$PART" = "part3" ]; then
  SCRAPE_ARGS="$SCRAPE_ARGS --skip=26"
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

# 4. Cleanup + notifications (sadece son partide, günde 1 kez)
# Not: 7-gün rolling cleanup zaten import-v3.mjs içinde yapılıyor.
if [ "$PART" = "part3" ] || [ "$PART" = "full" ]; then
  echo "$(date '+%Y-%m-%d %H:%M') — 🧹 Cleanup: import-v3 içinde halledildi (7 gün+ eski snapshot'lar)" >> "$LOG_FILE"

  # 5. Phone enrichment: bugünün snapshot'ındaki tüm sahibi ilanların
  # detay sayfasından owner_phone + owner_name çekilir. 06:45'teki morning
  # brief'ten önce tamamlanmış olması gerekir ki ilk mesaj eksiksiz gitsin.
  ENRICH_OUT=$($NODE scripts/enrich-phones.mjs --limit=500 2>&1 | tail -10)
  echo "$(date '+%Y-%m-%d %H:%M') — 📞 Enrich:" >> "$LOG_FILE"
  echo "$ENRICH_OUT" | sed 's/^/    /' >> "$LOG_FILE"

  # 6. Tracking notifications
  DEPLOY_URL="${DEPLOY_URL:-https://upu-platform.vercel.app}"
  NOTIFY_OUT=$(curl -s "${DEPLOY_URL}/api/cron/tracking-notify" 2>&1)
  echo "$(date '+%Y-%m-%d %H:%M') — 🔔 Takip bildirimi: $NOTIFY_OUT" >> "$LOG_FILE"
fi
