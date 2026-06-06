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

    // KATMAN D (2026-06-06): Şeffaflık + risk uyarısı yaklaşımı. Önceki
    // sürüm role=system + tenant_id=NULL satırlarını gizliyordu; tablo ile
    // header sayı tutarlılığı sağlanıyordu ama "gizli kullanıcılar"
    // operatöre güven vermiyordu. Şimdi her satır görünüyor, badge'le
    // risk seviyesi belli, silme akışı badge'e göre risk-aware.
    const { data: profilesRaw } = await supabase
      .from('profiles')
      .select('tenant_id, role');

    const counts: Record<string, number> = {};
    let total = 0;
    if (profilesRaw) {
      for (const u of profilesRaw) {
        total++;
        if (u.tenant_id) {
          counts[u.tenant_id] = (counts[u.tenant_id] || 0) + 1;
        }
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
      demoTenantIds,
      users: users || [],
    });
  } catch (err) {
    console.error('[admin/stats] Error:', err);
    return NextResponse.json({ tenants: [], userCounts: {}, totalUsers: 0, demoTenantIds: [] });
  }
}
