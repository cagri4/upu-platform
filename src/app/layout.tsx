import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PwaUpdateBanner } from "@/components/pwa-update-banner";
import { PwaInstallCapturer } from "@/components/pwa-install-capturer";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "UPU",
  description: "Yapay zeka destekli iş asistanınız.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UPU",
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

export const viewport: Viewport = {
  themeColor: "#1877F2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <PwaInstallCapturer />
        {children}
        <PwaUpdateBanner />
      </body>
    </html>
  );
}
