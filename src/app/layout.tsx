import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { getTenantByKey } from "@/tenants/config";
import "./globals.css";
import { PwaUpdateBanner } from "@/components/pwa-update-banner";
import { PwaInstallCapturer } from "@/components/pwa-install-capturer";
import { IosWaBanner } from "@/components/ios-wa-banner";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

// Tenant key → iOS standalone home screen başlığı.
// Apple manifest short_name'i okumaz, head'de `apple-mobile-web-app-title`
// meta'sını okur — burada per-tenant düşürülür.
const APPLE_TITLE_MAP: Record<string, string> = {
  emlak: "UPU Emlak",
  bayi: "UPU Bayi",
  market: "UPU Market",
  otel: "UPU Otel",
  restoran: "UPU Restoran",
  siteyonetim: "UPU Site",
  muhasebe: "UPU Muhasebe",
};

const DEFAULT_THEME_COLOR = "#1877F2";

async function resolveTenantKey(): Promise<string> {
  const h = await headers();
  return h.get("x-tenant-key") ?? "emlak";
}

export async function generateMetadata(): Promise<Metadata> {
  const tenantKey = await resolveTenantKey();
  const appTitle = APPLE_TITLE_MAP[tenantKey] ?? "UPU";

  return {
    title: appTitle,
    description: "Yapay zeka destekli iş asistanınız.",
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: appTitle,
    },
    icons: {
      icon: [
        { url: "/icons/app/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/app/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [
        { url: "/icons/app/apple-touch-icon-120x120.png", sizes: "120x120", type: "image/png" },
        { url: "/icons/app/apple-touch-icon-152x152.png", sizes: "152x152", type: "image/png" },
        { url: "/icons/app/apple-touch-icon-167x167.png", sizes: "167x167", type: "image/png" },
        { url: "/icons/app/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const tenantKey = await resolveTenantKey();
  const tenant = getTenantByKey(tenantKey);
  return {
    themeColor: tenant?.color ?? DEFAULT_THEME_COLOR,
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${inter.className} h-full antialiased bg-white dark:bg-slate-900`} suppressHydrationWarning>
      <head>
        {/* FOUC engel — localStorage'tan tema oku, dark ise html'e class ekle.
            React hydrate olmadan önce çalışır, sayfa beyazdan siyaha
            "zıplamaz". */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();",
          }}
        />
        {/* Legacy iOS Safari — Next.js Metadata API "capable: true" sadece yeni
            mobile-web-app-capable meta'sını emit ediyor; eski iOS hala
            apple-mobile-web-app-capable arıyor. Standalone modda açılması için
            manuel eklenir. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* Apple splash images — portrait, beyaz arka plan + ortalanmış icon.
            Tenant-aware splash v2'ye bırakıldı (asset 7x6 olur, ilk turda
            neutral splash yeterli). */}
        <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="/icons/app/apple-touch-startup-image-1290x2796.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/icons/app/apple-touch-startup-image-1179x2556.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" href="/icons/app/apple-touch-startup-image-1170x2532.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" href="/icons/app/apple-touch-startup-image-1284x2778.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" href="/icons/app/apple-touch-startup-image-1080x1920.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" href="/icons/app/apple-touch-startup-image-2048x2732.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)" href="/icons/app/apple-touch-startup-image-1668x2388.png" />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 pt-safe pb-safe px-safe">
        <PwaInstallCapturer />
        <IosWaBanner />
        {children}
        <PwaUpdateBanner />
      </body>
    </html>
  );
}
