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
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null }>(
    sb,
    { userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role" },
  );
  if ("error" in lookup) {
    return { error: NextResponse.json({ error: lookup.error }, { status: lookup.status }) };
  }

  const role = (lookup.profile.role || "user").toString();
  if (role !== "admin" && role !== "satis") {
    return {
      error: NextResponse.json({ error: "Yetki yok (admin/satis gerekli)." }, { status: 403 }),
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
