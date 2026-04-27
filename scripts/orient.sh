#!/bin/bash
# upu-platform — Canlı Oryantasyon Snapshot
#
# Yeni Claude oturumu projeye katıldığında, mevcut durumu hızlıca anlamak için
# bu scripti çalıştırır. Statik docs (.planning/) + bu canlı snapshot = kapsamlı
# context.
#
# Kullanım: bash scripts/orient.sh

PROJECT_DIR="/home/cagr/Masaüstü/upu-platform"
cd "$PROJECT_DIR" || exit 1

echo "═══════════════════════════════════════════════════════════════"
echo " upu-platform — ORYANTASYON SNAPSHOT — $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo "── 📦 Repo durumu ─────────────────────────────────────────────"
echo "Branch: $(git branch --show-current)"
echo "Son commit: $(git log -1 --format='%h %s (%ar)')"
echo "Uncommitted: $(git status --short | wc -l) dosya"

echo ""
echo "── 📜 Son 15 commit ───────────────────────────────────────────"
git log --oneline -15

echo ""
echo "── 🏢 Mevcut SaaS dikeyleri ───────────────────────────────────"
for tenant in src/tenants/*/; do
  name=$(basename "$tenant")
  if [ "$name" = "config.ts" ]; then continue; fi
  cmd_count=$(ls "$tenant/commands/" 2>/dev/null | wc -l)
  agent_count=$(ls "$tenant/agents/" 2>/dev/null | grep -v "index.ts\|helpers.ts" | wc -l)
  printf "  %-15s | %2d komut | %d agent\n" "$name" "$cmd_count" "$agent_count"
done

echo ""
echo "── 🌐 Web sayfaları (top-level routes) ────────────────────────"
ls src/app/\[locale\]/ 2>/dev/null | grep -v "^_" | head -20

echo ""
echo "── 🔌 API endpoint'leri ───────────────────────────────────────"
ls src/app/api/ 2>/dev/null | head -25

echo ""
echo "── ⏰ Cron'lar ────────────────────────────────────────────────"
crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" | head -10
echo "(daily-scrape.sh + monitor-scrape.sh + Vercel cron'ları)"

echo ""
echo "── 🚀 Vercel son 3 deploy ─────────────────────────────────────"
vercel ls 2>&1 | head -7 | tail -4

echo ""
echo "── 📊 Bugünkü scrape durumu ───────────────────────────────────"
tail -10 "$PROJECT_DIR/scrape-log.txt" 2>/dev/null || echo "scrape-log.txt yok"

echo ""
echo "── 📚 Kalıcı dokümanlar (oku, sonra geri dön) ─────────────────"
ls .planning/*.md 2>/dev/null | head -15

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Sıradaki adım: .planning/ARCHITECTURE.md → SAAS-INVENTORY.md →"
echo "ADD-NEW-SAAS.md → CONVENTIONS.md sırasıyla oku."
echo "═══════════════════════════════════════════════════════════════"
