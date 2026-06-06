import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/platform/auth/supabase';
import { requireAdminUser } from '@/platform/admin/auth';
import { getTenantByKey, getAllTenants } from '@/tenants/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  try {
    const supabase = getServiceClient();

    const { data: tenants } = await supabase
      .from('tenants')
      .select('*')
      .order('name');

    const { data: profilesRaw } = await supabase
      .from('profiles')
      .select('id, tenant_id, role');

    // KATMAN E (2026-06-06): yapısal redesign için stat segmentasyonu.
    // saasUserCount: SaaS'a bağlı kişiler (DEMO tenant kullanıcıları dahil)
    // saasUserCounts: tenants.saas_type başına kullanıcı sayısı (kart için)
    // systemAdmins / systemBots: platform-seviye hesaplar (Sistem sekmesi)
    const tenantSaasMap = new Map<string, string | null>();
    for (const t of tenants ?? []) {
      tenantSaasMap.set(t.id as string, (t.saas_type as string | null) ?? null);
    }

    const counts: Record<string, number> = {};
    const saasUserCounts: Record<string, number> = {};
    let total = 0;
    let saasUserCount = 0;
    let systemAdmins = 0;
    let systemBots = 0;
    if (profilesRaw) {
      for (const u of profilesRaw) {
        total++;
        if (u.role === 'system') {
          systemBots++;
          continue;
        }
        if (!u.tenant_id) {
          if (u.role === 'admin' || u.role === 'super_admin') systemAdmins++;
          continue;
        }
        counts[u.tenant_id] = (counts[u.tenant_id] || 0) + 1;
        saasUserCount++;
        const saasType = tenantSaasMap.get(u.tenant_id);
        if (saasType) saasUserCounts[saasType] = (saasUserCounts[saasType] || 0) + 1;
      }
    }

    const { data: users } = await supabase
      .from('profiles')
      .select('id, display_name, email, phone, whatsapp_phone, tenant_id, role, created_at')
      .order('created_at', { ascending: false });

    const demoTenantIds = getAllTenants()
      .map((t) => t.tenantId)
      .filter((id): id is string => Boolean(id));
    const demoSet = new Set(demoTenantIds);

    const enrichedTenants = (tenants || []).map((t: { id?: string; saas_type?: string; [key: string]: unknown }) => {
      const cfg = t.saas_type ? getTenantByKey(t.saas_type) : null;
      return {
        ...t,
        whatsapp_phone: cfg?.whatsappPhone || "31644967207",
        is_demo: t.id ? demoSet.has(t.id as string) : false,
      };
    });

    return NextResponse.json({
      tenants: enrichedTenants,
      userCounts: counts,
      totalUsers: total,
      saasUserCount,
      saasUserCounts,
      systemAdmins,
      systemBots,
      currentUserId: auth.userId,
      demoTenantIds,
      users: users || [],
    });
  } catch (err) {
    console.error('[admin/stats] Error:', err);
    return NextResponse.json({
      tenants: [],
      userCounts: {},
      totalUsers: 0,
      saasUserCount: 0,
      saasUserCounts: {},
      systemAdmins: 0,
      systemBots: 0,
      currentUserId: null,
      demoTenantIds: [],
    });
  }
}
