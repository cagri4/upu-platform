import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/platform/auth/supabase';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, name, email, phone } = body;

    if (!tenantId || !name) {
      return NextResponse.json({ error: 'tenantId ve name zorunlu' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Create auth user
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: email || `${Date.now()}@placeholder.upudev.nl`,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authErr || !authUser.user) {
      console.error('[admin/invite] Auth error:', authErr);
      return NextResponse.json({ error: 'Kullanıcı oluşturulamadı' }, { status: 500 });
    }

    // Create profile
    await supabase.from('profiles').insert({
      id: authUser.user.id,
      tenant_id: tenantId,
      display_name: name,
      email,
      phone,
    });

    // Generate invite code
    const code = randomBytes(3).toString('hex').toUpperCase();
    await supabase.from('invite_codes').insert({
      tenant_id: tenantId,
      user_id: authUser.user.id,
      code,
      status: 'pending',
    });

    // Create subscription (trial)
    await supabase.from('subscriptions').insert({
      tenant_id: tenantId,
      user_id: authUser.user.id,
      plan: 'trial',
      status: 'active',
    });

    return NextResponse.json({
      userId: authUser.user.id,
      inviteCode: code,
      name,
    });
  } catch (err) {
    console.error('[admin/invite] Error:', err);
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
  }
}
