import { notFound } from "next/navigation";
import { after } from "next/server";
import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "@/platform/whatsapp/send";
import type { Metadata } from "next";
import { ShareFAB } from "./share-fab";
import { SlideControls } from "./slide-controls";


/* ── Types ────────────────────────────────────────────────────────── */

interface PresentationProperty {
  id: string;
  title: string;
  price: number | null;
  area: number | null;
  rooms: string | null;
  type: string | null;
  listing_type: string | null;
  location: string | null;
  description: string | null;
  image_url: string | null;
  features: string | null;
  interior_features: string | null;
  exterior_features: string | null;
  view_features: string | null;
  photos?: string[] | null;
}

interface PresentationContent {
  customer: {
    name: string;
    listing_type: string | null;
    budget_max: number | null;
    rooms: string | null;
    location: string | null;
  };
  properties: PresentationProperty[];
  ai_summary: string;
  created_at: string;
  first_seen_at?: string | null;
  deleted_slides?: string[];
  ai_chunks_override?: string[];
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function formatPrice(price: number): string {
  return new Intl.NumberFormat("tr-TR").format(price) + " TL";
}

function getTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    daire: "Daire", villa: "Villa", arsa: "Arsa", mustakil: "Mustakil Ev",
    rezidans: "Rezidans", yazlik: "Yazlik", buro_ofis: "Ofis", dukkan: "Dukkan",
  };
  return type ? (labels[type] || type) : "";
}

function getListingLabel(type: string | null): string {
  return type === "satilik" ? "Satilik" : type === "kiralik" ? "Kiralik" : "";
}

function splitSummary(text: string, n: number): string[] {
  if (!text) return [];
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];
  if (paragraphs.length <= n) return paragraphs;
  const per = Math.ceil(paragraphs.length / n);
  const chunks: string[] = [];
  for (let i = 0; i < n; i++) {
    const slice = paragraphs.slice(i * per, (i + 1) * per).join("\n\n");
    if (slice) chunks.push(slice);
  }
  return chunks;
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10.5Z" />
    </svg>
  );
}

/* ── Data ─────────────────────────────────────────────────────────── */

type PageProps = { params: Promise<{ token: string }> };

async function getPresentation(token: string) {
  const supabase = getServiceClient();

  const { data } = await supabase
    .from("emlak_presentations")
    .select("id, title, content, ai_summary, status, user_id, created_at, feedback_text")
    .eq("magic_token", token)
    .single();

  if (!data) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, whatsapp_phone, email")
    .eq("user_id", data.user_id)
    .single();

  return { ...data, agent: profile };
}

/* ── Metadata ─────────────────────────────────────────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const pres = await getPresentation(token);
  if (!pres) return { title: "Sunum bulunamadi" };

  const c = (pres.content as PresentationContent) || {};
  const prop = c.properties?.[0];
  const cover = prop?.photos?.[0] || prop?.image_url || null;
  const title = pres.title || prop?.title || "Mülk Sunumu";
  const priceStr = prop?.price
    ? new Intl.NumberFormat("tr-TR").format(prop.price) + " TL"
    : "";
  const descParts = [
    prop?.location,
    prop?.rooms,
    prop?.area ? `${prop.area} m²` : null,
    priceStr,
  ].filter(Boolean);
  const description = descParts.length > 0
    ? descParts.join(" · ")
    : "Size özel hazırlanan mülk sunumu";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: cover ? [{ url: cover, width: 1200, height: 630, alt: title }] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default async function PresentationPage({ params }: PageProps) {
  const { token } = await params;
  const pres = await getPresentation(token);
  if (!pres) notFound();

  const content = pres.content as PresentationContent;
  const properties = content.properties || [];
  const firstProp = properties[0];
  const agentName = pres.agent?.display_name || "Emlak Danışmanı";
  const agentPhone = pres.agent?.whatsapp_phone;

  // İlk görüntüleme: WA'ya devam mesajı + Sunumlar butonu (idempotent)
  const sellerPhone = pres.agent?.whatsapp_phone as string | undefined;
  if (!content.first_seen_at && sellerPhone) {
    const presId = pres.id;
    const userId = pres.user_id;
    after(async () => {
      try {
        const sb = getServiceClient();
        // Idempotent: tekrar fetch et, hala null ise işaretle
        const { data: cur } = await sb
          .from("emlak_presentations")
          .select("content")
          .eq("id", presId)
          .single();
        const curContent = (cur?.content as PresentationContent) || {} as PresentationContent;
        if (curContent.first_seen_at) return;

        const newContent = { ...curContent, first_seen_at: new Date().toISOString() };
        await sb.from("emlak_presentations")
          .update({ content: newContent })
          .eq("id", presId);

        // Sunumlar listesi için magic link üret
        const sunumlarToken = randomBytes(16).toString("hex");
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await sb.from("magic_link_tokens").insert({
          user_id: userId,
          token: sunumlarToken,
          expires_at: expires,
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
        const sunumlarUrl = `${appUrl}/tr/sunumlarim?t=${sunumlarToken}`;

        await sendUrlButton(
          sellerPhone,
          `📊 *Sunumunuz hazır!*\n\nSunumla ilgili tüm işlemleri (düzenle, sil, paylaş) sol alt menüden yapabilirsiniz.\n\n📚 *Bütün sunumlarınızı* görmek isterseniz aşağıdaki butondan sunumlarım sayfasına geçebilirsiniz.`,
          "📚 Sunumlarım",
          sunumlarUrl,
          { skipNav: true },
        );

        // Sonraki flow: Mülkleri Yönet
        const mulkleriToken = randomBytes(16).toString("hex");
        const mulkleriExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await sb.from("magic_link_tokens").insert({
          user_id: userId,
          token: mulkleriToken,
          expires_at: mulkleriExpires,
        });
        const mulkleriUrl = `${appUrl}/tr/mulklerim?t=${mulkleriToken}`;

        await sendUrlButton(
          sellerPhone,
          `📁 *Şimdi daha önce eklediğiniz mülkleri yönetelim.*\n\nPortföyünüzdeki tüm mülkleri kart olarak görüntüleyebilir, düzenleyebilir ya da silebilirsiniz.`,
          "📁 Mülkleri Yönet",
          mulkleriUrl,
          { skipNav: true },
        );
      } catch (err) {
        console.error("[sunum:first-view]", err);
      }
    });
  }

  // Photo pool: explicit .photos array OR fall back to image_url
  const photos: string[] = firstProp?.photos?.length
    ? firstProp.photos
    : (firstProp?.image_url ? [firstProp.image_url] : []);

  // AI summary → 3 chunks for slides 3-5 (override edits varsa onu kullan)
  const aiChunksRaw = (content as PresentationContent & { ai_chunks_override?: string[] }).ai_chunks_override;
  const aiChunks = aiChunksRaw && aiChunksRaw.length > 0
    ? [...aiChunksRaw]
    : splitSummary(content.ai_summary || "", 3);
  while (aiChunks.length < 3) aiChunks.push("");

  // Slaytlardan gizlenecekler — düzenleyiciden silindiyse render etme
  const deleted = new Set(content.deleted_slides || []);
  const isDeleted = (key: string) => deleted.has(key);

  // Display title: property title from first property (or presentation title fallback)
  const displayTitle = firstProp?.title || content.customer?.name || pres.title || "Mülk Sunumu";

  // Subtitle from property specs: "3+2 · Villa · 111m² · Bitez Mah."
  const subtitleParts = [
    firstProp?.rooms,
    firstProp?.type ? getTypeLabel(firstProp.type) : null,
    firstProp?.area ? `${firstProp.area} m²` : null,
    firstProp?.location,
  ].filter(Boolean);
  const subtitle = subtitleParts.join(" · ");

  const formattedDate = new Date(content.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  // Extra photo slides: photos beyond index 4 (0=cover, 1=property, 2-4=AI), in pairs
  const extraPhotos = photos.slice(5);
  const extraPairs: string[][] = [];
  for (let i = 0; i < extraPhotos.length; i += 2) {
    extraPairs.push(extraPhotos.slice(i, i + 2));
  }

  return (
    <html lang="tr">
      <body className="bg-stone-50 text-stone-900 antialiased">
        {/* Mobil portrait modda yatay çevir uyarısı */}
        <div className="portrait-rotate-hint fixed top-3 inset-x-3 z-30 bg-stone-900/95 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 print:hidden">
          <span className="text-base">📱↔️</span>
          <span className="leading-tight">En iyi görünüm için telefonunuzu <strong>yan çevirin</strong>.</span>
        </div>
        <style>{`
          @media (orientation: landscape), (min-width: 768px) {
            .portrait-rotate-hint { display: none !important; }
          }
        `}</style>

        <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">

          {/* ── Slide 1: Cover (büyük foto sol, tipografi sağ + dekoratif kareler) ─── */}
          {!isDeleted("cover") && (
          <div className="relative bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <SlideControls presToken={token} slideKey="cover" initialText={displayTitle} editable />
            <div className="h-full grid grid-cols-2">
              {/* Left: framed photo with beige bg */}
              <div className="bg-[#B89B89] flex items-center justify-center p-6 md:p-10">
                <div className="w-full h-full max-h-[85%] bg-white shadow-lg overflow-hidden">
                  {photos[0] ? (
                    <img src={photos[0]} alt={displayTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <HomeIcon className="w-24 h-24 text-stone-300" />
                    </div>
                  )}
                </div>
              </div>
              {/* Right: typography heavy + decorative squares */}
              <div className="relative flex flex-col justify-center p-8 md:p-12 bg-white">
                {/* dekoratif kareler */}
                <div className="absolute top-6 right-10 w-10 h-10 bg-[#B89B89]/30"></div>
                <div className="absolute top-16 right-6 w-6 h-6 bg-[#B89B89]"></div>
                <div className="absolute bottom-10 right-16 w-7 h-7 bg-[#B89B89]/40"></div>
                <div className="absolute bottom-4 right-8 w-10 h-10 bg-[#B89B89]"></div>

                <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-4 font-semibold">Mülk Sunumu</p>
                <h1 className="text-4xl md:text-6xl font-black text-stone-900 leading-[0.95] mb-4 tracking-tight uppercase">{displayTitle}</h1>
                {subtitle && (
                  <p className="text-base md:text-lg text-stone-600 mb-6 font-medium">{subtitle}</p>
                )}
                <p className="text-sm text-stone-500 italic">{formattedDate}</p>
                <p className="text-xs text-stone-400 mt-2">— {agentName}</p>
              </div>
            </div>
          </div>
          )}

          {/* ── Slide 2: Property Details — bej yarım blok + büyük foto sağ ─── */}
          {firstProp && !isDeleted("property") && (
            <div className="relative bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <SlideControls presToken={token} slideKey="property" initialText={firstProp.description || ""} editable />
              <div className="h-full grid grid-cols-2">
                {/* Left: text on beige half-bg */}
                <div className="bg-[#D4C0B0] flex flex-col justify-center p-8 md:p-12">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-700 mb-3 font-semibold">
                    {firstProp.listing_type ? getListingLabel(firstProp.listing_type).toUpperCase() : "MÜLK"}
                  </p>
                  <h2 className="text-3xl md:text-5xl font-black text-stone-900 leading-[0.95] mb-4 uppercase tracking-tight">
                    {firstProp.title}
                  </h2>
                  {firstProp.price && (
                    <p className="text-3xl md:text-4xl font-black text-stone-900 mb-5">
                      {formatPrice(firstProp.price)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-700 font-medium mb-4">
                    {firstProp.area && <span>{firstProp.area} m²</span>}
                    {firstProp.rooms && <span>{firstProp.rooms}</span>}
                    {firstProp.type && <span>{getTypeLabel(firstProp.type)}</span>}
                    {firstProp.location && <span>{firstProp.location}</span>}
                  </div>
                  {firstProp.description && (
                    <p className="text-xs md:text-sm text-stone-700 leading-relaxed">
                      {(firstProp.description as string).substring(0, 240)}
                      {(firstProp.description as string).length > 240 ? "..." : ""}
                    </p>
                  )}
                </div>
                {/* Right: full-bleed photo */}
                <div className="bg-stone-100 flex items-center justify-center overflow-hidden">
                  {photos[1] ? (
                    <img src={photos[1]} alt={firstProp.title} className="w-full h-full object-cover" />
                  ) : photos[0] ? (
                    <img src={photos[0]} alt={firstProp.title} className="w-full h-full object-cover" />
                  ) : (
                    <HomeIcon className="w-24 h-24 text-stone-300" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Slides 3-5: AI Summary (split into 3) ───────────────── */}
          {aiChunks.map((chunk, i) => {
            if (!chunk) return null;
            const slideKey = `ai:${i}`;
            if (isDeleted(slideKey)) return null;
            const photo = photos[2 + i] || photos[1] || photos[0];
            return (
              <div key={`ai-${i}`} className="relative bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
                <SlideControls presToken={token} slideKey={slideKey} initialText={chunk} editable />
                <div className={`h-full grid grid-cols-2 ${i % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""}`}>
                  {/* Photo */}
                  <div className="bg-stone-100 flex items-center justify-center overflow-hidden">
                    {photo ? (
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <HomeIcon className="w-24 h-24 text-stone-300" />
                    )}
                  </div>
                  {/* Text panel — bej yarı blok varyasyonlu */}
                  <div className={`relative flex flex-col justify-center p-8 md:p-12 ${i === 1 ? "bg-[#D4C0B0]" : "bg-white"}`}>
                    {/* dekoratif kareler bazı slaytlarda */}
                    {i === 0 && (
                      <>
                        <div className="absolute top-6 right-6 w-7 h-7 bg-[#B89B89]/40"></div>
                        <div className="absolute bottom-6 right-12 w-10 h-10 bg-[#B89B89]"></div>
                      </>
                    )}
                    <p className={`text-xs uppercase tracking-[0.2em] mb-4 font-semibold ${i === 1 ? "text-stone-700" : "text-[#B89B89]"}`}>
                      Değerlendirme
                    </p>
                    <div className={`text-base md:text-lg leading-relaxed whitespace-pre-line ${i === 1 ? "text-stone-800" : "text-stone-700"}`}>
                      {chunk}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── Slides 6+: Extra photo pairs (side by side with divider) ─ */}
          {extraPairs.map((pair, i) => {
            const slideKey = `extra:${i}`;
            if (isDeleted(slideKey)) return null;
            return (
            <div key={`extra-${i}`} className="relative bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <SlideControls presToken={token} slideKey={slideKey} />
              <div className="h-full grid grid-cols-2 gap-1 bg-stone-200">
                {pair.map((src, j) => (
                  <div key={j} className="bg-stone-100 flex items-center justify-center overflow-hidden">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {pair.length === 1 && (
                  <div className="bg-stone-50 flex items-center justify-center">
                    <HomeIcon className="w-20 h-20 text-stone-300" />
                  </div>
                )}
              </div>
            </div>
            );
          })}

          {/* ── Contact Slide — büyük TEŞEKKÜR + iletişim ─── */}
          {!isDeleted("closing") && (
          <div className="relative bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <SlideControls presToken={token} slideKey="closing" />
            <div className="h-full grid grid-cols-2">
              {/* Sol: büyük TEŞEKKÜR + iletişim */}
              <div className="relative flex flex-col justify-center p-8 md:p-12">
                <div className="absolute top-8 left-8 w-20 h-1.5 bg-[#B89B89]"></div>
                <div className="absolute bottom-8 right-8 w-16 h-1.5 bg-[#B89B89]"></div>
                <h2 className="text-5xl md:text-7xl font-black text-[#B89B89] leading-[0.9] mb-6 uppercase tracking-tight">
                  Teşekkür<br/>Ederiz
                </h2>
                <p className="text-stone-600 text-sm md:text-base mb-6 max-w-md leading-relaxed">
                  Detaylı bilgi ve mülk gezme randevusu için lütfen iletişime geçiniz.
                </p>
                <div className="space-y-2 text-sm text-stone-700">
                  <p className="font-semibold text-stone-900">{agentName}</p>
                  {agentPhone && <p>📞 {agentPhone}</p>}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  {agentPhone && (
                    <a
                      href={`https://wa.me/${agentPhone.replace(/\D/g, "")}?text=${encodeURIComponent("Merhaba, sunumu inceledim. Bilgi almak istiyorum.")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-medium px-5 py-2.5 rounded-full text-sm transition"
                    >
                      WhatsApp ile İletişim
                    </a>
                  )}
                  {agentPhone && (
                    <a
                      href={`tel:${agentPhone}`}
                      className="inline-flex items-center justify-center gap-2 border-2 border-stone-900 text-stone-900 hover:bg-stone-100 font-medium px-5 py-2.5 rounded-full text-sm transition"
                    >
                      Ara
                    </a>
                  )}
                </div>
              </div>
              {/* Sağ: foto kolajı + dekoratif */}
              <div className="relative bg-stone-100 overflow-hidden">
                {photos.length > 0 ? (
                  <div className="grid grid-rows-2 h-full gap-1 bg-stone-200">
                    {photos[0] && (
                      <div className="overflow-hidden">
                        <img src={photos[photos.length - 1]} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    {photos[1] && (
                      <div className="overflow-hidden">
                        <img src={photos[Math.min(photos.length - 2, 1)]} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <HomeIcon className="w-24 h-24 text-stone-300" />
                  </div>
                )}
                <div className="absolute top-4 right-4 w-8 h-8 bg-[#B89B89]"></div>
                <div className="absolute bottom-4 right-12 w-6 h-6 bg-[#B89B89]/50"></div>
              </div>
            </div>
          </div>
          )}

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className="text-center py-4">
            <a href="https://upudev.nl" target="_blank" rel="noopener noreferrer" className="text-xs text-stone-400 hover:text-stone-600">
              UPU Dev ile oluşturuldu
            </a>
          </div>

        </div>

        {/* Floating share button (sol alt) */}
        <ShareFAB title={displayTitle} />
      </body>
    </html>
  );
}
