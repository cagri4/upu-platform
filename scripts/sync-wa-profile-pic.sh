#!/usr/bin/env bash
# WA Business Profile Picture Sync (Meta Cloud API)
# Idempotent — yeniden çalıştırılabilir. Source: public/icons/app/icon-base-1024.png
# Env: WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID (.env.production.local'den)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_PNG="$ROOT/public/icons/app/icon-base-1024.png"
TMP_JPG="/tmp/upu-wa-profile.jpg"
ENV_FILE="$ROOT/.env.production.local"
API="https://graph.facebook.com/v22.0"

# Env yükle
[ -f "$ENV_FILE" ] || { echo "❌ $ENV_FILE yok"; exit 1; }
TOKEN=$(grep -E '^WHATSAPP_ACCESS_TOKEN=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
PHONE_ID=$(grep -E '^WHATSAPP_PHONE_NUMBER_ID=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
[ -n "$TOKEN" ] && [ -n "$PHONE_ID" ] || { echo "❌ TOKEN/PHONE_ID env yok"; exit 1; }
[ -f "$SRC_PNG" ] || { echo "❌ $SRC_PNG yok"; exit 1; }

# APP_ID'yi token'dan otomatik çek (Resumable Upload API app-id-scoped)
echo "[prep] App ID resolve (debug_token)"
APP_ID=$(curl -s "$API/debug_token?input_token=$TOKEN&access_token=$TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['app_id'])")
[ -n "$APP_ID" ] || { echo "❌ APP_ID resolve fail"; exit 1; }
echo "  app_id: $APP_ID"

# PNG → JPEG (white bg, 640x640 — Meta önerisi)
echo "[prep] PNG → JPEG (white bg, 640x640)"
python3 - <<PY
from PIL import Image
img = Image.open("$SRC_PNG").convert("RGBA")
bg = Image.new("RGB", img.size, (255, 255, 255))
bg.paste(img, mask=img.split()[3])
bg.thumbnail((640, 640), Image.LANCZOS)
sq = Image.new("RGB", (640, 640), (255, 255, 255))
sq.paste(bg, ((640-bg.width)//2, (640-bg.height)//2))
sq.save("$TMP_JPG", "JPEG", quality=92, optimize=True)
PY
JPG_BYTES=$(stat -c %s "$TMP_JPG")
echo "  → $TMP_JPG ($JPG_BYTES bytes)"

# STEP 1: Upload session başlat — APP_ID-scoped (Resumable Upload API)
echo
echo "[step 1] POST /$APP_ID/uploads (file_length=$JPG_BYTES, file_type=image/jpeg)"
RESP1=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "$API/$APP_ID/uploads?file_length=$JPG_BYTES&file_type=image/jpeg" \
  -H "Authorization: OAuth $TOKEN")
STATUS1=$(echo "$RESP1" | tail -1 | cut -d: -f2)
BODY1=$(echo "$RESP1" | sed '$d')
echo "  status: $STATUS1"
echo "  body: $BODY1"
[ "$STATUS1" = "200" ] || { echo "❌ Step 1 fail"; exit 1; }
UPLOAD_ID=$(echo "$BODY1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  upload_id: $UPLOAD_ID"

# STEP 2: Binary upload → handle
echo
echo "[step 2] POST /$UPLOAD_ID (binary upload)"
RESP2=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "$API/$UPLOAD_ID" \
  -H "Authorization: OAuth $TOKEN" \
  -H "file_offset: 0" \
  --data-binary "@$TMP_JPG")
STATUS2=$(echo "$RESP2" | tail -1 | cut -d: -f2)
BODY2=$(echo "$RESP2" | sed '$d')
echo "  status: $STATUS2"
echo "  body: $BODY2"
[ "$STATUS2" = "200" ] || { echo "❌ Step 2 fail"; exit 1; }
HANDLE=$(echo "$BODY2" | python3 -c "import sys,json; print(json.load(sys.stdin)['h'])")
echo "  handle: ${HANDLE:0:40}..."

# STEP 3: Profile picture handle bind
echo
echo "[step 3] POST /whatsapp_business_profile"
RESP3=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "$API/$PHONE_ID/whatsapp_business_profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"messaging_product\":\"whatsapp\",\"profile_picture_handle\":\"$HANDLE\"}")
STATUS3=$(echo "$RESP3" | tail -1 | cut -d: -f2)
BODY3=$(echo "$RESP3" | sed '$d')
echo "  status: $STATUS3"
echo "  body: $BODY3"
[ "$STATUS3" = "200" ] || { echo "❌ Step 3 fail"; exit 1; }

# DOĞRULAMA: GET profile_picture_url
echo
echo "[verify] GET /whatsapp_business_profile?fields=profile_picture_url"
RESP4=$(curl -s "$API/$PHONE_ID/whatsapp_business_profile?fields=profile_picture_url" \
  -H "Authorization: Bearer $TOKEN")
echo "  $RESP4"

echo
echo "✅ WA Business profile picture sync başarılı"