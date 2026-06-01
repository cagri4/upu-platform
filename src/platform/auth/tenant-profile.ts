/**
 * Multi-tenant profile lookup helper.
 *
 * Multi-tenant izolasyon (2026-06-01): tek saas_type için artık birden çok
 * tenants satırı olabilir (config DEMO; her signup kendi tenant'ını
 * yaratıyor). Bu helper, kullanıcının O saas_type'taki KENDİ tenant'ındaki
 * profile'ını bulur — config tenantId'sine BAĞIMLI DEĞİL.
 *
 * Akış:
 *   1) tenantKey resolve (caller verir veya x-tenant-key header'dan)
 *   2) tenantKey → saasType (config)
 *   3) tenants tablosundan o saasType'taki tüm tenant id'leri çek
 *   4) profiles where (auth_user_id=uid OR id=uid) AND tenant_id IN (...)
 *   5) Bulunursa profile döner; tenantId = profile.tenant_id (caller'ın
 *      önceki versiyonda gördüğü "config.tenantId" yerine kullanıcının
 *      gerçek tenant_id'si — downstream eq("tenant_id", lookup.tenantId)
 *      sızıntı yapmaz).
 *
 * Yeni-tenant signup'tan önceki demo kullanıcıları (Doğuş vb) için davranış
 * aynı — onların profile.tenant_id'si zaten DEMO tenant'a denk; saasType
 * eşleşmesi onu da yakalar.
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
    /** Hangi kolonlar select edilecek; fallback "*". `id` + `tenant_id` her zaman dahil. */
    select?: string;
  },
): Promise<ProfileLookupResult<T>> {
  let tenantKey = args.tenantKey ?? null;
  if (!tenantKey) {
    const h = await headers();
    tenantKey = h.get("x-tenant-key") ?? "emlak";
  }
  const cfg = getTenantByKey(tenantKey);
  if (!cfg?.saasType) {
    return { error: `Tenant bulunamadı: ${tenantKey}`, status: 400 };
  }

  // saas_type altındaki tüm tenant id'leri (DEMO + her signup'ın kendi tenant'ı)
  const { data: tenantRows } = await supabase
    .from("tenants")
    .select("id")
    .eq("saas_type", cfg.saasType);
  const tenantIds = (tenantRows ?? []).map((t) => t.id as string);
  if (tenantIds.length === 0) {
    return { error: `Tenant yok: ${cfg.saasType}`, status: 400 };
  }

  // Select'e `tenant_id` zorunlu — return'de kullanıyoruz.
  const rawSel = args.select ?? "*";
  const sel = rawSel === "*" || rawSel.includes("tenant_id") ? rawSel : `${rawSel}, tenant_id`;

  // PostgREST `.or` UUID'lerini güvenli alır (uid validate edildiğinden injection
  // riski yok — uid JWT-signed session'dan geliyor).
  const { data } = await supabase
    .from("profiles")
    .select(sel)
    .or(`auth_user_id.eq.${args.userId},id.eq.${args.userId}`)
    .in("tenant_id", tenantIds)
    .maybeSingle();

  if (!data) {
    return { error: "Bu tenant'ta profil bulunamadı.", status: 403 };
  }

  // data.tenant_id var (select'e dahil ettik). Downstream filter'larda kullanılır.
  const profile = data as unknown as T & { id: string; tenant_id: string };
  return {
    profile,
    tenantId: profile.tenant_id,
  };
}
