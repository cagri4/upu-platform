import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

export async function handleSozlesmelerim(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, status, contract_data, signed_at, created_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!contracts || contracts.length === 0) {
    await sendButtons(ctx.phone, "📋 Henüz sözleşmeniz yok.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const rows = contracts.map((c) => {
    const cd = c.contract_data as Record<string, unknown>;
    const ownerName = (cd.owner_name as string) || "İsimsiz";
    const statusLabel = c.status === "signed" ? "✅" : c.status === "pending_signature" ? "⏳" : "📝";
    return {
      id: `szl:view:${c.id}`,
      title: `${statusLabel} ${ownerName}`.substring(0, 24),
      description: new Date(c.created_at).toLocaleDateString("tr-TR"),
    };
  });

  await sendList(ctx.phone, "📋 Sözleşmeleriniz\n\nDetay görmek için seçin.", "Göster", [
    { title: "Sözleşmeler", rows },
  ]);
}

export async function handleWebpanel(ctx: WaContext): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://upu-platform.vercel.app";

  // Generate magic link
  try {
    const supabase = getServiceClient();
    const { randomBytes } = await import("crypto");
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase.from("magic_link_tokens").insert({
      user_id: ctx.userId,
      token,
      expires_at: expiresAt,
    });

    const magicUrl = `${appUrl}/auth/magic?token=${token}`;
    await sendButtons(ctx.phone,
      `🖥 Web Panel\n\nAşağıdaki linke tıklayarak giriş yapın:\n\n${magicUrl}\n\n⏱ 15 dakika geçerli.`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );
  } catch {
    await sendButtons(ctx.phone,
      `🖥 Web Panel\n\n${appUrl}/tr/login`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );
  }
}
