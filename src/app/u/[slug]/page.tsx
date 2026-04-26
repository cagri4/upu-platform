/**
 * Public web sayfası — emlakçının kişisel landing page'i.
 * URL: /u/<slug>
 * - profiles.metadata.agent_profile.web_slug ile lookup
 * - Profil + active mülkler + AI üretilmiş Hakkımızda metni
 */
import { notFound } from "next/navigation";
import { getServiceClient } from "@/platform/auth/supabase";
import type { Metadata } from "next";
import { EditFAB } from "./edit-fab";

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

  // Stats — verilerden otomatik
  const totalProps = properties.length;
  const uniqueLocations = new Set(properties.map(p => (p.location || "").split("/")[0].trim()).filter(Boolean));
  const propertyTypeCount = new Set(properties.map(p => p.type).filter(Boolean)).size;
  const stats = [
    agent.years_experience ? { label: "Yıl Tecrübe", value: `${agent.years_experience}+` } : null,
    totalProps > 0 ? { label: "Aktif Portföy", value: `${totalProps}` } : null,
    uniqueLocations.size > 0 ? { label: "Bölge", value: `${uniqueLocations.size}` } : null,
    propertyTypeCount > 0 ? { label: "Mülk Tipi", value: `${propertyTypeCount}` } : null,
  ].filter((x): x is { label: string; value: string } => x !== null);

  return (
    <html lang="tr">
      <body className="bg-stone-50 text-stone-900 antialiased">
        <EditFAB slug={slug} />

        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

          {/* Hero — büyük foto + büyük tipografi */}
          <section className="relative bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-5">
              {/* Sol: foto kolonu (2/5) */}
              <div className="md:col-span-2 bg-[#B89B89] flex items-center justify-center p-6 md:p-10 min-h-[280px] relative">
                <div className="absolute top-4 left-4 w-6 h-6 bg-white/30"></div>
                <div className="absolute bottom-4 right-4 w-10 h-10 bg-white/20"></div>
                <div className="relative w-44 h-56 md:w-56 md:h-72 bg-white shadow-2xl overflow-hidden">
                  {agent.photo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={agent.photo_url} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-7xl text-stone-300">👤</div>
                  )}
                </div>
              </div>
              {/* Sağ: text kolonu (3/5) */}
              <div className="md:col-span-3 relative p-8 md:p-12 flex flex-col justify-center">
                <div className="absolute top-6 right-10 w-10 h-10 bg-[#B89B89]/30"></div>
                <div className="absolute top-16 right-6 w-6 h-6 bg-[#B89B89]"></div>
                <div className="absolute bottom-10 right-16 w-7 h-7 bg-[#B89B89]/40"></div>

                <p className="text-xs uppercase tracking-[0.25em] text-[#B89B89] mb-3 font-bold">Real Estate Specialist</p>
                <h1 className="text-4xl md:text-6xl font-black text-stone-900 mb-3 uppercase tracking-tight leading-[0.95]">{name}</h1>
                {agent.bio && (
                  <p className="text-base md:text-lg text-stone-600 mb-5 max-w-md italic">&quot;{agent.bio.split("\n")[0]}&quot;</p>
                )}
                {!agent.bio && agent.office_address && (
                  <p className="text-base text-stone-600 mb-5">📍 {agent.office_address}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {phone && (
                    <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-md">
                      💬 WhatsApp&apos;ta Yaz
                    </a>
                  )}
                  {phone && (
                    <a href={`tel:${phone}`}
                      className="inline-flex items-center gap-1.5 border-2 border-stone-900 text-stone-900 hover:bg-stone-100 text-sm font-semibold px-5 py-2.5 rounded-full">
                      📞 Hemen Ara
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Stats card */}
          {stats.length > 0 && (
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.map((s, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm p-5 text-center">
                  <p className="text-3xl md:text-4xl font-black text-[#B89B89] leading-none">{s.value}</p>
                  <p className="text-xs uppercase tracking-wider text-stone-500 mt-2 font-semibold">{s.label}</p>
                </div>
              ))}
            </section>
          )}

          {/* About — split: text sol + decorative photo sağ */}
          <section className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 md:p-12">
                <p className="text-xs uppercase tracking-[0.25em] text-[#B89B89] mb-3 font-bold">Hakkımızda</p>
                <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-5 uppercase leading-tight">
                  Güvenilir<br/>Bir İş Ortağı
                </h2>
                <div className="text-stone-700 leading-relaxed whitespace-pre-line text-base">
                  {aboutText}
                </div>
              </div>
              <div className="bg-stone-100 hidden md:flex items-center justify-center p-6 relative">
                {properties[0]?.cover ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={properties[0].cover} alt="" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl text-stone-300">🏛️</div>
                )}
                <div className="absolute top-4 right-4 w-6 h-6 bg-[#B89B89]"></div>
              </div>
            </div>
          </section>

          {/* Properties */}
          {properties.length > 0 && (
            <section>
              <div className="px-2 mb-4">
                <p className="text-xs uppercase tracking-[0.25em] text-[#B89B89] mb-2 font-bold">Aktif Portföy</p>
                <h2 className="text-3xl md:text-4xl font-black text-stone-900 uppercase">
                  Sunduğumuz Mülkler
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Contact closing — büyük "İLETİŞİM" + foto + dekoratif */}
          <section className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="relative p-8 md:p-12 flex flex-col justify-center">
                <div className="absolute top-8 left-8 w-20 h-1.5 bg-[#B89B89]"></div>
                <div className="absolute bottom-8 right-8 w-16 h-1.5 bg-[#B89B89]"></div>
                <p className="text-xs uppercase tracking-[0.25em] text-[#B89B89] mb-3 font-bold">İletişim</p>
                <h2 className="text-4xl md:text-6xl font-black text-stone-900 leading-[0.9] mb-6 uppercase tracking-tight">
                  Sizinle<br/>Çalışmak<br/>İsterim
                </h2>
                <div className="space-y-1.5 text-sm text-stone-700 mb-6">
                  {phone && <p>📞 {phone}</p>}
                  {email && <p>✉️ {email}</p>}
                  {agent.office_address && <p>📍 {agent.office_address}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {phone && (
                    <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-5 py-2.5 rounded-full">
                      💬 WhatsApp&apos;ta Yaz
                    </a>
                  )}
                  {phone && (
                    <a href={`tel:${phone}`}
                      className="inline-flex items-center gap-1.5 border-2 border-stone-900 text-stone-900 hover:bg-stone-100 text-sm font-semibold px-5 py-2.5 rounded-full">
                      📞 Hemen Ara
                    </a>
                  )}
                </div>
              </div>
              <div className="bg-[#B89B89] hidden md:block relative">
                {agent.photo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={agent.photo_url} alt={name} className="w-full h-full object-cover" />
                ) : properties[0]?.cover ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={properties[0].cover} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="h-full flex items-center justify-center text-6xl text-white/40">🏛️</div>
                )}
                <div className="absolute top-4 right-4 w-8 h-8 bg-white"></div>
                <div className="absolute bottom-4 right-12 w-6 h-6 bg-white/50"></div>
              </div>
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
