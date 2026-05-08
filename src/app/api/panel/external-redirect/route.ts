/**
 * /api/panel/external-redirect?uid=<user_id>
 *
 * SEÇENEK A TEST (2026-05-08): WA Cloud API CTA URL sadece HTTPS kabul ediyor;
 * intent:// veya x-safari-https:// CTA'da direkt gönderilemiyor. Bu endpoint
 * HTTPS olarak gelir, içinde UA detection ile sistem tarayıcısına (Chrome /
 * Safari) breakout deneyen küçük bir HTML+JS sayfası döner.
 *
 *   Android  → intent://...#Intent;scheme=https;package=com.android.chrome;
 *               S.browser_fallback_url=<https-evergreen>;end
 *               (Chrome kuruluysa Chrome açar; değilse browser_fallback_url'e
 *               düşer = aynı evergreen URL'i WA WebView'da açar)
 *   iOS      → x-safari-https://... (Safari'ye breakout deneme; bazı iOS
 *               sürümlerinde private scheme)
 *   Diğer    → direkt /api/panel/evergreen'e redirect (desktop browser'lar
 *               zaten doğru yere gider)
 *
 * Yalnız emlak Mesaj 3 (intro.ts) için aktif. sendBackToPanel ve sendEmlakMenu
 * dokunulmadı — kullanıcı testi sonrası genişletme kararı.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
// Intent URL host'u APP_URL'in protocol'unu içeremez; ayrı tutuyoruz
const APP_HOST = APP_URL.replace(/^https?:\/\//, "");

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.redirect(`${APP_URL}/tr`);

  const evergreenPath = `/api/panel/evergreen?uid=${encodeURIComponent(uid)}`;
  const httpsUrl = `${APP_URL}${evergreenPath}`;
  // Android intent — Chrome ile aç, Chrome yoksa fallback https'e
  const intentUrl =
    `intent://${APP_HOST}${evergreenPath}` +
    `#Intent;scheme=https;package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`;
  // iOS x-safari-https — bazı sürümlerde Safari'ye breakout
  const safariUrl = `x-safari-https://${APP_HOST}${evergreenPath}`;

  const html = `<!DOCTYPE html>
<html lang="tr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Panel açılıyor...</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px 20px; color: #334155; background: #f8fafc; }
  .icon { font-size: 48px; margin-bottom: 12px; }
  p { margin: 8px 0; }
  a { color: #059669; }
</style>
</head><body>
<div class="icon">🔄</div>
<p>Tarayıcınız açılıyor...</p>
<noscript><p><a href="${httpsUrl}">Devam etmek için tıklayın</a></p></noscript>
<p style="font-size: 13px; color: #64748b;">Açılmazsa <a href="${httpsUrl}">buraya tıklayın</a>.</p>
<script>
(function(){
  var ua = navigator.userAgent || "";
  var isAndroid = /Android/i.test(ua);
  var isiOS = /iPhone|iPad|iPod/i.test(ua);
  var primary, fallback = ${JSON.stringify(httpsUrl)};
  if (isAndroid) { primary = ${JSON.stringify(intentUrl)}; }
  else if (isiOS) { primary = ${JSON.stringify(safariUrl)}; }
  else { primary = fallback; }
  try { window.location.href = primary; } catch (e) { window.location.href = fallback; }
  // Fallback: 1.5s sonra hala bu sayfa visible ise (intent dispatch fail) https'e düş
  setTimeout(function(){
    try { if (document.visibilityState === "visible") window.location.href = fallback; } catch (e) {}
  }, 1500);
})();
</script>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
