import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { getTenantByKey } from "@/tenants/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

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
        {/* iOS Safari auto-detection kapama — panel'deki telefon/adres/tarih
            metinleri yanlışlıkla "tap to call" / "open maps" tetiklemesin. */}
        <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
