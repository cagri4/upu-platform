import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/platform/i18n/request.ts");

const nextConfig: NextConfig = {
  /**
   * Host-based rewrites — qr.upudev.nl açıldığında kök URL doğrudan
   * /tr/qr-giris sayfasına gider; diğer subdomain'ler etkilenmez.
   */
  async rewrites() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "qr.upudev.nl" }],
        destination: "/tr/qr-giris",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
