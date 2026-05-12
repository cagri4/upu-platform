/**
 * Public web sayfası — emlakçının kişisel landing page'i.
 * URL: /u/<slug>
 * - profiles.metadata.agent_profile.web_slug ile lookup
 * - Profil + active mülkler + AI üretilmiş Hakkımızda metni
 */
import { notFound } from "next/navigation";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies } from "@/platform/auth/session";
import type { Metadata } from "next";
import { OwnerToolbar } from "./owner-toolbar";

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

type PageProps = { params: Promise<{ slug: string }>; searchParams?: Promise<{ t?: string; token?: string }> };

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

// Inline Lucide SVG'leri (server component → client primitive yerine sade SVG)
function IconHome({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10.5Z" />
    </svg>
  );
}
function IconUser({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconMessageCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
function IconPhone({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function IconMapPin({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function IconAt({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  );
}
function IconPresentation({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 3h20" />
      <path d="M21 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3" />
      <path d="m7 21 5-6 5 6" />
      <path d="M12 15v6" />
    </svg>
  );
}
function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default async function AgentLandingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const ownerToken = sp?.t || sp?.token || null;
  const data = await getAgentBySlug(slug);
  if (!data) notFound();

  const { agent, aboutText, properties, profile } = data;

  // Owner kontrolü: cookie session uid'si site sahibinin user_id'si ile
  // eşleşirse veya legacy ?t=/?token= query'si verilmişse owner sayılır.
  const session = await getSessionFromCookies();
  const isOwner = (!!session && session.uid === profile.id) || !!ownerToken;
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

  const waHref = phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : null;
  const telHref = phone ? `tel:${phone}` : null;

  return (
    <html lang="tr">
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white antialiased">
        {isOwner && <OwnerToolbar slug={slug} ownerToken={ownerToken} />}

        <div className={`max-w-5xl mx-auto px-4 py-8 space-y-6 ${isOwner ? "pt-20" : ""}`}>

          {/* Hero — banking beyaz minimal */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-5">
              {/* Sol: foto */}
              <div className="md:col-span-2 bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center p-6 md:p-10 min-h-[240px]">
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl bg-white dark:bg-slate-900 shadow-md overflow-hidden ring-4 ring-white dark:ring-slate-900">
                  {agent.photo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={agent.photo_url} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                      <IconUser className="w-16 h-16 text-slate-400 dark:text-slate-500" />
                    </div>
                  )}
                </div>
              </div>
              {/* Sağ: text */}
              <div className="md:col-span-3 p-6 md:p-10 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold mb-2">
                  Emlak Danışmanı
                </p>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white leading-tight mb-3">
                  {name}
                </h1>
                {agent.bio && (
                  <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-4 leading-relaxed line-clamp-3">
                    {agent.bio.split("\n")[0]}
                  </p>
                )}
                {!agent.bio && agent.office_address && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex items-center gap-1.5">
                    <IconMapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> {agent.office_address}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {waHref && (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm active:scale-[0.97] transition"
                    >
                      <IconMessageCircle className="w-4 h-4" /> WhatsApp&apos;ta Yaz
                    </a>
                  )}
                  {telHref && (
                    <a
                      href={telHref}
                      className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold px-4 py-2.5 rounded-xl active:scale-[0.97] transition"
                    >
                      <IconPhone className="w-4 h-4" /> Hemen Ara
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Stats — banking StatCard pattern */}
          {stats.length > 0 && (
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.map((s, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col gap-1"
                >
                  <div className="text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                    {s.value}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{s.label}</div>
                </div>
              ))}
            </section>
          )}

          {/* About — banking beyaz card */}
          {aboutText && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
              <p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold mb-2">
                Hakkımızda
              </p>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                Güvenilir bir iş ortağı
              </h2>
              <div className="text-sm md:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {aboutText}
              </div>
            </section>
          )}

          {/* Properties — banking ListCard pattern */}
          {properties.length > 0 && (
            <section>
              <div className="px-1 mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Aktif Portföy
                </h2>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                  {properties.length} kayıt
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {properties.map(p => {
                  const ListingBadge = p.listing_type === "satilik"
                    ? "Satılık"
                    : p.listing_type === "kiralik" ? "Kiralık" : null;
                  const typeLabel = p.type ? (TYPE_LABELS[p.type] || p.type) : null;
                  const hasSunum = !!p.sunum_token;
                  const cardClasses = `block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition ${
                    hasSunum ? "hover:shadow-md active:scale-[0.99]" : "cursor-default opacity-90"
                  }`;
                  const inner = (
                    <>
                      <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        {p.cover ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={p.cover} alt={p.title} className="w-full h-full object-cover" />
                        ) : (
                          <IconHome className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          {ListingBadge && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                              {ListingBadge}
                            </span>
                          )}
                          {typeLabel && (
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {typeLabel}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1.5 line-clamp-2 leading-tight">
                          {p.title}
                        </h3>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400 mb-2">
                          {p.rooms && <span>{p.rooms}</span>}
                          {p.area && <span>{p.area} m²</span>}
                          {p.location && (
                            <span className="flex items-center gap-1">
                              <IconMapPin className="w-3 h-3" /> {p.location}
                            </span>
                          )}
                        </div>
                        {p.price && (
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatPrice(p.price)}
                          </p>
                        )}
                        {hasSunum && (
                          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-2 flex items-center gap-1">
                            <IconPresentation className="w-3.5 h-3.5" /> Sunumu Gör
                            <IconChevronRight className="w-3 h-3" />
                          </p>
                        )}
                      </div>
                    </>
                  );
                  return hasSunum ? (
                    <a
                      key={p.id}
                      href={`/d/p/${p.sunum_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cardClasses}
                    >
                      {inner}
                    </a>
                  ) : (
                    <div key={p.id} className={cardClasses}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Contact closing — banking beyaz card */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
            <p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold mb-2">
              İletişim
            </p>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              Sizinle çalışmak isterim
            </h2>
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300 mb-5">
              {phone && (
                <p className="flex items-center gap-2">
                  <IconPhone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {phone}
                </p>
              )}
              {email && (
                <p className="flex items-center gap-2">
                  <IconAt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {email}
                </p>
              )}
              {agent.office_address && (
                <p className="flex items-center gap-2">
                  <IconMapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {agent.office_address}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm active:scale-[0.97] transition"
                >
                  <IconMessageCircle className="w-4 h-4" /> WhatsApp&apos;ta Yaz
                </a>
              )}
              {telHref && (
                <a
                  href={telHref}
                  className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold px-4 py-2.5 rounded-xl active:scale-[0.97] transition"
                >
                  <IconPhone className="w-4 h-4" /> Hemen Ara
                </a>
              )}
            </div>
          </section>

        </div>
      </body>
    </html>
  );
}
