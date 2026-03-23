import { NextRequest, NextResponse } from "next/server";
import { getTenantByDomain, isAdminDomain } from "@/tenants/config";

const PUBLIC_PATHS = ["/api/", "/_next/", "/favicon.ico", "/icons/", "/manifest.json"];
const LOCALES = ["tr", "en", "nl"];
const DEFAULT_LOCALE = "tr";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hostname = req.headers.get("host") || "localhost:3000";

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
    // No locale in path → redirect to default locale
    const locale = req.cookies.get("NEXT_LOCALE")?.value || DEFAULT_LOCALE;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json).*)"],
};
