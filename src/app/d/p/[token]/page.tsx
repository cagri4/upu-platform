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

/* ── Data ─────────────────────────────────────────────────────────── */

type PageProps = { params: Promise<{ token: string }> };

async function getPresentation(token: string) {
  const supabase = getServiceClient();

  const { data } = await supabase
    .from("emlak_presentations")
    .select("id, title, content, ai_summary, status, user_id, created_at")
    .eq("magic_token", token)
    .single();

  if (!data) return null;

  // Get agent info
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

/* ── Page — Horizontal scroll presentation ────────────────────────── */

export default async function PresentationPage({ params }: PageProps) {
  const { token } = await params;
  const pres = await getPresentation(token);
  if (!pres) notFound();

  const content = pres.content as PresentationContent;
  const properties = content.properties || [];
  const agentName = pres.agent?.display_name || "Emlak Danismani";
  const agentPhone = pres.agent?.whatsapp_phone;
  const initials = agentName.split(" ").map((w: string) => w[0]).join("").substring(0, 2);

  return (
    <html lang="tr">
      <head>
        <style>{`
          .slides-container {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            height: 100vh;
            width: 100vw;
          }
          .slides-container::-webkit-scrollbar { display: none; }
          .slide {
            flex: 0 0 100vw;
            width: 100vw;
            height: 100vh;
            scroll-snap-align: start;
            overflow-y: auto;
            padding: 3rem;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          @media (max-width: 768px) {
            .slide { padding: 1.5rem; }
          }
        `}</style>
      </head>
      <body className="m-0 p-0 overflow-hidden bg-white text-gray-900 antialiased">
        <div className="slides-container">

          {/* ── Slide 1: Cover ──────────────────────────────────── */}
          <div className="slide bg-white">
            <div className="max-w-3xl w-full text-center">
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-8">
                {initials}
              </div>
              <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Ozel Mulk Sunumu</p>
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                {content.customer.name}
              </h1>
              <p className="text-xl text-gray-500 mb-2">
                {properties.length} Mulk Secenegi
              </p>
              <p className="text-sm text-gray-400 mb-12">
                {new Date(content.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <div className="border-t border-gray-200 pt-6 inline-block">
                <p className="text-gray-700 font-medium">{agentName}</p>
                <p className="text-sm text-gray-400">Emlak Danismani</p>
              </div>
              <div className="mt-16 text-gray-300">
                <p className="text-xs">Yana kaydir &rarr;</p>
              </div>
            </div>
          </div>

          {/* ── Slide 2: AI Summary ────────────────────────────── */}
          {content.ai_summary && (
            <div className="slide bg-gray-50">
              <div className="max-w-3xl w-full">
                <p className="text-sm uppercase tracking-widest text-blue-600 mb-6">Degerlendirme</p>
                <div className="text-lg leading-relaxed text-gray-700 whitespace-pre-line">
                  {content.ai_summary}
                </div>
              </div>
            </div>
          )}

          {/* ── Property Slides ────────────────────────────────── */}
          {properties.map((prop, i) => (
            <div key={prop.id} className="slide bg-white">
              <div className="max-w-5xl w-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-sm text-blue-600 font-medium mb-1">{i + 1} / {properties.length}</p>
                    <h2 className="text-2xl md:text-4xl font-bold text-gray-900">{prop.title}</h2>
                  </div>
                  {prop.listing_type && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${prop.listing_type === "satilik" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
                      {getListingLabel(prop.listing_type)}
                    </span>
                  )}
                </div>

                {/* Content: Image + Details side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Image */}
                  <div className="aspect-[16/10] rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                    {prop.image_url ? (
                      <img src={prop.image_url} alt={prop.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl opacity-15">
                        {prop.type === "villa" ? "🏡" : prop.type === "arsa" ? "🌳" : "🏠"}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-col justify-center">
                    {prop.price && (
                      <p className="text-3xl font-bold text-blue-600 mb-5">
                        {formatPrice(prop.price)}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      {prop.area && (
                        <div className="rounded-lg p-3 bg-gray-50 border border-gray-100">
                          <p className="text-xl font-bold">{prop.area} m&sup2;</p>
                          <p className="text-xs text-gray-500">Alan</p>
                        </div>
                      )}
                      {prop.rooms && (
                        <div className="rounded-lg p-3 bg-gray-50 border border-gray-100">
                          <p className="text-xl font-bold">{prop.rooms}</p>
                          <p className="text-xs text-gray-500">Oda</p>
                        </div>
                      )}
                      {prop.type && (
                        <div className="rounded-lg p-3 bg-gray-50 border border-gray-100">
                          <p className="text-xl font-bold">{getTypeLabel(prop.type)}</p>
                          <p className="text-xs text-gray-500">Tip</p>
                        </div>
                      )}
                      {prop.location && (
                        <div className="rounded-lg p-3 bg-gray-50 border border-gray-100">
                          <p className="text-base font-bold leading-tight">{prop.location}</p>
                          <p className="text-xs text-gray-500">Konum</p>
                        </div>
                      )}
                    </div>

                    {prop.description && (
                      <p className="text-sm text-gray-600 leading-relaxed mb-4">
                        {(prop.description as string).substring(0, 250)}
                        {(prop.description as string).length > 250 ? "..." : ""}
                      </p>
                    )}

                    {(prop.features || prop.interior_features || prop.view_features) && (
                      <div className="flex flex-wrap gap-1.5">
                        {[prop.features, prop.interior_features, prop.view_features]
                          .filter(Boolean)
                          .join(", ")
                          .split(",")
                          .slice(0, 6)
                          .map((f, j) => (
                            <span key={j} className="px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                              {f.trim()}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* ── Contact Slide ──────────────────────────────────── */}
          <div className="slide bg-gray-50">
            <div className="text-center max-w-2xl">
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-8">
                {initials}
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Ilginizi Ceken Bir Mulk Var mi?</h2>
              <p className="text-gray-500 mb-8">Detayli bilgi ve gezme randevusu icin benimle iletisime gecin.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {agentPhone && (
                  <a
                    href={`https://wa.me/${agentPhone.replace(/\D/g, "")}?text=${encodeURIComponent("Merhaba, sunumu inceledim. Bilgi almak istiyorum.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-full transition"
                  >
                    WhatsApp ile Iletisim
                  </a>
                )}
                {agentPhone && (
                  <a
                    href={`tel:${agentPhone}`}
                    className="inline-flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-full transition"
                  >
                    Ara
                  </a>
                )}
              </div>
              <p className="mt-10 text-sm text-gray-400">
                {agentName} | Emlak Danismani
              </p>
              <p className="mt-2 text-xs text-gray-300">
                <a href="https://upudev.nl" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">
                  UPU Dev ile olusturuldu
                </a>
              </p>
            </div>
          </div>

        </div>
      </body>
    </html>
  );
}
