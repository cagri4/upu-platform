import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/platform/auth/supabase';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, name, email, phone, type } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId zorunlu' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // ── Reusable invite link mode ──
    // When type=link (or no name provided), create/return a multi-use invite link
    if (type === 'link' || !name) {
      // Check if an active link already exists for this tenant
      const { data: existing } = await supabase
        .from('invite_links')
        .select('id, code, is_active, max_uses, used_count, expires_at, created_at')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          code: existing.code,
          isExisting: true,
          usedCount: existing.used_count,
          maxUses: existing.max_uses,
        });
      }

      // Create new reusable invite link (8-char uppercase hex)
      const code = randomBytes(4).toString('hex').toUpperCase();
      const { error: insertErr } = await supabase.from('invite_links').insert({
        code,
        tenant_id: tenantId,
        role: 'admin',
        permissions: {},
        max_uses: null,    // unlimited
        used_count: 0,
        is_active: true,
      });

      if (insertErr) {
        console.error('[admin/invite] Link create error:', insertErr);
        return NextResponse.json({ error: 'Link olusturulamadi' }, { status: 500 });
      }

      return NextResponse.json({
        code,
        isExisting: false,
        usedCount: 0,
        maxUses: null,
      });
    }

    // ── Legacy single-use invite code mode (backward compat) ──
    // Create auth user
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: email || `${Date.now()}@placeholder.upudev.nl`,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authErr || !authUser.user) {
      console.error('[admin/invite] Auth error:', authErr);
      return NextResponse.json({ error: 'Kullanici olusturulamadi' }, { status: 500 });
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
    return NextResponse.json({ error: 'Bir hata olustu' }, { status: 500 });
  }
}
