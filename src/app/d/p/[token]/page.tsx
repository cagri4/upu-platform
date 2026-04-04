import { notFound } from "next/navigation";
import { getServiceClient } from "@/platform/auth/supabase";
import type { Metadata } from "next";
import NotesForm from "./notes-form";

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

/* ── Page — Vertical scroll, landscape slide layout ───────────────── */

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
      <body className="bg-gray-100 text-gray-900 antialiased">
        <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">

          {/* ── Slide 1: Cover ──────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <div className="h-full flex items-center justify-center p-10">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-bold mx-auto mb-6">
                  {initials}
                </div>
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">Ozel Mulk Sunumu</p>
                <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
                  {content.customer.name}
                </h1>
                <p className="text-lg text-gray-500 mb-1">
                  {properties.length} Mulk Secenegi
                </p>
                <p className="text-sm text-gray-400 mb-8">
                  {new Date(content.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <div className="border-t border-gray-100 pt-4 inline-block">
                  <p className="text-gray-700 font-medium text-sm">{agentName}</p>
                  <p className="text-xs text-gray-400">Emlak Danismani</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Slide 2: AI Summary ────────────────────────────── */}
          {content.ai_summary && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <div className="h-full flex items-center p-10 md:p-14">
                <div className="max-w-3xl">
                  <p className="text-xs uppercase tracking-widest text-blue-600 mb-4">Degerlendirme</p>
                  <div className="text-base md:text-lg leading-relaxed text-gray-700 whitespace-pre-line">
                    {content.ai_summary}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Property Slides ────────────────────────────────── */}
          {properties.map((prop, i) => (
            <div key={prop.id} className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <div className="h-full grid grid-cols-1 lg:grid-cols-2">
                {/* Left: Image */}
                <div className="bg-gray-100 flex items-center justify-center overflow-hidden">
                  {prop.image_url ? (
                    <img src={prop.image_url} alt={prop.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-7xl opacity-10">
                      {prop.type === "villa" ? "🏡" : prop.type === "arsa" ? "🌳" : "🏠"}
                    </span>
                  )}
                </div>

                {/* Right: Details */}
                <div className="flex flex-col justify-center p-8 md:p-10">
                  <div className="flex items-start justify-between mb-4">
                    <p className="text-xs text-blue-600 font-medium">{i + 1} / {properties.length}</p>
                    {prop.listing_type && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${prop.listing_type === "satilik" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
                        {getListingLabel(prop.listing_type)}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">{prop.title}</h2>

                  {prop.price && (
                    <p className="text-2xl md:text-3xl font-bold text-blue-600 mb-5">
                      {formatPrice(prop.price)}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2.5 mb-5">
                    {prop.area && (
                      <div className="rounded-lg p-2.5 bg-gray-50">
                        <p className="text-lg font-bold">{prop.area} m&sup2;</p>
                        <p className="text-[10px] text-gray-500">Alan</p>
                      </div>
                    )}
                    {prop.rooms && (
                      <div className="rounded-lg p-2.5 bg-gray-50">
                        <p className="text-lg font-bold">{prop.rooms}</p>
                        <p className="text-[10px] text-gray-500">Oda</p>
                      </div>
                    )}
                    {prop.type && (
                      <div className="rounded-lg p-2.5 bg-gray-50">
                        <p className="text-lg font-bold">{getTypeLabel(prop.type)}</p>
                        <p className="text-[10px] text-gray-500">Tip</p>
                      </div>
                    )}
                    {prop.location && (
                      <div className="rounded-lg p-2.5 bg-gray-50">
                        <p className="text-sm font-bold leading-tight">{prop.location}</p>
                        <p className="text-[10px] text-gray-500">Konum</p>
                      </div>
                    )}
                  </div>

                  {prop.description && (
                    <p className="text-xs text-gray-600 leading-relaxed mb-4">
                      {(prop.description as string).substring(0, 200)}
                      {(prop.description as string).length > 200 ? "..." : ""}
                    </p>
                  )}

                  {(prop.features || prop.interior_features || prop.view_features) && (
                    <div className="flex flex-wrap gap-1">
                      {[prop.features, prop.interior_features, prop.view_features]
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
          ))}

          {/* ── Contact Slide ──────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <div className="h-full flex items-center justify-center p-10">
              <div className="text-center max-w-lg">
                <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-bold mx-auto mb-6">
                  {initials}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">Ilginizi Ceken Bir Mulk Var mi?</h2>
                <p className="text-gray-500 text-sm mb-8">Detayli bilgi ve gezme randevusu icin benimle iletisime gecin.</p>
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
                <p className="mt-8 text-xs text-gray-400">
                  {agentName} | Emlak Danismani
                </p>
              </div>
            </div>
          </div>

          {/* ── Notes Form (only for agent) ─────────────────── */}
          <NotesForm
            token={token}
            propertyTitles={properties.map(p => p.title || "Mulk")}
            existingNotes={pres.feedback_text as string | null}
          />

          {/* ── Footer ────────────────────────────────────────── */}
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
