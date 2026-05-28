/**
 * DELETE /api/admin/users/[id]
 *
 * Admin "üyeliği tamamen sil" — profile + ilişkili tüm veriler + auth.user.
 *
 * Sprint sonrası eklenen tablolar:
 *   - emlak_presentations (user_id FK, orphan kalıyordu)
 *   - saas_active_session (phone FK — multi-tenant degistir state)
 *
 * Her delete try/catch ile sarılı: biri fail ederse loglanır, diğerleri
 * devam eder (zincir kopmasın, partial cleanup yapılır).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAdminUser } from "@/platform/admin/auth";

async function safeDelete(label: string, op: PromiseLike<unknown>) {
  try {
    await op;
  } catch (err) {
    console.error(`[admin/users/delete] ${label} failed:`, err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getServiceClient();

    // Phone'u önce çek (saas_active_session phone bazlı)
    const { data: prof } = await supabase
      .from("profiles")
      .select("whatsapp_phone")
      .eq("id", id)
      .maybeSingle();
    const phone = prof?.whatsapp_phone as string | null;

    // user_id FK tabloları
    await safeDelete("command_sessions", supabase.from("command_sessions").delete().eq("user_id", id));
    await safeDelete("invite_codes", supabase.from("invite_codes").delete().eq("user_id", id));
    await safeDelete("onboarding_state", supabase.from("onboarding_state").delete().eq("user_id", id));
    await safeDelete("subscriptions", supabase.from("subscriptions").delete().eq("user_id", id));
    await safeDelete("contracts", supabase.from("contracts").delete().eq("user_id", id));
    await safeDelete("reminders", supabase.from("reminders").delete().eq("user_id", id));
    await safeDelete("bot_activity", supabase.from("bot_activity").delete().eq("user_id", id));
    await safeDelete("magic_link_tokens", supabase.from("magic_link_tokens").delete().eq("user_id", id));
    await safeDelete("emlak_properties", supabase.from("emlak_properties").delete().eq("user_id", id));
    await safeDelete("emlak_customers", supabase.from("emlak_customers").delete().eq("user_id", id));
    await safeDelete("emlak_presentations", supabase.from("emlak_presentations").delete().eq("user_id", id));

    // Phone-based (multi-tenant degistir state)
    if (phone) {
      await safeDelete(
        "saas_active_session",
        supabase.from("saas_active_session").delete().eq("phone", phone),
      );
    }

    // Profile + auth.user
    await safeDelete("profiles", supabase.from("profiles").delete().eq("id", id));
    await safeDelete("auth.users", supabase.auth.admin.deleteUser(id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/users/delete]", err);
    return NextResponse.json({ error: "Silinemedi" }, { status: 500 });
  }
}
