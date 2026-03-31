/**
 * /websitem — Personal website builder wizard (WhatsApp multi-step)
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

const APP_URL = "https://estateai.upudev.nl";

/* ── Turkish slug helpers ──────────────────────────────────────────── */

const TR_MAP: Record<string, string> = {
  "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
  "Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (ch) => TR_MAP[ch] || ch)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const supabase = getServiceClient();
  let slug = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await supabase
      .from("agent_websites")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${base}-${suffix}`;
    suffix++;
  }
}

/* ── Entry point: /websitem ────────────────────────────────────────── */

export async function handleWebsitem(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: existing } = await supabase
    .from("agent_websites")
    .select("id, slug, full_name, theme")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (existing) {
    const url = `${APP_URL}/d/${existing.slug}`;
    await sendButtons(
      ctx.phone,
      `🌐 *Kişisel Web Siteniz*\n\n👤 ${existing.full_name}\n🔗 ${url}`,
      [
        { id: "websitem_action:view", title: "Siteyi Ac" },
        { id: "websitem_action:edit", title: "Duzenle" },
        { id: "websitem_action:delete", title: "Sil" },
      ],
    );
    return;
  }

  // No website — start wizard
  await startSession(ctx.userId, ctx.tenantId, "websitem", "full_name");

  if (ctx.userName) {
    await sendButtons(
      ctx.phone,
      `🌐 *Web Sitesi Sihirbazi*\n\nAdiniz Soyadiniz:\n\nOnerilen: *${ctx.userName}*\nDegistirmek isterseniz yazin, onaylamak icin butona basin.`,
      [{ id: "websitem_name_ok", title: `${ctx.userName.substring(0, 20)}` }],
    );
  } else {
    await sendText(ctx.phone, "🌐 *Web Sitesi Sihirbazi*\n\nAdiniz Soyadiniz:");
  }
}

/* ── Step handler ──────────────────────────────────────────────────── */

export async function handleWebsitemStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  const data = session.data as Record<string, unknown>;
  const step = session.current_step;

  switch (step) {
    case "full_name": {
      // Button press comes through interactiveId
      const name = ctx.interactiveId === "websitem_name_ok" ? (ctx.userName || text) : text;
      if (!name || name.length < 2) {
        await sendText(ctx.phone, "Lutfen adinizi ve soyadinizi yazin.");
        return;
      }
      await updateSession(ctx.userId, "slogan", { full_name: name });
      await sendButtons(
        ctx.phone,
        `Sloganiniz nedir?\n\n💡 Ornek: _Bodrum'da guvenilir emlak danismaniniz_`,
        [{ id: "websitem_ai_slogan", title: "AI Onerisi" }],
      );
      return;
    }

    case "slogan": {
      if (ctx.interactiveId === "websitem_ai_slogan") {
        const fullName = data.full_name as string;
        try {
          const { askClaude } = await import("@/platform/ai/claude");
          const result = await askClaude(
            "Sen emlak danismani slogani yaziyorsun. Kisa, akilda kalici, Turkce. Max 10 kelime. Sadece slogani yaz, baska bir sey yazma.",
            `Danismanin adi: ${fullName}`,
            256,
          );
          if (result) {
            await sendButtons(
              ctx.phone,
              `🤖 AI onerisi:\n\n_${result}_\n\nBu slogani kullanmak ister misiniz?`,
              [
                { id: "websitem_slogan_ok", title: "Onayla" },
                { id: "websitem_slogan_new", title: "Baska yaz" },
              ],
            );
            await updateSession(ctx.userId, "slogan_confirm", { ...data, ai_slogan: result });
            return;
          }
        } catch { /* AI unavailable */ }
        await sendText(ctx.phone, "AI su anda kullanilamiyor. Lutfen sloganinizi yazin:");
        return;
      }
      if (!text) {
        await sendText(ctx.phone, "Lutfen bir slogan yazin veya AI butonunu kullanin.");
        return;
      }
      await updateSession(ctx.userId, "bio", { ...data, slogan: text });
      await sendButtons(
        ctx.phone,
        "Kisa biyografiniz (2-3 cumle):",
        [{ id: "websitem_ai_bio", title: "AI Yaz" }],
      );
      return;
    }

    case "slogan_confirm": {
      if (ctx.interactiveId === "websitem_slogan_ok") {
        const slogan = data.ai_slogan as string;
        await updateSession(ctx.userId, "bio", { ...data, slogan });
        await sendButtons(
          ctx.phone,
          "Kisa biyografiniz (2-3 cumle):",
          [{ id: "websitem_ai_bio", title: "AI Yaz" }],
        );
        return;
      }
      // They want a different slogan
      await updateSession(ctx.userId, "slogan", data);
      await sendText(ctx.phone, "Sloganinizi yazin:");
      return;
    }

    case "bio": {
      if (ctx.interactiveId === "websitem_ai_bio") {
        const fullName = data.full_name as string;
        const slogan = data.slogan as string;
        try {
          const { askClaude } = await import("@/platform/ai/claude");
          const result = await askClaude(
            "Sen emlak danismani biyografisi yaziyorsun. 2-3 cumle, profesyonel ama samimi ton. Turkce. Sadece biyografiyi yaz.",
            `Danismanin adi: ${fullName}\nSlogan: ${slogan || "yok"}`,
            256,
          );
          if (result) {
            await sendButtons(
              ctx.phone,
              `🤖 AI onerisi:\n\n${result}\n\nBu biyografiyi kullanmak ister misiniz?`,
              [
                { id: "websitem_bio_ok", title: "Onayla" },
                { id: "websitem_bio_new", title: "Kendim yazayim" },
              ],
            );
            await updateSession(ctx.userId, "bio_confirm", { ...data, ai_bio: result });
            return;
          }
        } catch { /* AI unavailable */ }
        await sendText(ctx.phone, "AI su anda kullanilamiyor. Lutfen biyografinizi yazin:");
        return;
      }
      if (!text) {
        await sendText(ctx.phone, "Lutfen biyografinizi yazin veya AI butonunu kullanin.");
        return;
      }
      await updateSession(ctx.userId, "phone", { ...data, bio: text });
      await askPhone(ctx, data);
      return;
    }

    case "bio_confirm": {
      if (ctx.interactiveId === "websitem_bio_ok") {
        const bio = data.ai_bio as string;
        await updateSession(ctx.userId, "phone", { ...data, bio });
        await askPhone(ctx, data);
        return;
      }
      await updateSession(ctx.userId, "bio", data);
      await sendText(ctx.phone, "Biyografinizi yazin:");
      return;
    }

    case "phone": {
      if (ctx.interactiveId === "websitem_phone_ok") {
        // Use WhatsApp phone
        await updateSession(ctx.userId, "email", { ...data, phone: ctx.phone });
        await sendButtons(ctx.phone, "E-posta adresiniz (opsiyonel):", [
          { id: "websitem_skip_email", title: "Atla" },
        ]);
        return;
      }
      if (!text) {
        await sendText(ctx.phone, "Lutfen telefon numaranizi yazin.");
        return;
      }
      await updateSession(ctx.userId, "email", { ...data, phone: text });
      await sendButtons(ctx.phone, "E-posta adresiniz (opsiyonel):", [
        { id: "websitem_skip_email", title: "Atla" },
      ]);
      return;
    }

    case "email": {
      const email = ctx.interactiveId === "websitem_skip_email" ? null : (text || null);
      await updateSession(ctx.userId, "theme", { ...data, email });
      await sendButtons(ctx.phone, "Tema rengi secin:", [
        { id: "websitem_theme:blue", title: "Mavi" },
        { id: "websitem_theme:green", title: "Yesil" },
        { id: "websitem_theme:purple", title: "Mor" },
      ]);
      return;
    }

    case "theme": {
      // Theme is handled via callback, but user might type
      const themeMap: Record<string, string> = {
        mavi: "blue", yesil: "green", mor: "purple",
        blue: "blue", green: "green", purple: "purple",
      };
      const theme = themeMap[text.toLowerCase()] || "blue";
      await updateSession(ctx.userId, "experience", { ...data, theme });
      await sendText(ctx.phone, "Kac yildir emlak sektorundesiniz? (sayi yazin)");
      return;
    }

    case "experience": {
      const years = parseInt(text, 10);
      if (isNaN(years) || years < 0 || years > 100) {
        await sendText(ctx.phone, "Lutfen gecerli bir sayi yazin (orn: 5).");
        return;
      }
      // All data collected — create website
      const finalData = { ...data, experience_years: years };
      await createWebsite(ctx, finalData);
      return;
    }

    default:
      await sendText(ctx.phone, "Bir hata olustu. /websitem ile tekrar deneyin.");
      await endSession(ctx.userId);
  }
}

/* ── Callback handler ──────────────────────────────────────────────── */

export async function handleWebsitemCallback(ctx: WaContext, callbackData: string): Promise<void> {
  // Action callbacks (view/edit/delete)
  if (callbackData.startsWith("websitem_action:")) {
    const action = callbackData.replace("websitem_action:", "");
    const supabase = getServiceClient();

    if (action === "view") {
      const { data: site } = await supabase
        .from("agent_websites")
        .select("slug")
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (site) {
        await sendText(ctx.phone, `🌐 ${APP_URL}/d/${site.slug}`);
      } else {
        await sendText(ctx.phone, "Web siteniz bulunamadi.");
      }
      return;
    }

    if (action === "edit") {
      // Delete old, start new wizard
      await supabase.from("agent_websites").delete().eq("user_id", ctx.userId);
      await sendText(ctx.phone, "Mevcut siteniz silindi. Yeniden olusturalim...");
      await handleWebsitem(ctx);
      return;
    }

    if (action === "delete") {
      await supabase.from("agent_websites").delete().eq("user_id", ctx.userId);
      await sendButtons(ctx.phone, "🗑 Web siteniz silindi.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }
    return;
  }

  // Theme callbacks
  if (callbackData.startsWith("websitem_theme:")) {
    const theme = callbackData.replace("websitem_theme:", "");
    const session = await getSessionData(ctx.userId);
    if (!session) {
      await sendText(ctx.phone, "Oturum bulunamadi. /websitem ile tekrar deneyin.");
      return;
    }
    await updateSession(ctx.userId, "experience", { ...session.data, theme });
    await sendText(ctx.phone, "Kac yildir emlak sektorundesiniz? (sayi yazin)");
    return;
  }
}

/* ── Helpers ───────────────────────────────────────────────────────── */

async function askPhone(ctx: WaContext, data: Record<string, unknown>) {
  // ctx.phone is the WhatsApp number
  await sendButtons(
    ctx.phone,
    `Telefon numaraniz:\n\nWhatsApp numaraniz: ${ctx.phone}\nBu numara mi kullanilsin?`,
    [
      { id: "websitem_phone_ok", title: "Bu numara" },
      { id: "websitem_phone_diff", title: "Farkli numara" },
    ],
  );
}

async function getSessionData(userId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("command_sessions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data as CommandSession | null;
}

async function createWebsite(ctx: WaContext, data: Record<string, unknown>) {
  const supabase = getServiceClient();

  const fullName = data.full_name as string;
  const baseSlug = slugify(fullName);
  const slug = await uniqueSlug(baseSlug || "danisaman");

  const { error } = await supabase.from("agent_websites").insert({
    user_id: ctx.userId,
    slug,
    full_name: fullName,
    slogan: data.slogan || null,
    bio: data.bio || null,
    phone: data.phone || ctx.phone,
    email: data.email || null,
    theme: data.theme || "blue",
    experience_years: data.experience_years || null,
  });

  await endSession(ctx.userId);

  if (error) {
    console.error("[websitem] insert error:", error);
    await sendButtons(ctx.phone, "Bir hata olustu. Lutfen tekrar deneyin.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }

  const themeLabels: Record<string, string> = { blue: "Mavi", green: "Yesil", purple: "Mor" };
  const themeName = themeLabels[(data.theme as string) || "blue"] || "Mavi";

  await sendButtons(
    ctx.phone,
    `✅ Web siteniz hazir!\n\n🌐 ${APP_URL}/d/${slug}\n\n👤 ${fullName}\n💬 ${data.slogan || "-"}\n🎨 Tema: ${themeName}`,
    [
      { id: "websitem_action:view", title: "Siteyi Ac" },
      { id: "cmd:menu", title: "Ana Menu" },
    ],
  );
}
