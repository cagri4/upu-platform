import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = getServiceClient();

    // Delete related data first
    await supabase.from("command_sessions").delete().eq("user_id", id);
    await supabase.from("invite_codes").delete().eq("user_id", id);
    await supabase.from("onboarding_state").delete().eq("user_id", id);
    await supabase.from("subscriptions").delete().eq("user_id", id);
    await supabase.from("contracts").delete().eq("user_id", id);
    await supabase.from("reminders").delete().eq("user_id", id);
    await supabase.from("bot_activity").delete().eq("user_id", id);
    await supabase.from("magic_link_tokens").delete().eq("user_id", id);
    await supabase.from("emlak_properties").delete().eq("user_id", id);
    await supabase.from("emlak_customers").delete().eq("user_id", id);
    await supabase.from("profiles").delete().eq("id", id);

    // Delete auth user
    await supabase.auth.admin.deleteUser(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/users/delete]", err);
    return NextResponse.json({ error: "Silinemedi" }, { status: 500 });
  }
}
