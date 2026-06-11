import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/platform/i18n/request.ts");

const nextConfig: NextConfig = {
  // H-02 güvenlik fix'i (2026-06-11 hardening audit): framework parmak izini
  // gizle. x-powered-by: Next.js header'ı kaldırılır (info disclosure / H-07).
  poweredByHeader: false,

  // H-02 güvenlik header'ları — clickjacking + MIME-sniff + referrer sızıntısı.
  // CSP yalnız frame-ancestors'a sınırlı: script/style'ı kısıtlamaz (nonce
  // gerektirmez, app'i kırmaz) ama X-Frame-Options ile birlikte iframe gömmeyi
  // engeller (ödeme + panel sayfaları öncelik). HSTS'e dokunulmaz — Vercel
  // zaten gönderiyor, çift header olmasın diye burada tekrarlanmaz.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // bayi-calisan-davet → kullanici-davet (Sprint B-3 rename).
      // WA bot komutlarından gelen eski tokenli URL'ler için 301.
      {
        source: "/:locale/bayi-calisan-davet",
        destination: "/:locale/kullanici-davet",
        permanent: true,
      },
      // bayi-panel-ayarlari → bayi-panel (Iter 2: in-place edit'e geçildi,
      // gizlilik bölümü ayrı /bayi-gizlilik sayfasına taşındı).
      {
        source: "/:locale/bayi-panel-ayarlari",
        destination: "/:locale/bayi-panel",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
