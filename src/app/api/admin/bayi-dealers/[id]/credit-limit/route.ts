/**
 * POST /api/admin/bayi-dealers/[id]/credit-limit
 *
 * Bayi kredi limitini günceller. İki kullanıcı tipi yetkili:
 *   1. Platform admin: role='admin' AND tenant_id IS NULL
 *   2. Tenant sahibi: kendi bayi tenant'ındaki role IN ('admin', 'user')
 *
 * Body: { new_limit: number | null, reason?: string }
 *   - new_limit = null → limitsiz (validation bypass)
 *   - new_limit = number → bayinin balance + sipariş tutarı tavanı
 *
 * Her UPDATE bayi_credit_limit_audit tablosuna log düşer (kim/ne zaman/ne).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";

export const dynamic = "force-dynamic";

interface RouteCtx { params: Promise<{ id: string }> }

const TENANT_ADMIN_ROLES = new Set(["admin", "user"]);

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { id: dealerId } = await ctx.params;
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();

  // Aktör profili — platform admin mi yoksa tenant sahibi mi?
  const { data: actor } = await sb
    .from("profiles")
    .select("id, role, is_platform_admin, tenant_id, auth_user_id")
    .or(`id.eq.${auth.userId},auth_user_id.eq.${auth.userId}`)
    .maybeSingle();
  if (!actor) {
    return NextResponse.json({ error: "Profil bulunamadı." }, { status: 403 });
  }

  const isPlatformAdmin = actor.is_platform_admin === true;

  // Hedef bayi — hangi tenant'a ait?
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id, tenant_id, credit_limit, company_name")
    .eq("id", dealerId)
    .maybeSingle();
  if (!dealer) {
    return NextResponse.json({ error: "Bayi bulunamadı." }, { status: 404 });
  }

  // Tenant sahibi sadece kendi tenant'ının bayisini güncelleyebilir.
  if (!isPlatformAdmin) {
    const isTenantAdmin =
      TENANT_ADMIN_ROLES.has(actor.role || "") && actor.tenant_id === dealer.tenant_id;
    if (!isTenantAdmin) {
      return NextResponse.json(
        { error: "Bu bayi için kredi limiti güncelleme yetkiniz yok." },
        { status: 403 },
      );
    }
  }

  let body: { new_limit?: number | null; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  if (!Object.prototype.hasOwnProperty.call(body, "new_limit")) {
    return NextResponse.json({ error: "new_limit alanı zorunlu." }, { status: 400 });
  }

  let newLimit: number | null;
  if (body.new_limit === null) {
    newLimit = null;
  } else {
    const n = Number(body.new_limit);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json(
        { error: "new_limit ≥ 0 sayı olmalı veya null (limitsiz)." },
        { status: 400 },
      );
    }
    newLimit = Math.round(n * 100) / 100;
  }

  const reason = (body.reason || "").trim().slice(0, 500) || null;
  const oldLimit = dealer.credit_limit !== null ? Number(dealer.credit_limit) : null;

  const { error: updateErr } = await sb
    .from("bayi_dealers")
    .update({ credit_limit: newLimit, updated_at: new Date().toISOString() })
    .eq("id", dealerId);
  if (updateErr) {
    console.error("[admin/bayi-dealers/credit-limit] update failed:", updateErr);
    return NextResponse.json({ error: "Limit güncellenemedi." }, { status: 500 });
  }

  // Audit log — best-effort; başarısız olsa bile update geçerli sayılır.
  const auditInsert = await sb
    .from("bayi_credit_limit_audit")
    .insert({
      tenant_id: dealer.tenant_id,
      dealer_id: dealerId,
      changed_by_user_id: actor.id,
      old_limit: oldLimit,
      new_limit: newLimit,
      reason,
    });
  if (auditInsert.error) {
    console.error("[admin/bayi-dealers/credit-limit] audit insert failed:", auditInsert.error);
  }

  console.log(
    `[credit-limit] ${actor.id} (${isPlatformAdmin ? "platform" : "tenant"}-admin) ` +
    `updated dealer ${dealerId} (${dealer.company_name}) ` +
    `limit ${oldLimit === null ? "∞" : oldLimit} → ${newLimit === null ? "∞" : newLimit}`,
  );

  return NextResponse.json({
    ok: true,
    dealer_id: dealerId,
    old_limit: oldLimit,
    new_limit: newLimit,
  });
}
