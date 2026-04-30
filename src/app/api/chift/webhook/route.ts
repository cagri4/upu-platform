/**
 * POST /api/chift/webhook — Chift events (connection.success, etc.)
 *
 * Chift OAuth flow tamamlanınca buraya POST gelir:
 *   { event: "connection.success", consumer_id, connection_id,
 *     integration_key }
 *
 * connection_id'yi profile.metadata.chift_integrations'a yazıyoruz;
 * sonraki API çağrılarında adapter bunu okuyacak.
 *
 * Güvenlik: Chift webhook signature header'ı (Chift dokümana göre
 * eklenir) doğrulanmalı; MVP'de basit token check.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

interface ChiftWebhookPayload {
  event?: string;
  consumer_id?: string;
  connection_id?: string;
  integration_key?: string;
}

export async function POST(req: NextRequest) {
  // Webhook secret check (Chift'ten gelen X-Chift-Signature ile compare —
  // production'da hmac-sha256, MVP'de bearer token)
  const expectedToken = process.env.CHIFT_WEBHOOK_SECRET;
  if (expectedToken) {
    const provided = req.headers.get("x-chift-token") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (provided !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: ChiftWebhookPayload;
  try {
    body = await req.json() as ChiftWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.event !== "connection.success") {
    // Diğer eventler (connection.failed, sync.completed) ileride handle
    return NextResponse.json({ ok: true, ignored: body.event });
  }

  if (!body.consumer_id || !body.connection_id) {
    return NextResponse.json({ error: "Missing consumer_id or connection_id" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, metadata")
    .eq("id", body.consumer_id)
    .maybeSingle();
  if (!profile) {
    console.warn("[chift:webhook] profile not found for consumer_id", body.consumer_id);
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const meta = (profile.metadata || {}) as Record<string, unknown>;
  const integrations = (meta.chift_integrations || {}) as Record<string, string>;
  integrations.accounting_connection_id = body.connection_id;
  integrations.accounting_integration_key = body.integration_key || "unknown";
  integrations.connected_at = new Date().toISOString();

  await supabase
    .from("profiles")
    .update({ metadata: { ...meta, chift_integrations: integrations } })
    .eq("id", profile.id);

  console.log("[chift:webhook] connection saved", { consumerId: body.consumer_id, integrationKey: body.integration_key });
  return NextResponse.json({ ok: true });
}
