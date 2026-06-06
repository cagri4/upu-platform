import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/platform/auth/supabase';
import { requireAdminUser } from '@/platform/admin/auth';
import { getTenantByKey, getAllTenants } from '@/tenants/config';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

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
      .select('tenant_id, role');

    // KATMAN C3 (2026-06-06): UI tablo başlığı ile aynı filter — role!=system
    // VE tenant_id NOT NULL. Önceki sadece tenant_id check'i header'da System
    // Scraper'ı sayıp tabloda atlanmasına neden oluyordu ("4 vs 3" mismatch).
    const counts: Record<string, number> = {};
    let total = 0;
    let orphanAdmins = 0;
    if (profilesRaw) {
      for (const u of profilesRaw) {
        if (!u.tenant_id) {
          if (ADMIN_ROLES.has(u.role)) orphanAdmins++;
          continue;
        }
        if (u.role === 'system') continue;
        counts[u.tenant_id] = (counts[u.tenant_id] || 0) + 1;
        total++;
      }
    }

    const { data: users } = await supabase
      .from('profiles')
      .select('id, display_name, email, phone, whatsapp_phone, tenant_id, role, created_at')
      .order('created_at', { ascending: false });

    // KATMAN C3: DEMO 7 UUID config'ten + is_demo enrich.
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
      orphanAdmins,
      demoTenantIds,
      users: users || [],
    });
  } catch (err) {
    console.error('[admin/stats] Error:', err);
    return NextResponse.json({ tenants: [], userCounts: {}, totalUsers: 0, orphanAdmins: 0, demoTenantIds: [] });
  }
}
