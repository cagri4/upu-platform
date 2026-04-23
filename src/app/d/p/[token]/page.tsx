import { notFound } from "next/navigation";
import { getServiceClient } from "@/platform/auth/supabase";
import type { Metadata } from "next";


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

  return {
    title: pres.title || "Mulk Sunumu",
    description: "Size ozel hazirlanan mulk sunumu",
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

  // Photo pool: explicit .photos array OR fall back to image_url
  const photos: string[] = firstProp?.photos?.length
    ? firstProp.photos
    : (firstProp?.image_url ? [firstProp.image_url] : []);

  // AI summary → 3 chunks for slides 3-5
  const aiChunks = splitSummary(content.ai_summary || "", 3);
  while (aiChunks.length < 3) aiChunks.push("");

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
      <body className="bg-gray-100 text-gray-900 antialiased">
        <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">

          {/* ── Slide 1: Cover ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <div className="h-full grid grid-cols-1 md:grid-cols-2">
              {/* Left: circular photo */}
              <div className="flex items-center justify-center p-8 bg-gray-50">
                <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shadow-inner">
                  {photos[0] ? (
                    <img src={photos[0]} alt={displayTitle} className="w-full h-full object-cover" />
                  ) : (
                    <HomeIcon className="w-24 h-24 text-gray-400" />
                  )}
                </div>
              </div>
              {/* Right: right-aligned text */}
              <div className="flex flex-col justify-center p-8 md:p-12 text-right">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">Özel Mülk Sunumu</p>
                <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-3">{displayTitle}</h1>
                {subtitle && (
                  <p className="text-base text-gray-500 mb-6">{subtitle}</p>
                )}
                <p className="text-sm text-gray-500">{formattedDate}</p>
              </div>
            </div>
          </div>

          {/* ── Slide 2: Property Details (was slide 3) ─────────────── */}
          {firstProp && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <div className="h-full grid grid-cols-1 lg:grid-cols-2">
                {/* Left: photo */}
                <div className="bg-gray-100 flex items-center justify-center overflow-hidden">
                  {photos[1] ? (
                    <img src={photos[1]} alt={firstProp.title} className="w-full h-full object-cover" />
                  ) : photos[0] ? (
                    <img src={photos[0]} alt={firstProp.title} className="w-full h-full object-cover" />
                  ) : (
                    <HomeIcon className="w-24 h-24 text-gray-300" />
                  )}
                </div>
                {/* Right: details */}
                <div className="flex flex-col justify-center p-8 md:p-10">
                  <div className="flex items-start justify-between mb-4">
                    <p className="text-xs text-blue-600 font-medium">Mülk</p>
                    {firstProp.listing_type && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${firstProp.listing_type === "satilik" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
                        {getListingLabel(firstProp.listing_type)}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">{firstProp.title}</h2>

                  {firstProp.price && (
                    <p className="text-2xl md:text-3xl font-bold text-blue-600 mb-5">
                      {formatPrice(firstProp.price)}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2.5 mb-5">
                    {firstProp.area && (
                      <div className="rounded-lg p-2.5 bg-gray-50">
                        <p className="text-lg font-bold text-gray-900">{firstProp.area} m&sup2;</p>
                        <p className="text-[10px] text-gray-500">Alan</p>
                      </div>
                    )}
                    {firstProp.rooms && (
                      <div className="rounded-lg p-2.5 bg-gray-50">
                        <p className="text-lg font-bold text-gray-900">{firstProp.rooms}</p>
                        <p className="text-[10px] text-gray-500">Oda</p>
                      </div>
                    )}
                    {firstProp.type && (
                      <div className="rounded-lg p-2.5 bg-gray-50">
                        <p className="text-lg font-bold text-gray-900">{getTypeLabel(firstProp.type)}</p>
                        <p className="text-[10px] text-gray-500">Tip</p>
                      </div>
                    )}
                    {firstProp.location && (
                      <div className="rounded-lg p-2.5 bg-gray-50">
                        <p className="text-sm font-bold leading-tight text-gray-900">{firstProp.location}</p>
                        <p className="text-[10px] text-gray-500">Konum</p>
                      </div>
                    )}
                  </div>

                  {firstProp.description && (
                    <p className="text-xs text-gray-600 leading-relaxed mb-4">
                      {(firstProp.description as string).substring(0, 200)}
                      {(firstProp.description as string).length > 200 ? "..." : ""}
                    </p>
                  )}

                  {(firstProp.features || firstProp.interior_features || firstProp.view_features) && (
                    <div className="flex flex-wrap gap-1">
                      {[firstProp.features, firstProp.interior_features, firstProp.view_features]
                        .filter(Boolean)
                        .join(", ")
                        .split(",")
                        .slice(0, 5)
                        .map((f, j) => (
                          <span key={j} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-600">
                            {f.trim()}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Slides 3-5: AI Summary (split into 3) ───────────────── */}
          {aiChunks.map((chunk, i) => {
            if (!chunk) return null;
            const photo = photos[2 + i] || photos[1] || photos[0];
            return (
              <div key={`ai-${i}`} className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
                <div className="h-full grid grid-cols-1 lg:grid-cols-2">
                  {/* Left: photo */}
                  <div className="bg-gray-100 flex items-center justify-center overflow-hidden">
                    {photo ? (
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <HomeIcon className="w-24 h-24 text-gray-300" />
                    )}
                  </div>
                  {/* Right: text */}
                  <div className="flex flex-col justify-center p-8 md:p-12">
                    <p className="text-xs uppercase tracking-widest text-blue-600 mb-4">Değerlendirme</p>
                    <div className="text-base md:text-lg leading-relaxed text-gray-700 whitespace-pre-line">
                      {chunk}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── Slides 6+: Extra photo pairs (side by side with divider) ─ */}
          {extraPairs.map((pair, i) => (
            <div key={`extra-${i}`} className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <div className="h-full grid grid-cols-2 divide-x divide-gray-200">
                {pair.map((src, j) => (
                  <div key={j} className="bg-gray-100 flex items-center justify-center overflow-hidden">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {pair.length === 1 && (
                  <div className="bg-gray-50 flex items-center justify-center">
                    <HomeIcon className="w-20 h-20 text-gray-300" />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* ── Contact Slide ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <div className="h-full flex items-center justify-center p-10">
              <div className="text-center max-w-lg">
                <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white mx-auto mb-6">
                  <HomeIcon className="w-7 h-7" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">İlginize teşekkür ederiz</h2>
                <p className="text-gray-500 text-sm mb-8">Lütfen detaylı bilgi ve mülk gezme randevusu için iletişime geçiniz.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {agentPhone && (
                    <a
                      href={`https://wa.me/${agentPhone.replace(/\D/g, "")}?text=${encodeURIComponent("Merhaba, sunumu inceledim. Bilgi almak istiyorum.")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium px-5 py-2.5 rounded-full text-sm transition"
                    >
                      WhatsApp ile Iletisim
                    </a>
                  )}
                  {agentPhone && (
                    <a
                      href={`tel:${agentPhone}`}
                      className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-5 py-2.5 rounded-full text-sm transition"
                    >
                      Ara
                    </a>
                  )}
                </div>
                <p className="mt-8 text-xs text-gray-400">{agentName}</p>
              </div>
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className="text-center py-4">
            <a href="https://upudev.nl" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-300 hover:text-gray-500">
              UPU Dev ile olusturuldu
            </a>
          </div>

        </div>
      </body>
    </html>
  );
}
