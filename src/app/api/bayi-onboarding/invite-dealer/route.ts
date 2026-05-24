/**
 * POST /api/bayi-onboarding/invite-dealer — Step3 mini-davet.
 * Body: { phone, name? }
 * dealer_invitations row insert + accept_url döner. Bot otomatik
 * göndermez — admin kendi WA'sından paylaşır (24h window kuralı).
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://retailai.upudev.nl";

function normalizePhone(input: string): string {
  return input.replace(/[^\d]/g, "");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const phoneRaw = String(body.phone || "").trim();
  const name = body.name ? String(body.name).trim().slice(0, 120) : null;
  const phone = normalizePhone(phoneRaw);

  if (!phone || phone.length < 8 || phone.length > 15) {
    return NextResponse.json({ error: "Geçerli bir telefon girin." }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  // Çift davet engelle
  const { data: existing } = await sb
    .from("dealer_invitations")
    .select("id, code, status")
    .eq("distributor_user_id", lookup.profile.id)
    .eq("phone", phone)
    .in("status", ["pending"])
    .maybeSingle();

  let code: string;
  if (existing) {
    code = existing.code;
  } else {
    code = randomBytes(3).toString("hex").toUpperCase();
    const { error } = await sb
      .from("dealer_invitations")
      .insert({
        distributor_user_id: lookup.profile.id,
        distributor_tenant_id: lookup.tenantId,
        phone,
        name,
        code,
        status: "pending",
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const acceptUrl = `${APP_URL}/tr/bayi-baglanti?code=${code}`;

  return NextResponse.json({
    success: true,
    code,
    accept_url: acceptUrl,
    share_phone: `+${phone}`,
  });
}
