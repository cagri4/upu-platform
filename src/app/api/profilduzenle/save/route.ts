/**
 * /api/profilduzenle/save — agent profilini günceller
 * (profiles.metadata.agent_profile jsonb).
 *
 * Kayıt sonrası WA'ya "✅ Profil kaydedildi" mesajı + sonraki flow
 * (Web Sayfası) magic link butonu after() içinde gönderilir.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { sendUrlButton, sendText } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

interface AgentProfile {
  full_name?: string;
  phone?: string;
  email?: string;
  office_address?: string;
  photo_url?: string;
  years_experience?: number;
  bio?: string;
  web_slug?: string;
}

function slugify(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ş/g, "s").replace(/ı/g, "i").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

async function ensureUniqueSlug(supabase: ReturnType<typeof getServiceClient>, base: string, userId: string): Promise<string> {
  const root = base || "agent";
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? root : `${root}-${i}`;
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .filter("metadata->agent_profile->>web_slug", "eq", candidate)
      .neq("id", userId)
      .limit(1);
    if (!data || data.length === 0) return candidate;
  }
  return `${root}-${randomBytes(2).toString("hex")}`;
}

export async function POST(req: NextRequest) {
  try {
    // Defense-in-depth: emlak-only — after() callback estateai URL + emlak
    // menu import içeriyor, başka SaaS'ta yazılırsa data + WA mesajı yanlış.
    const host = req.headers.get("host") || "";
    const tenantKey = getTenantByDomain(host)?.key || null;
    if (tenantKey !== "emlak") {
      return NextResponse.json(
        { error: `Profil düzenleme yalnız emlak SaaS'ında aktif (tenant: ${tenantKey || "unknown"}).` },
        { status: 403 },
      );
    }

    const body = await req.json();
    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getServiceClient();
    const userId = auth.userId;

    const fullName = String(body.full_name || "").trim();
    if (fullName.length < 2) {
      return NextResponse.json({ error: "Ad soyad gerekli." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, metadata, whatsapp_phone")
      .eq("id", userId)
      .single();
    const meta = (profile?.metadata as Record<string, unknown> | null) || {};
    const existingAgent = (meta.agent_profile as AgentProfile) || {};

    let webSlug: string = String(body.web_slug || existingAgent.web_slug || "").trim();
    if (!webSlug) {
      webSlug = slugify(fullName);
    } else {
      webSlug = slugify(webSlug);
    }
    webSlug = await ensureUniqueSlug(supabase, webSlug, userId);

    const newAgent: AgentProfile = {
      full_name: fullName,
      phone: body.phone ? String(body.phone).trim() : existingAgent.phone,
      email: body.email ? String(body.email).trim() : existingAgent.email,
      office_address: body.office_address ? String(body.office_address).trim() : "",
      photo_url: body.photo_url ? String(body.photo_url).trim() : existingAgent.photo_url || "",
      years_experience: body.years_experience ? Number(body.years_experience) : existingAgent.years_experience,
      bio: body.bio ? String(body.bio).trim() : "",
      web_slug: webSlug,
    };

    const newMeta = { ...meta, agent_profile: newAgent };

    const { error } = await supabase
      .from("profiles")
      .update({
        metadata: newMeta,
        display_name: fullName,
      })
      .eq("id", userId);

    if (error) {
      console.error("[profilduzenle:save]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const userPhone = profile?.whatsapp_phone as string | undefined;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
    const webPageUrl = `${appUrl}/u/${webSlug}`;

    after(async () => {
      try {
        if (!userPhone) return;
        const sb = getServiceClient();

        await sendText(
          userPhone,
          `✅ *Profil kaydedildi!*\n\n👤 ${fullName}${newAgent.office_address ? `\n📍 ${newAgent.office_address}` : ""}${newAgent.years_experience ? `\n🎓 ${newAgent.years_experience} yıl tecrübe` : ""}\n\nProfil bilgileriniz hem sunumlarda hem birazdan paylaşacağım kişisel web sayfanızda kullanılacak.`,
        );

        // Sonraki flow: Web Sayfası
        const webToken = randomBytes(16).toString("hex");
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await sb.from("magic_link_tokens").insert({
          user_id: userId,
          token: webToken,
          expires_at: expires,
        });
        const webPanelUrl = `${appUrl}/tr/web-sayfam?t=${webToken}`;

        await sendUrlButton(
          userPhone,
          `🌐 *Kişisel web sayfanız hazır!*\n\nProfilinize göre tek sayfalık bir landing page hazırladım — fotoğrafınız, hakkınızda yazısı, mülk listeniz ve iletişim bilgileri.\n\n*Adresiniz:*\n${webPageUrl}\n\nÖnizlemek ve paylaşmak için aşağıdaki butona tıklayın.`,
          "🌐 Web Sayfamı Aç",
          webPanelUrl,
          { skipNav: true },
        );

        const { sendBackToPanel } = await import("@/tenants/emlak/menu");
        await sendBackToPanel(userId, userPhone);
      } catch (err) {
        console.error("[profilduzenle:save] WA notify failed:", err);
      }
    });

    return NextResponse.json({ success: true, web_slug: webSlug, web_url: webPageUrl });
  } catch (err) {
    console.error("[profilduzenle:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
