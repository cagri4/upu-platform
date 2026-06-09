/**
 * Bayi (alıcı) API auth helper — cookie session → bayi tenant + role guard.
 *
 * Dağıtıcı (`_auth.ts`) ile aynı pattern fakat farklı kapsam:
 *   - Tüm bayi role'lerine açık (admin/user/satis/muhasebe/depocu)
 *   - "Dağıtıcı rolündeki" tenant sahibi de buradan girebilir (kendi
 *     yönetim panelini test etmek için)
 *
 * Ayşe Hanım (market sahibi) end state'inde tenant_id == kendi market'i;
 * sipariş verirken o tenant'tan satın alır. Yani burada `tenantId` =
 * alıcının tenant'ı; satıcı tenant'ı ayrı (Faz 3'te entegrasyon).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getServiceClient } from "@/platform/auth/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BayiAuth =
  | {
      userId: string;
      profileId: string;
      tenantId: string;
      role: string;
      displayName: string | null;
      sb: SupabaseClient;
    }
  | { error: NextResponse };

export async function getBayiAuth(req: NextRequest): Promise<BayiAuth> {
  const auth = await requireAuth(req);
  if ("error" in auth) return { error: auth.error };

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string;
    tenant_id: string;
    role: string | null;
    display_name: string | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, role, display_name",
  });
  if ("error" in lookup) {
    return {
      error: NextResponse.json({ error: lookup.error }, { status: lookup.status }),
    };
  }

  // Bayi panelinde tüm role'ler izinli (alıcı görünümü). Dağıtıcı
  // (`_auth.ts`) sadece admin/user/satis kabul ediyordu — burada daha
  // geniş çünkü görüntüleme katmanı.
  const role = (lookup.profile.role || "user").toString();

  return {
    userId: auth.userId,
    profileId: lookup.profile.id,
    tenantId: lookup.tenantId,
    role,
    displayName: (lookup.profile.display_name as string | null) ?? null,
    sb,
  };
}
