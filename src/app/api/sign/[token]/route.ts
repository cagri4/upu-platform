import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/platform/auth/supabase';
import { sendButtons } from '@/platform/whatsapp/send';

export const dynamic = 'force-dynamic';

// GET — fetch contract info by sign token
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = getServiceClient();

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, type, status, contract_data, signed_at')
    .eq('sign_token', token)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: 'Sözleşme bulunamadı.' }, { status: 404 });
  }

  const cd = contract.contract_data as Record<string, unknown>;
  const summary = {
    property_title: cd.property_title,
    property_address: cd.property_address,
    owner_name: cd.owner_name,
    exclusive: cd.exclusive,
    commission: cd.commission,
    duration: cd.duration,
  };

  if (contract.signed_at) {
    // Return signed contract with signature URL + details
    const { data: full } = await supabase
      .from('contracts')
      .select('owner_signature_url')
      .eq('id', contract.id)
      .single();

    return NextResponse.json({
      id: contract.id,
      type: contract.type,
      status: contract.status,
      signed: true,
      signed_at: contract.signed_at,
      signature_url: full?.owner_signature_url || null,
      summary,
    });
  }

  return NextResponse.json({
    id: contract.id,
    type: contract.type,
    status: contract.status,
    summary,
  });
}

// POST — save signature + notify agent via WhatsApp
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const body = await req.json();
  const { signature } = body;

  if (!signature || !signature.startsWith('data:image/png;base64,')) {
    return NextResponse.json({ error: 'Geçerli bir imza gönderin.' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: contract, error: findErr } = await supabase
    .from('contracts')
    .select('id, user_id, contract_data, signed_at')
    .eq('sign_token', token)
    .single();

  if (findErr || !contract) {
    return NextResponse.json({ error: 'Sözleşme bulunamadı.' }, { status: 404 });
  }

  if (contract.signed_at) {
    return NextResponse.json({ error: 'Bu sözleşme zaten imzalanmış.' }, { status: 400 });
  }

  // Convert base64 to buffer and upload
  const base64Data = signature.replace('data:image/png;base64,', '');
  const buffer = Buffer.from(base64Data, 'base64');

  const signPath = `${contract.user_id}/${contract.id}_signature.png`;
  const { error: uploadErr } = await supabase.storage
    .from('contracts')
    .upload(signPath, buffer, { contentType: 'image/png', upsert: true });

  if (uploadErr) {
    console.error('[sign] upload error:', uploadErr);
    return NextResponse.json({ error: 'İmza kaydedilemedi.' }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(signPath);

  // Update contract
  await supabase
    .from('contracts')
    .update({
      owner_signature_url: urlData.publicUrl,
      signed_at: new Date().toISOString(),
      status: 'signed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', contract.id);

  // Notify agent via WhatsApp
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('whatsapp_phone')
      .eq('id', contract.user_id)
      .single();

    const cd = contract.contract_data as Record<string, unknown>;
    const ownerName = (cd.owner_name as string) || 'Mülk sahibi';

    if (profile?.whatsapp_phone) {
      await sendButtons(
        profile.whatsapp_phone,
        `✅ Sözleşme imzalandı!\n\n${ownerName} yetkilendirme sözleşmesini imzaladı.\n\n📋 Sözleşmelerim komutunu kullanarak inceleyebilirsiniz.`,
        [
          { id: 'cmd:sozlesmelerim', title: 'Sözleşmelerim' },
          { id: 'cmd:menu', title: 'Ana Menü' },
        ],
      );
    }
  } catch (err) {
    console.error('[sign] notification error:', err);
  }

  return NextResponse.json({ success: true, message: 'İmzanız kaydedildi. Teşekkürler!' });
}
