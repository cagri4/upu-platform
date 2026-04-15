import { NextResponse } from 'next/server';
import { getServiceClient } from '@/platform/auth/supabase';
import { getTenantByKey } from '@/tenants/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getServiceClient();

    // Get all tenants
    const { data: tenants } = await supabase
      .from('tenants')
      .select('*')
      .order('name');

    // Get user counts per tenant
    const { data: userCounts } = await supabase
      .from('profiles')
      .select('tenant_id');

    const counts: Record<string, number> = {};
    let total = 0;
    if (userCounts) {
      for (const u of userCounts) {
        if (u.tenant_id) {
          counts[u.tenant_id] = (counts[u.tenant_id] || 0) + 1;
          total++;
        }
      }
    }

    // Get all users with details
    const { data: users } = await supabase
      .from('profiles')
      .select('id, display_name, email, phone, whatsapp_phone, tenant_id, role, created_at')
      .order('created_at', { ascending: false });

    // Enrich tenants with whatsappPhone from config
    const enrichedTenants = (tenants || []).map((t: { saas_type?: string; [key: string]: unknown }) => {
      const cfg = t.saas_type ? getTenantByKey(t.saas_type) : null;
      return { ...t, whatsapp_phone: cfg?.whatsappPhone || "31644967207" };
    });

    return NextResponse.json({
      tenants: enrichedTenants,
      userCounts: counts,
      totalUsers: total,
      users: users || [],
    });
  } catch (err) {
    console.error('[admin/stats] Error:', err);
    return NextResponse.json({ tenants: [], userCounts: {}, totalUsers: 0 });
  }
}
