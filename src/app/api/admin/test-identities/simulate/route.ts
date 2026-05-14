/**
 * POST /api/admin/test-identities/simulate
 *
 * Body: { virtual_phone, message_text, tenant_subdomain? }
 *
 * Sahte WA webhook payload üretir, /api/whatsapp POST handler'ı `withSimulateBuffer`
 * AsyncLocalStorage context'inde çağırır. Send fonksiyonları gerçek Meta'ya
 * gitmez — buffer'a yazılır, response'a yansır.
 *
 * Profile state before/after da raporlanır (admin "yeni profile yaratıldı mı"
 * sorusunu cevaplayabilsin).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAdminUser } from "@/platform/admin/auth";
import { withSimulateBuffer, type SimulatedMessage } from "@/platform/whatsapp/send";
import { POST as webhookPost } from "@/app/api/whatsapp/route";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  let body: {
    virtual_phone?: string;
    message_text?: string;
    tenant_subdomain?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const virtualPhone = (body.virtual_phone ?? "").trim();
  const messageText = (body.message_text ?? "").trim();
  if (!/^[0-9]{6,15}$/.test(virtualPhone)) {
    return NextResponse.json(
      { error: "virtual_phone rakam olmalı (6-15 hane)." },
      { status: 400 },
    );
  }
  if (!messageText) {
    return NextResponse.json({ error: "message_text gerekli." }, { status: 400 });
  }

  const sb = getServiceClient();

  // Sahibinin admin_user_id'sine bağlı identity mi? (başkasının test phone'unu
  // kullanmayı engellemek için)
  const { data: identity } = await sb
    .from("admin_test_identities")
    .select("id, display_name, target_tenant")
    .eq("admin_user_id", auth.userId)
    .eq("virtual_phone", virtualPhone)
    .maybeSingle();

  if (!identity) {
    return NextResponse.json(
      { error: "Bu virtual_phone size ait test identity'lerinde yok." },
      { status: 404 },
    );
  }

  // Profile state — before
  const { data: profilesBefore } = await sb
    .from("profiles")
    .select("id, tenant_id, role, created_at")
    .eq("whatsapp_phone", virtualPhone);

  // Sahte WA webhook payload (Meta Cloud API formatı — parseWebhook bunu okur)
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: virtualPhone,
                  id: `simulate-${Date.now()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: messageText },
                },
              ],
              contacts: [
                { profile: { name: identity.display_name || "TestUser" } },
              ],
            },
          },
        ],
      },
    ],
  };

  // Sahte NextRequest — webhook POST içeride payload.json() okur
  const fakeReq = new NextRequest("http://internal.simulate/api/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const buffer: SimulatedMessage[] = [];
  let webhookStatus: number = 200;
  let webhookError: string | null = null;
  try {
    const resp = await withSimulateBuffer(buffer, () => webhookPost(fakeReq));
    webhookStatus = resp.status;
  } catch (err) {
    webhookError = err instanceof Error ? err.message : String(err);
    console.error("[admin/test-identities/simulate]", err);
  }

  // Profile state — after
  const { data: profilesAfter } = await sb
    .from("profiles")
    .select("id, tenant_id, role, created_at")
    .eq("whatsapp_phone", virtualPhone);

  return NextResponse.json({
    success: !webhookError,
    webhook_status: webhookStatus,
    webhook_error: webhookError,
    captured_messages: buffer,
    profiles_before: profilesBefore ?? [],
    profiles_after: profilesAfter ?? [],
  });
}
