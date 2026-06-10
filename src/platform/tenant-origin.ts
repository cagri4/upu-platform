/**
 * Tenant-aware origin çözümü — callback/redirect URL üretimi için.
 *
 * Neden: APP_URL env'i TEK domain'e işaret ediyor (estateai) ve multi-tenant
 * platformda yanlış SaaS'a redirect üretir (2026-06-10 audit P0 #1: kart
 * ödeyen bayi emlak domain'ine yönlendi). Ayrıca Vercel env değerinde
 * literal '\n' bulunabiliyor — trim şart.
 *
 * Öncelik sırası:
 *   1. tenants.settings.canonical_url (tenant'a özel sabitlenmiş origin)
 *   2. Request host header (x-forwarded-proto + host) — kullanıcı hangi
 *      domain'den geldiyse oraya döner; multi-tenant'ta doğru default
 *   3. APP_URL / NEXT_PUBLIC_APP_URL (trim'lenmiş) — host header yoksa
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

function cleanUrl(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^\s]+$/.test(v) ? v : null;
}

export async function resolveTenantOrigin(
  sb: SupabaseClient,
  tenantId: string | null,
  req: NextRequest,
): Promise<string> {
  // 1) Tenant'a sabitlenmiş canonical_url (tenants.settings jsonb)
  if (tenantId) {
    const { data } = await sb
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .maybeSingle();
    const canonical = cleanUrl(
      (data?.settings as { canonical_url?: string } | null)?.canonical_url,
    );
    if (canonical) return canonical;
  }

  // 2) Request host — kullanıcının geldiği domain
  const host = (req.headers.get("host") ?? "").trim();
  if (host) {
    const proto = (req.headers.get("x-forwarded-proto") ?? "https").trim();
    const fromHost = cleanUrl(`${proto}://${host}`);
    if (fromHost) return fromHost;
  }

  // 3) Env fallback (trim — Vercel env'de '\n' görüldü)
  const fromEnv =
    cleanUrl(process.env.NEXT_PUBLIC_APP_URL) ?? cleanUrl(process.env.APP_URL);
  return fromEnv ?? "https://retailai.upudev.nl";
}
