/**
 * Saha portal API auth helper — Faz 6.
 *
 * /tr/saha portalı saha satış elemanı (profiles role='saha') içindir.
 * getBayiAuth ile cookie session çözülür (tüm bayi role'leri kabul), sonra
 * o profil bir bayi_sales_reps satırına bağlı mı (user_id = profileId,
 * is_active) doğrulanır. Bağlı değilse 403 — yani dağıtıcı admin'i /tr/saha
 * portalına giremez (saha elemanı değil), saha elemanı da dağıtıcı paneline
 * giremez (getDagiticiAuth admin/user/satis ister).
 *
 *   const auth = await getSahaAuth(req);
 *   if ("error" in auth) return auth.error;
 *   // auth.sb, auth.tenantId, auth.salesRepId, auth.region, auth.repName
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../bayi/_auth";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SahaAuth =
  | {
      userId: string;
      profileId: string;
      tenantId: string;
      salesRepId: string;
      repName: string;
      region: string | null;
      sb: SupabaseClient;
    }
  | { error: NextResponse };

export async function getSahaAuth(req: NextRequest): Promise<SahaAuth> {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return { error: auth.error };
  const { sb, tenantId, profileId, userId } = auth;

  const { data: rep } = await sb
    .from("bayi_sales_reps")
    .select("id, name, region, is_active")
    .eq("tenant_id", tenantId)
    .eq("user_id", profileId)
    .eq("is_active", true)
    .maybeSingle();

  if (!rep) {
    return {
      error: NextResponse.json(
        { error: "Saha elemanı yetkisi yok." },
        { status: 403 },
      ),
    };
  }

  return {
    userId,
    profileId,
    tenantId,
    salesRepId: rep.id as string,
    repName: rep.name as string,
    region: (rep.region as string) || null,
    sb,
  };
}
