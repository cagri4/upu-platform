/**
 * /bayidurum (alias: /bayilerim) — bayi listesi web paneline yönlendir.
 * /ziyaretler — Planlı ziyaret listesi
 * /ziyaretnotu — Web panel yönlendirme
 *
 * 2026-05-04: text-tabanlı liste/detay kaldırıldı; bayi yönetimi tamamen
 * web panel'e taşındı (/[locale]/bayiler + /[locale]/bayiler/[id]).
 * WA cevabı: kısa mesaj + magic-link CTA URL butonu.
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendUrlButton } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { webPanelRedirect } from "./helpers";
import { randomBytes } from "crypto";

const BAYI_APP_URL = "https://retailai.upudev.nl";

async function mintBayiLinkToken(userId: string): Promise<string> {
  const sb = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({ user_id: userId, token, expires_at: expiresAt });
  return token;
}

export async function handleBayiDurum(ctx: WaContext): Promise<void> {
  try {
    const args = ctx.text.replace(/^\/?\s*(bayidurum|bayilerim|bayiler|bayi)\s*/i, "").trim();
    const token = await mintBayiLinkToken(ctx.userId);

    if (args && args.length > 1) {
      // İsim parametresi var → arama yap, bulunduysa detay sayfasına yönlendir
      const supabase = getServiceClient();
      const { data: dealers } = await supabase
        .from("bayi_dealers")
        .select("id, name")
        .eq("tenant_id", ctx.tenantId)
        .ilike("name", `%${args}%`)
        .limit(1);

      if (dealers?.length) {
        const dealer = dealers[0];
        const url = `${BAYI_APP_URL}/tr/bayiler/${dealer.id}?t=${token}`;
        await sendUrlButton(ctx.phone,
          `🏪 *${dealer.name}* — detay sayfası web panelde açılıyor.`,
          "📋 Bayi Detayını Aç",
          url,
          { skipNav: true },
        );
        return;
      }
      // Bulunamadı → liste'ye gönder + uyarı
      const url = `${BAYI_APP_URL}/tr/bayiler?t=${token}&q=${encodeURIComponent(args)}`;
      await sendUrlButton(ctx.phone,
        `🔍 "*${args}*" ile eşleşen bayi bulunamadı. Liste sayfasında arama formu açacağım.`,
        "📋 Bayi Listesini Aç",
        url,
        { skipNav: true },
      );
      return;
    }

    // Args yok → liste sayfası
    const url = `${BAYI_APP_URL}/tr/bayiler?t=${token}`;
    await sendUrlButton(ctx.phone,
      `📋 *Bayilerinizi web panelde gösterdim.*\n\nArama, filtreleme ve detay görüntüleme için aşağıdaki linke tıklayın.`,
      "📋 Bayi Listesini Aç",
      url,
      { skipNav: true },
    );
  } catch (err) {
    console.error("[bayi:bayidurum] error:", err);
    await sendText(ctx.phone, "Bayi listesi yüklenirken bir hata oluştu.");
  }
}

export async function handleZiyaretler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const now = new Date();

    const { data: visits } = await supabase
      .from("bayi_dealer_visits")
      .select("planned_date, visit_type, outcome, notes, bayi_dealers!inner(company_name)")
      .eq("tenant_id", ctx.tenantId)
      .gte("planned_date", now.toISOString())
      .order("planned_date", { ascending: true })
      .limit(10);

    if (!visits?.length) {
      await sendButtons(ctx.phone, "📅 *Bayi Ziyaretleri*\n\nPlanlanmis ziyaret bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = visits.map((v: any, i: number) => {
      const date = new Date(v.planned_date);
      const day = date.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "short" });
      const dealer = v.bayi_dealers?.company_name || "Bilinmeyen";
      return `${i + 1}. ${day} — ${dealer}\n   ${v.visit_type || "Rutin"}${v.notes ? " — " + v.notes : ""}`;
    });

    await sendButtons(
      ctx.phone,
      `📅 *Planli Ziyaretler*\n\n${lines.join("\n\n")}\n\nToplam: ${visits.length} ziyaret`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:ziyaretler] error:", err);
    await sendText(ctx.phone, "Ziyaretler yuklenirken bir hata olustu.");
  }
}

export async function handleZiyaretNotu(ctx: WaContext): Promise<void> {
  await webPanelRedirect(ctx.phone, "📝 *Ziyaret Notu*\nZiyaret notu eklemek icin web panelini kullanin.");
}
