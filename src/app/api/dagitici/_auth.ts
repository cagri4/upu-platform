/**
 * Dağıtıcı API auth helper — cookie session → bayi tenant profili.
 *
 * Her dagitici endpoint'i bu helper'la başlar:
 *   const auth = await getDagiticiAuth(req);
 *   if ("error" in auth) return auth.error;
 *   // auth.userId, auth.tenantId, auth.role kullanılır
 *
 * Rol guard: admin veya satis. Diğer roller 403.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies, isSessionRevoked } from "@/platform/auth/session";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DagiticiAuth =
  | {
      userId: string;
      profileId: string;
      tenantId: string;
      role: string;
      sb: SupabaseClient;
    }
  | { error: NextResponse };

export async function getDagiticiAuth(req: NextRequest): Promise<DagiticiAuth> {
  const auth = await requireAuth(req);
  if ("error" in auth) return { error: auth.error };

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string;
    tenant_id: string;
    role: string | null;
    sessions_revoked_at: string | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, role, sessions_revoked_at",
  });
  if ("error" in lookup) {
    return { error: NextResponse.json({ error: lookup.error }, { status: lookup.status }) };
  }

  // H-10: revoke damgasından önceki token'ı reddet (ek sorgu yok).
  const sess = await getSessionFromCookies();
  if (isSessionRevoked(sess?.iat, lookup.profile.sessions_revoked_at)) {
    return { error: NextResponse.json({ error: "Oturum sonlandırılmış." }, { status: 401 }) };
  }

  // Bayi capabilities (CLAUDE.md): role='admin' veya role='user' = tenant
  // sahibi (OWNER_ALL); 'satis' = sınırlı satış ekip üyesi. Dağıtıcı paneli
  // üçüne de açık. 'muhasebe' / 'depocu' = kapalı (kendi panelleri var).
  const role = (lookup.profile.role || "user").toString();
  const ALLOWED = ["admin", "user", "satis"];
  if (!ALLOWED.includes(role)) {
    return {
      error: NextResponse.json(
        { error: "Yetki yok (tenant sahibi veya satış rolü gerekli)." },
        { status: 403 },
      ),
    };
  }

  return {
    userId: auth.userId,
    profileId: lookup.profile.id,
    tenantId: lookup.tenantId,
    role,
    sb,
  };
}
