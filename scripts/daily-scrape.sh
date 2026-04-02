#!/bin/bash
# Günlük Sahibinden Scraper — Cron Job
# Her gece 03:00'te çalışır

# Cron ortamında GNOME Keyring erişimi için D-Bus gerekli
export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"

PROJECT_DIR="/home/cagr/Masaüstü/upu-platform"

# Supabase credentials (env file)
if [ -f "$PROJECT_DIR/.env.local" ]; then
  export SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL "$PROJECT_DIR/.env.local" | cut -d= -f2)
  export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY "$PROJECT_DIR/.env.local" | cut -d= -f2)
fi
LOG_FILE="$PROJECT_DIR/scrape-log.txt"
SCRAPE_DETAIL="$PROJECT_DIR/scripts/output/scrape-detail.log"
NODE=$(which node)
DATE=$(date '+%Y-%m-%d %H:%M')

echo "───────────────────────────────" >> "$LOG_FILE"
echo "$DATE — Başlatılıyor" >> "$LOG_FILE"

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

# 2. Daily scrape — çıktıyı dosyaya yaz (bellek taşmasını önle)
$NODE scripts/scrape-v2.mjs --days=2 > "$SCRAPE_DETAIL" 2>&1
SCRAPE_EXIT=$?

# Sonuçları parse et
TOTAL=$(grep -oP 'Toplam: \K\d+' "$SCRAPE_DETAIL")
URL_DONE=$(grep -oP 'URL tamamlanan: \K\d+/\d+' "$SCRAPE_DETAIL")
BLOCKED=$(grep -c "Engel\|Giriş duvarı\|IP engeli" "$SCRAPE_DETAIL")

DATE2=$(date '+%Y-%m-%d %H:%M')
if [ $SCRAPE_EXIT -ne 0 ] || [ "$BLOCKED" -gt 0 ]; then
  echo "$DATE2 — ⚠️ Scrape TAMAMLANMADI — $URL_DONE URL, $TOTAL ilan" >> "$LOG_FILE"
  grep -E "❌|⚠️|Engel|blocked" "$SCRAPE_DETAIL" >> "$LOG_FILE" 2>/dev/null
else
  echo "$DATE2 — ✅ Scrape OK — $URL_DONE URL, $TOTAL ilan" >> "$LOG_FILE"
fi

# 3. DB'ye import — scrape başarılı olduysa
if [ -n "$TOTAL" ] && [ "$TOTAL" -gt 0 ] 2>/dev/null; then
  IMPORT_OUT=$($NODE scripts/import-v2.mjs 2>&1)
  IMPORT_EXIT=$?
  DATE3=$(date '+%Y-%m-%d %H:%M')

  INSERTED=$(echo "$IMPORT_OUT" | grep -oP 'Eklenen: \K\d+')
  SKIPPED=$(echo "$IMPORT_OUT" | grep -oP 'Atlanan.*: \K\d+')
  IMPORT_ERR=$(echo "$IMPORT_OUT" | grep -oP 'Hata: \K\d+')

  if [ $IMPORT_EXIT -eq 0 ]; then
    echo "$DATE3 — ✅ DB Import: +$INSERTED yeni, $SKIPPED duplicate, $IMPORT_ERR hata" >> "$LOG_FILE"
  else
    echo "$DATE3 — ❌ DB Import BAŞARISIZ" >> "$LOG_FILE"
    echo "  $IMPORT_OUT" | tail -5 >> "$LOG_FILE"
  fi
else
  echo "$(date '+%Y-%m-%d %H:%M') — ⏭️ DB Import atlandı (ilan yok)" >> "$LOG_FILE"
fi
