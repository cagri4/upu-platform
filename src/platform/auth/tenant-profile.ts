/**
 * Multi-tenant profile lookup helper.
 *
 * Sprint Foundation sonrası multi-tenant şemada:
 *   - Legacy profile: profile.id == auth.users.id, auth_user_id == id
 *   - Multi-tenant profile: profile.id = randomUUID, auth_user_id = auth.users.id
 *
 * `session.uid` (panel-auth `auth.userId`) genelde `auth.users.id` taşır.
 * Endpoint'lerin `eq("id", auth.userId)` çağrıları multi-tenant profile'ında
 * 0 row affected dönüyordu (KVKK/Google modal persist etmeme bug'ı).
 *
 * Bu helper iki durumu da kapsar:
 *   - `.or("auth_user_id.eq.<uid>,id.eq.<uid>")` — yeni + legacy match
 *   - `.eq("tenant_id", tenantId)` — resolved tenant'a scoped
 *
 * Tenant resolution `headers().get("x-tenant-key")` üzerinden middleware'in
 * set ettiği değer; fallback "emlak".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { getTenantByKey } from "@/tenants/config";

export type ProfileLookupResult<T> =
  | { profile: T & { id: string }; tenantId: string }
  | { error: string; status: number };

export async function resolveTenantProfile<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  args: {
    userId: string;
    /** Eğer caller tenant'ı zaten biliyorsa override; yoksa headers'tan resolve. */
    tenantKey?: string | null;
    /** Hangi kolonlar select edilecek; fallback "*". `id` her zaman dahil edilir. */
    select?: string;
  },
): Promise<ProfileLookupResult<T>> {
  let tenantKey = args.tenantKey ?? null;
  if (!tenantKey) {
    const h = await headers();
    tenantKey = h.get("x-tenant-key") ?? "emlak";
  }
  const tenant = getTenantByKey(tenantKey);
  if (!tenant?.tenantId) {
    return { error: `Tenant bulunamadı: ${tenantKey}`, status: 400 };
  }

  const sel = args.select ?? "*";
  // PostgREST `.or` UUID'lerini güvenli alır (uid validate edildiğinden injection
  // riski yok — uid JWT-signed session'dan geliyor).
  const { data } = await supabase
    .from("profiles")
    .select(sel)
    .or(`auth_user_id.eq.${args.userId},id.eq.${args.userId}`)
    .eq("tenant_id", tenant.tenantId)
    .maybeSingle();

  if (!data) {
    return { error: "Bu tenant'ta profil bulunamadı.", status: 403 };
  }

  return { profile: data as T & { id: string }, tenantId: tenant.tenantId };
}
