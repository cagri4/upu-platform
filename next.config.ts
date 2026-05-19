import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/platform/i18n/request.ts");

const nextConfig: NextConfig = {
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
