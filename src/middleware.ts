import { NextRequest, NextResponse } from "next/server";
import { getTenantByDomain, isAdminDomain } from "@/tenants/config";

const PUBLIC_PATHS = ["/api/", "/_next/", "/favicon.ico", "/icons/", "/manifest.json", "/d/", "/u/"];
const LOCALES = ["tr", "en", "nl"];
const DEFAULT_LOCALE = "tr";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hostname = req.headers.get("host") || "localhost:3000";

  // qr.upudev.nl host'unda kök URL doğrudan QR giriş sayfasına gider —
  // locale landing'i atla. URL bar temiz kalır (rewrite, redirect değil).
  if (hostname.startsWith("qr.upudev.nl") && (pathname === "/" || pathname === "")) {
    const url = req.nextUrl.clone();
    url.pathname = "/tr/qr-giris";
    return NextResponse.rewrite(url);
  }

  // Resolve tenant from domain
  const tenant = getTenantByDomain(hostname);
  const isAdmin = isAdminDomain(hostname);

  // Set tenant info in headers (accessible in server components)
  const response = NextResponse.next();
  if (tenant) {
    response.headers.set("x-tenant-key", tenant.key);
    response.headers.set("x-tenant-id", tenant.tenantId);
  }
  if (isAdmin) {
    response.headers.set("x-is-admin", "true");
  }

  // Locale detection + redirect
  const pathLocale = pathname.split("/")[1];
  if (!LOCALES.includes(pathLocale)) {
    const locale = req.cookies.get("NEXT_LOCALE")?.value || DEFAULT_LOCALE;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Admin domain: signup yapacak yer DEĞİL — yalnızca mevcut admin login eder.
  // /[locale]/uye-ol → /[locale]/giris'e yönlendir. (API tarafı için
  // /api/auth/otp/verify ayrıca admin host + purpose=signup'ı reddeder.)
  if (isAdmin) {
    const seg = pathname.split("/").filter(Boolean);
    if (seg[1] === "uye-ol") {
      const url = req.nextUrl.clone();
      url.pathname = `/${pathLocale}/giris`;
      return NextResponse.redirect(url);
    }
  }

  // Tell next-intl which locale is active
  response.headers.set("x-next-intl-locale", pathLocale);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json).*)"],
};
