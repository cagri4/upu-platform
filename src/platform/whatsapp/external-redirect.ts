/**
 * WhatsApp WebView → sistem tarayıcısı breakout helper.
 *
 * sendUrlButton CTA'larında doğrudan tenant URL göndermek yerine bu helper
 * ile sararak WebView içinde sıkışmayı önler. Endpoint:
 *   /api/external-redirect?to=<https-url>
 *
 * APP_URL env'den çekilir; yoksa retailai.upudev.nl varsayılan (her tenant
 * subdomain'i bu endpoint'i barındırır — Vercel projesi tek).
 */
const HOST = process.env.NEXT_PUBLIC_APP_URL || "https://retailai.upudev.nl";

export function wrapExternalRedirect(targetUrl: string): string {
  return `${HOST}/api/external-redirect?to=${encodeURIComponent(targetUrl)}`;
}
