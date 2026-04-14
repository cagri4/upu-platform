#!/bin/bash
# Günlük Sahibinden Scraper — 2 Partili Cron Job
#
# Parti 1: Gece 03:00 → İlk 19 URL (büyük kategoriler)
# Parti 2: Gece 04:30 → Son 19 URL (küçük kategoriler)
#
# Kullanım:
#   ./daily-scrape.sh          → Tüm URL'ler (eski davranış)
#   ./daily-scrape.sh part1    → İlk 19 URL
#   ./daily-scrape.sh part2    → Son 19 URL

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

# 2. Scrape — partiye göre URL seçimi
SCRAPE_ARGS="--days=1"
if [ "$PART" = "part1" ]; then
  SCRAPE_ARGS="$SCRAPE_ARGS --take=19"
elif [ "$PART" = "part2" ]; then
  SCRAPE_ARGS="$SCRAPE_ARGS --skip=19"
fi

$NODE scripts/scrape-v2.mjs $SCRAPE_ARGS > "$SCRAPE_DETAIL" 2>&1
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

# 3. DB'ye import
if [ -n "$TOTAL" ] && [ "$TOTAL" -gt 0 ] 2>/dev/null; then
  IMPORT_OUT=$($NODE scripts/import-v2.mjs 2>&1)
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

# 4. Cleanup — 30 günden eski ilanları sil (sadece part2'de, günde 1 kez yeterli)
if [ "$PART" = "part2" ] || [ "$PART" = "full" ]; then
  CLEANUP_OUT=$($NODE -e "
    const {createClient} = require('@supabase/supabase-js');
    const c = createClient('$SUPABASE_URL', '$SUPABASE_SERVICE_ROLE_KEY');
    async function run() {
      const d30 = new Date(Date.now() - 30*24*60*60*1000).toISOString();
      const {count: before} = await c.from('emlak_properties').select('*',{count:'exact',head:true}).eq('source_portal','sahibinden');
      await c.from('emlak_properties').delete().eq('source_portal','sahibinden').lt('listing_date', d30);
      await c.from('emlak_properties').delete().eq('source_portal','sahibinden').is('listing_date', null).lt('created_at', d30);
      const {count: after} = await c.from('emlak_properties').select('*',{count:'exact',head:true}).eq('source_portal','sahibinden');
      console.log('Silinen: ' + (before - after) + ' ilan (30+ gun eski)');
    }
    run();
  " 2>&1)
  echo "$(date '+%Y-%m-%d %H:%M') — 🧹 Cleanup: $CLEANUP_OUT" >> "$LOG_FILE"

  # 5. Tracking notifications — yeni ilanları takip eden kullanıcılara bildir
  DEPLOY_URL="${DEPLOY_URL:-https://upu-platform.vercel.app}"
  NOTIFY_OUT=$(curl -s "${DEPLOY_URL}/api/cron/tracking-notify" 2>&1)
  echo "$(date '+%Y-%m-%d %H:%M') — 🔔 Takip bildirimi: $NOTIFY_OUT" >> "$LOG_FILE"
fi
