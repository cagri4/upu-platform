import { NextResponse } from 'next/server';
import { getServiceClient } from '@/platform/auth/supabase';

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

    return NextResponse.json({
      tenants: tenants || [],
      userCounts: counts,
      totalUsers: total,
    });
  } catch (err) {
    console.error('[admin/stats] Error:', err);
    return NextResponse.json({ tenants: [], userCounts: {}, totalUsers: 0 });
  }
}
