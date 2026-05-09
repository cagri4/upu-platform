/**
 * /api/external-redirect?to=<https-url>
 *
 * Generic WhatsApp WebView → sistem tarayıcısı (Chrome/Safari) breakout.
 * Tüm tenant'larda CTA URL'lerini bu endpoint'in arkasına alarak WebView
 * sıkışması önlenir. Emlak için /api/panel/external-redirect?uid= zaten
 * vardı (uid → evergreen mint pattern); bu generic versiyon herhangi bir
 * upudev.nl alt domain URL'ini kabul eder.
 *
 * Allowlist: sadece *.upudev.nl host'ları (open redirect saldırısı önleme).
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FALLBACK_HOME = "https://upudev.nl";
const ALLOWED_SUFFIX = ".upudev.nl";

function isAllowedTarget(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.hostname === "upudev.nl") return true;
    return u.hostname.endsWith(ALLOWED_SUFFIX);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("to");
  if (!target || !isAllowedTarget(target)) {
    return NextResponse.redirect(FALLBACK_HOME);
  }

  const targetUrl = new URL(target);
  const targetHost = targetUrl.host;
  const targetPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;

  const intentUrl =
    `intent://${targetHost}${targetPath}` +
    `#Intent;scheme=https;package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent(target)};end`;
  const safariUrl = `x-safari-https://${targetHost}${targetPath}`;

  const html = `<!DOCTYPE html>
<html lang="tr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Tarayıcınız açılıyor...</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px 20px; color: #334155; background: #f8fafc; }
  .icon { font-size: 48px; margin-bottom: 12px; }
  p { margin: 8px 0; }
  a { color: #059669; }
</style>
</head><body>
<div class="icon">🔄</div>
<p>Tarayıcınız açılıyor...</p>
<noscript><p><a href="${target}">Devam etmek için tıklayın</a></p></noscript>
<p style="font-size: 13px; color: #64748b;">Açılmazsa <a href="${target}">buraya tıklayın</a>.</p>
<script>
(function(){
  var ua = navigator.userAgent || "";
  var isAndroid = /Android/i.test(ua);
  var isiOS = /iPhone|iPad|iPod/i.test(ua);
  var primary, fallback = ${JSON.stringify(target)};
  if (isAndroid) { primary = ${JSON.stringify(intentUrl)}; }
  else if (isiOS) { primary = ${JSON.stringify(safariUrl)}; }
  else { primary = fallback; }
  try { window.location.href = primary; } catch (e) { window.location.href = fallback; }
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
