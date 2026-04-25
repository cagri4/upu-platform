/**
 * Public web sayfası — emlakçının kişisel landing page'i.
 * URL: /u/<slug>
 * - profiles.metadata.agent_profile.web_slug ile lookup
 * - Profil + active mülkler + AI üretilmiş Hakkımızda metni
 */
import { notFound } from "next/navigation";
import { getServiceClient } from "@/platform/auth/supabase";
import type { Metadata } from "next";

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

interface PropCard {
  id: string;
  title: string;
  type: string | null;
  listing_type: string | null;
  price: number | null;
  area: number | null;
  rooms: string | null;
  location: string | null;
  cover: string | null;
  sunum_token: string | null;
}

type PageProps = { params: Promise<{ slug: string }> };

async function getAgentBySlug(slug: string) {
  const supabase = getServiceClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, metadata")
    .filter("metadata->agent_profile->>web_slug", "eq", slug)
    .limit(1);

  const profile = profiles?.[0];
  if (!profile) return null;

  const meta = (profile.metadata as Record<string, unknown> | null) || {};
  const agent = (meta.agent_profile as AgentProfile) || {};

  // Aktif mülkler
  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title, type, listing_type, price, area, rooms, location_neighborhood, location_district, image_url, status, created_at")
    .eq("user_id", profile.id)
    .eq("status", "aktif")
    .order("created_at", { ascending: false });

  const propIds = (properties || []).map(p => p.id);
  const { data: photos } = propIds.length > 0
    ? await supabase
        .from("emlak_property_photos")
        .select("property_id, url, sort_order")
        .in("property_id", propIds)
        .order("sort_order", { ascending: true })
    : { data: [] };
  const firstPhotoMap: Record<string, string> = {};
  for (const p of photos || []) {
    const pid = p.property_id as string;
    if (!firstPhotoMap[pid] && p.url) firstPhotoMap[pid] = p.url as string;
  }

  // Mülk başına son sunum token
  const { data: presentations } = propIds.length > 0
    ? await supabase
        .from("emlak_presentations")
        .select("magic_token, property_ids, created_at")
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
    : { data: [] };
  const sunumMap: Record<string, string> = {};
  for (const pres of presentations || []) {
    const pids = (pres.property_ids as string[] | null) || [];
    for (const pid of pids) {
      if (!sunumMap[pid] && pres.magic_token) sunumMap[pid] = pres.magic_token as string;
    }
  }

  const propCards: PropCard[] = (properties || []).map(p => ({
    id: p.id,
    title: p.title as string,
    type: p.type as string | null,
    listing_type: p.listing_type as string | null,
    price: p.price as number | null,
    area: p.area as number | null,
    rooms: p.rooms as string | null,
    location: (p.location_neighborhood as string | null) || (p.location_district as string | null) || null,
    cover: firstPhotoMap[p.id] || (p.image_url as string | null) || null,
    sunum_token: sunumMap[p.id] || null,
  }));

  // AI Hakkımızda — eğer cache'lenmiş bir metin varsa onu kullan, yoksa runtime üret
  let aboutText = (meta.about_cache as string | undefined) || agent.bio || "";
  if (!aboutText) {
    try {
      const { askClaude } = await import("@/platform/ai/claude");
      const profileSummary = [
        agent.full_name ? `İsim: ${agent.full_name}` : null,
        agent.years_experience ? `Tecrübe: ${agent.years_experience} yıl` : null,
        agent.office_address ? `Ofis: ${agent.office_address}` : null,
        agent.bio ? `Notlar: ${agent.bio}` : null,
        propCards.length > 0 ? `Aktif mülk sayısı: ${propCards.length}` : null,
      ].filter(Boolean).join("\n");

      aboutText = await askClaude(
        "Bir emlak danışmanının kişisel landing page'inde gösterilecek 'Hakkımızda' metnini yaz. Türkçe, sıcak ama profesyonel ton, 2 paragraf, ~120 kelime. Markdown kullanma. Düz metin olarak doğrudan yaz.",
        profileSummary,
        400,
      );

      // Cache'le
      if (aboutText) {
        await supabase
          .from("profiles")
          .update({ metadata: { ...meta, about_cache: aboutText } })
          .eq("id", profile.id);
      }
    } catch (err) {
      console.error("[u/slug] AI about generation failed:", err);
      aboutText = `${agent.full_name || profile.display_name || "Emlak Danışmanı"} hakkında detay yakında.`;
    }
  }

  return {
    profile,
    agent,
    aboutText,
    properties: propCards,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getAgentBySlug(slug);
  if (!data) return { title: "Sayfa bulunamadı" };

  const name = data.agent.full_name || data.profile.display_name || "Emlak Danışmanı";
  const description = data.agent.bio || `${name} — Bodrum'da emlak portföyü ve hizmetler.`;

  return {
    title: `${name} — Emlak Portföyü`,
    description,
    openGraph: {
      title: `${name} — Emlak Portföyü`,
      description,
      type: "profile",
      images: data.agent.photo_url ? [{ url: data.agent.photo_url, alt: name }] : undefined,
    },
  };
}

function formatPrice(p: number | null): string {
  if (!p) return "";
  return new Intl.NumberFormat("tr-TR").format(p) + " ₺";
}

const TYPE_LABELS: Record<string, string> = {
  daire: "Daire", villa: "Villa", arsa: "Arsa", mustakil: "Müstakil",
  rezidans: "Rezidans", yazlik: "Yazlık", buro_ofis: "Ofis", dukkan: "Dükkan",
};

export default async function AgentLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getAgentBySlug(slug);
  if (!data) notFound();

  const { agent, aboutText, properties, profile } = data;
  const name = agent.full_name || profile.display_name || "Emlak Danışmanı";
  const phone = agent.phone || "";
  const email = agent.email || "";

  return (
    <html lang="tr">
      <body className="bg-stone-50 text-stone-900 antialiased">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

          {/* Hero — profil */}
          <section className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="bg-[#B89B89] flex items-center justify-center p-8">
                <div className="w-40 h-40 md:w-52 md:h-52 rounded-full overflow-hidden bg-white shadow-lg">
                  {agent.photo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={agent.photo_url} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl text-stone-300">👤</div>
                  )}
                </div>
              </div>
              <div className="relative p-8 md:p-10 flex flex-col justify-center">
                <div className="absolute top-6 right-6 w-8 h-8 bg-[#B89B89]"></div>
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2 font-semibold">Emlak Danışmanı</p>
                <h1 className="text-3xl md:text-4xl font-black text-stone-900 mb-2 uppercase tracking-tight">{name}</h1>
                {agent.years_experience && (
                  <p className="text-sm text-stone-600 mb-1">🎓 {agent.years_experience} yıl tecrübe</p>
                )}
                {agent.office_address && (
                  <p className="text-sm text-stone-600 mb-4">📍 {agent.office_address}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {phone && (
                    <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-4 py-2 rounded-full">
                      💬 WhatsApp
                    </a>
                  )}
                  {phone && (
                    <a href={`tel:${phone}`}
                      className="inline-flex items-center gap-1.5 border-2 border-stone-900 text-stone-900 hover:bg-stone-100 text-sm font-medium px-4 py-2 rounded-full">
                      📞 Ara
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* About */}
          <section className="bg-white rounded-3xl shadow-sm p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[#B89B89] mb-3 font-semibold">Hakkımızda</p>
            <div className="text-stone-700 leading-relaxed whitespace-pre-line text-base">
              {aboutText}
            </div>
          </section>

          {/* Properties */}
          {properties.length > 0 && (
            <section>
              <p className="text-xs uppercase tracking-[0.2em] text-[#B89B89] mb-3 font-semibold px-2">Aktif Portföy</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {properties.map(p => (
                  <a
                    key={p.id}
                    href={p.sunum_token ? `/d/p/${p.sunum_token}` : "#"}
                    target={p.sunum_token ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className={`bg-white rounded-2xl shadow-sm overflow-hidden ${p.sunum_token ? "hover:shadow-md active:scale-[0.99]" : "cursor-default"} transition`}
                  >
                    <div className="aspect-[4/3] bg-stone-100">
                      {p.cover ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={p.cover} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-stone-300">🏠</div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-stone-500 font-medium">
                          {p.listing_type === "satilik" ? "Satılık" : p.listing_type === "kiralik" ? "Kiralık" : ""}
                          {p.type ? ` · ${TYPE_LABELS[p.type] || p.type}` : ""}
                        </span>
                      </div>
                      <h3 className="font-semibold text-stone-900 text-sm mb-1 line-clamp-2">{p.title}</h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-600 mb-2">
                        {p.rooms && <span>{p.rooms}</span>}
                        {p.area && <span>{p.area} m²</span>}
                        {p.location && <span>📍 {p.location}</span>}
                      </div>
                      {p.price && (
                        <p className="text-lg font-bold text-stone-900">{formatPrice(p.price)}</p>
                      )}
                      {p.sunum_token && (
                        <p className="text-xs text-emerald-700 mt-2">📊 Sunumu Gör →</p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Contact closing */}
          <section className="bg-white rounded-3xl shadow-sm p-8 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#B89B89] mb-3 font-semibold">İletişim</p>
            <h2 className="text-2xl md:text-3xl font-black text-stone-900 mb-4 uppercase">Bana Ulaşın</h2>
            <div className="space-y-1 text-sm text-stone-700 mb-6">
              {phone && <p>📞 {phone}</p>}
              {email && <p>✉️ {email}</p>}
              {agent.office_address && <p>📍 {agent.office_address}</p>}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {phone && (
                <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full">
                  💬 WhatsApp ile İletişim
                </a>
              )}
              {phone && (
                <a href={`tel:${phone}`}
                  className="inline-flex items-center gap-1.5 border-2 border-stone-900 text-stone-900 hover:bg-stone-100 text-sm font-semibold px-5 py-2.5 rounded-full">
                  📞 Hemen Ara
                </a>
              )}
            </div>
          </section>

          <div className="text-center py-4">
            <a href="https://upudev.nl" target="_blank" rel="noopener noreferrer" className="text-xs text-stone-400 hover:text-stone-600">
              UPU Dev ile oluşturuldu
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
