import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { getTenantByKey } from "@/tenants/config";
import "./globals.css";
import { PwaUpdateBanner } from "@/components/pwa-update-banner";
import { PwaInstallCapturer } from "@/components/pwa-install-capturer";

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
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <PwaInstallCapturer />
        {children}
        <PwaUpdateBanner />
      </body>
    </html>
  );
}
