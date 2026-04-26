#!/bin/bash
# Scrape Monitoring — 5-İmza Bug Detector
#
# daily-scrape.sh'den her parti sonunda çağrılır.
# Bu 5 sinyalden biri tetiklenirse WA admin'e alert gönderir:
#   1. Scrape süresi <5 dk (block sinyali — normalde 8 URL en az 5+ dk sürer)
#   2. 0 import (DB silent fail)
#   3. max(listing_date) < bugün-1 gün (stale data — eski progress dosyası bug'ı)
#   4. Log'da "Engel"/"Giriş duvarı"/"olağan-disi" geçiyor
#   5. 0 cookie (export-cookies.mjs sessizce başarısız oldu)
#
# Kullanım: ./monitor-scrape.sh part1|part2|part3|full

PROJECT_DIR="/home/cagr/Masaüstü/upu-platform"
PART="${1:-full}"
LOG_FILE="$PROJECT_DIR/scrape-log.txt"
SCRAPE_DETAIL="$PROJECT_DIR/scripts/output/scrape-detail-${PART}.log"

if [ -f "$PROJECT_DIR/.env.local" ]; then
  export NEXT_PUBLIC_SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL "$PROJECT_DIR/.env.local" | cut -d= -f2)
  export SUPABASE_SERVICE_ROLE_KEY=$(grep ^SUPABASE_SERVICE_ROLE_KEY "$PROJECT_DIR/.env.local" | cut -d= -f2)
fi

if [ -f "$PROJECT_DIR/.env.production.local" ]; then
  export CRON_SECRET=$(grep ^CRON_SECRET "$PROJECT_DIR/.env.production.local" | cut -d= -f2 | tr -d '"')
fi

DEPLOY_URL="${DEPLOY_URL:-https://upu-platform.vercel.app}"

# ── Log'dan son partinin satırlarını çek ──
# scrape-log.txt'de format: "YYYY-MM-DD HH:MM — Başlatılıyor [part1]" → ... → "✅/⚠️ Scrape [part1]"
LAST_BLOCK=$(awk -v p="\\[$PART\\]" '
  /Başlatılıyor/ && $0 ~ p { block = ""; capture = 1 }
  capture { block = block $0 "\n" }
  /Scrape \[.*\] (OK|TAMAMLANMADI)/ && $0 ~ p && capture { capture = 0; final = block; block = "" }
  END { print final }
' "$LOG_FILE")

if [ -z "$LAST_BLOCK" ]; then
  echo "[$PART] Log block bulunamadı, monitoring atlanıyor."
  exit 0
fi

# ── Sinyalleri parse et ──
SIGNALS=()

# 1. Scrape süresi: Başlatılıyor zaman damgası → Scrape OK zaman damgası
START_TIME=$(echo "$LAST_BLOCK" | grep "Başlatılıyor" | grep -oE '[0-9]{2}:[0-9]{2}' | head -1)
END_TIME=$(echo "$LAST_BLOCK" | grep -E "Scrape \[.*\] (OK|TAMAMLANMADI)" | grep -oE '[0-9]{2}:[0-9]{2}' | head -1)
if [ -n "$START_TIME" ] && [ -n "$END_TIME" ]; then
  START_MIN=$(( $(echo $START_TIME | cut -d: -f1)*60 + $(echo $START_TIME | cut -d: -f2) ))
  END_MIN=$(( $(echo $END_TIME | cut -d: -f1)*60 + $(echo $END_TIME | cut -d: -f2) ))
  DURATION=$(( END_MIN - START_MIN ))
  # Gece yarısı geçişi için negatifse 24 saat ekle
  if [ $DURATION -lt 0 ]; then DURATION=$(( DURATION + 1440 )); fi
  if [ $DURATION -lt 5 ]; then
    SIGNALS+=("⏱️ Scrape süresi: ${DURATION} dk (<5 dk = block sinyali)")
  fi
fi

# 2. 0 import: "DB Import [...]: +0 yeni" pattern (duplicate'lar varsa OK kabul et)
IMPORT_LINE=$(echo "$LAST_BLOCK" | grep "DB Import")
INSERTED=$(echo "$IMPORT_LINE" | grep -oP '\+\K\d+')
DUPLICATES=$(echo "$IMPORT_LINE" | grep -oP '(?<=, )\d+(?= duplicate)')
# Sadece part1 için sıkı kontrol: 0 yeni + 0 duplicate = silent fail
if [ "$PART" = "part1" ] || [ "$PART" = "full" ]; then
  if [ "$INSERTED" = "0" ] && [ "$DUPLICATES" = "0" ]; then
    SIGNALS+=("📥 DB Import: 0 yeni + 0 duplicate (silent fail)")
  fi
fi

# 3. Stale data: max(listing_date) < bugün-1 gün
NODE=$(which node)
STALE_CHECK=$($NODE -e "
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log('NO_ENV'); process.exit(0); }
fetch(\`\${url}/rest/v1/daily_leads?select=listing_date&order=listing_date.desc&limit=1\`, {
  headers: { apikey: key, Authorization: \`Bearer \${key}\` }
}).then(r => r.json()).then(d => {
  if (!d || !d[0]) { console.log('NO_DATA'); return; }
  const max = new Date(d[0].listing_date);
  const today = new Date(); today.setHours(0,0,0,0);
  const cutoff = new Date(today.getTime() - 24*60*60*1000);
  if (max < cutoff) {
    const days = Math.floor((today - max) / 86400000);
    console.log('STALE:' + d[0].listing_date + ':' + days);
  } else {
    console.log('OK');
  }
}).catch(e => console.log('ERR:' + e.message));
" 2>&1)

if [[ "$STALE_CHECK" == STALE:* ]]; then
  STALE_DATE=$(echo "$STALE_CHECK" | cut -d: -f2)
  STALE_DAYS=$(echo "$STALE_CHECK" | cut -d: -f3)
  SIGNALS+=("📅 En yeni listing_date: $STALE_DATE (${STALE_DAYS} gün eski)")
fi

# 4. Engel/Giriş duvarı/olağan-disi
if [ -f "$SCRAPE_DETAIL" ]; then
  BLOCK_HITS=$(grep -ciE "Engel|Giriş duvarı|olağan.dışı|IP engeli|olagan.disi" "$SCRAPE_DETAIL")
  if [ "$BLOCK_HITS" -gt 0 ]; then
    SAMPLE=$(grep -iE "Engel|Giriş duvarı|olağan.dışı|IP engeli" "$SCRAPE_DETAIL" | head -1 | cut -c1-100)
    SIGNALS+=("🚧 Engel sinyali: $BLOCK_HITS hit. Örnek: $SAMPLE")
  fi
fi

# 5. 0 cookie
COOKIE_LINE=$(echo "$LAST_BLOCK" | grep "Cookie:")
COOKIE_NUM=$(echo "$COOKIE_LINE" | grep -oP '\d+(?= cookie)')
if [ "$COOKIE_NUM" = "0" ] || [ -z "$COOKIE_NUM" ]; then
  SIGNALS+=("🍪 Cookie: 0 (export-cookies sessiz fail)")
fi

# ── Sinyal varsa alert gönder ──
if [ ${#SIGNALS[@]} -eq 0 ]; then
  echo "[$PART] ✅ Tüm sinyaller temiz."
  exit 0
fi

echo "[$PART] ⚠️ ${#SIGNALS[@]} sinyal tetiklendi:"
for s in "${SIGNALS[@]}"; do echo "  - $s"; done

# Mesaj oluştur
MESSAGE="🚨 *Scrape Bug Sinyali — $PART*

"
MESSAGE+="$(date '+%Y-%m-%d %H:%M') tarihli scrape'te şu sinyaller tetiklendi:

"
for s in "${SIGNALS[@]}"; do MESSAGE+="• $s
"; done
MESSAGE+="
Kontrol: \`tail -40 scrape-log.txt\` veya \`scripts/output/scrape-detail-${PART}.log\`"

# Curl ile gönder
if [ -z "$CRON_SECRET" ]; then
  echo "[$PART] ❌ CRON_SECRET yok, alert gönderilemedi."
  exit 1
fi

ALERT_RESULT=$(curl -sS -X POST "$DEPLOY_URL/api/admin/scrape-alert" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg msg "$MESSAGE" '{message: $msg}')" 2>&1)

DATE_NOW=$(date '+%Y-%m-%d %H:%M')
echo "$DATE_NOW — 🚨 Bug alert [$PART]: ${#SIGNALS[@]} sinyal — $ALERT_RESULT" >> "$LOG_FILE"
echo "[$PART] Alert sonuç: $ALERT_RESULT"
