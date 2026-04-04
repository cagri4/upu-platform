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

  // Track view
  await supabase
    .from("emlak_presentations")
    .update({
      view_count: (data as { view_count?: number }).view_count ? (data as { view_count?: number }).view_count! + 1 : 1,
      viewed_at: new Date().toISOString(),
      status: data.status === "sent" ? "viewed" : data.status,
    })
    .eq("id", data.id);

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

/* ── Page ─────────────────────────────────────────────────────────── */

export default async function PresentationPage({ params }: PageProps) {
  const { token } = await params;
  const pres = await getPresentation(token);
  if (!pres) notFound();

  const content = pres.content as PresentationContent;
  const properties = content.properties || [];
  const agentName = pres.agent?.display_name || "Emlak Danismani";
  const agentPhone = pres.agent?.whatsapp_phone;

  return (
    <html lang="tr">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {/* ── Cover Slide ─────────────────────────────────────── */}
        <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white px-6">
          <div className="max-w-4xl w-full text-center">
            <p className="text-sm uppercase tracking-widest text-slate-400 mb-4">Ozel Sunum</p>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {content.customer.name}
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 mb-2">
              {properties.length} Mulk Secenegi
            </p>
            <p className="text-sm text-slate-500 mb-10">
              {new Date(content.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <div className="flex items-center justify-center gap-3 text-slate-400">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm">
                {agentName.split(" ").map((w: string) => w[0]).join("").substring(0, 2)}
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-medium">{agentName}</p>
                <p className="text-xs">Emlak Danismani</p>
              </div>
            </div>
            <div className="mt-12 animate-bounce text-slate-500">
              <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            </div>
          </div>
        </section>

        {/* ── AI Summary Slide ────────────────────────────────── */}
        {content.ai_summary && (
          <section className="min-h-screen flex items-center bg-white px-6 py-20">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-sm uppercase tracking-widest text-blue-600 mb-4">Degerlendirme</h2>
              <div className="text-lg md:text-xl leading-relaxed text-gray-700 whitespace-pre-line">
                {content.ai_summary}
              </div>
            </div>
          </section>
        )}

        {/* ── Property Slides ─────────────────────────────────── */}
        {properties.map((prop, i) => (
          <section key={prop.id} className={`min-h-screen flex items-center px-6 py-20 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
            <div className="max-w-5xl mx-auto w-full">
              {/* Header */}
              <div className="flex items-start justify-between mb-8">
                <div>
                  <p className="text-sm text-blue-600 font-medium mb-1">{i + 1} / {properties.length}</p>
                  <h2 className="text-3xl md:text-4xl font-bold">{prop.title}</h2>
                </div>
                <div className="text-right">
                  {prop.listing_type && (
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${prop.listing_type === "satilik" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                      {getListingLabel(prop.listing_type)}
                    </span>
                  )}
                </div>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Left: Image or Placeholder */}
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  {prop.image_url ? (
                    <img src={prop.image_url} alt={prop.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-6xl opacity-20">
                      {prop.type === "villa" ? "🏡" : prop.type === "arsa" ? "🌳" : "🏠"}
                    </span>
                  )}
                </div>

                {/* Right: Details */}
                <div className="flex flex-col justify-center">
                  {/* Price */}
                  {prop.price && (
                    <p className="text-4xl font-bold text-blue-600 mb-6">
                      {formatPrice(prop.price)}
                    </p>
                  )}

                  {/* Key Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    {prop.area && (
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <p className="text-2xl font-bold">{prop.area} m&sup2;</p>
                        <p className="text-xs text-gray-500">Alan</p>
                      </div>
                    )}
                    {prop.rooms && (
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <p className="text-2xl font-bold">{prop.rooms}</p>
                        <p className="text-xs text-gray-500">Oda</p>
                      </div>
                    )}
                    {prop.type && (
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <p className="text-2xl font-bold">{getTypeLabel(prop.type)}</p>
                        <p className="text-xs text-gray-500">Tip</p>
                      </div>
                    )}
                    {prop.location && (
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <p className="text-lg font-bold leading-tight">{prop.location}</p>
                        <p className="text-xs text-gray-500">Konum</p>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {prop.description && (
                    <p className="text-gray-600 leading-relaxed mb-6">
                      {(prop.description as string).substring(0, 300)}
                      {(prop.description as string).length > 300 ? "..." : ""}
                    </p>
                  )}

                  {/* Features */}
                  {(prop.features || prop.interior_features || prop.view_features) && (
                    <div className="flex flex-wrap gap-2">
                      {[prop.features, prop.interior_features, prop.view_features]
                        .filter(Boolean)
                        .join(", ")
                        .split(",")
                        .slice(0, 8)
                        .map((f, j) => (
                          <span key={j} className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                            {f.trim()}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ))}

        {/* ── Contact Slide ────────────────────────────────────── */}
        <section className="min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-slate-800 to-black text-white px-6 py-20">
          <div className="text-center max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ilginizi Ceken Bir Mulk Var mi?</h2>
            <p className="text-slate-400 mb-8">Detayli bilgi ve gezme randevusu icin benimle iletisime gecin.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {agentPhone && (
                <a
                  href={`https://wa.me/${agentPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Merhaba, sunumu inceledim. Bilgi almak istiyorum.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-8 py-4 rounded-full transition"
                >
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp ile Iletisim
                </a>
              )}
              {agentPhone && (
                <a
                  href={`tel:${agentPhone}`}
                  className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-full transition"
                >
                  Ara
                </a>
              )}
            </div>
            <p className="mt-10 text-sm text-slate-500">
              {agentName} | Emlak Danismani
            </p>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="py-4 text-center text-xs text-gray-400">
          <a href="https://upudev.nl" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
            UPU Dev ile olusturuldu
          </a>
        </footer>
      </body>
    </html>
  );
}
