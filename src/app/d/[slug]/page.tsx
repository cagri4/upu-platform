import { notFound } from "next/navigation";
import { getServiceClient } from "@/platform/auth/supabase";
import type { Metadata } from "next";

/* ── Theme config ──────────────────────────────────────────────────── */

const THEMES: Record<string, { primary: string; gradient: string; gradientLight: string; badge: string }> = {
  blue: {
    primary: "#2563EB",
    gradient: "from-blue-600 to-blue-800",
    gradientLight: "from-blue-50 to-blue-100",
    badge: "bg-blue-100 text-blue-700",
  },
  green: {
    primary: "#059669",
    gradient: "from-emerald-600 to-emerald-800",
    gradientLight: "from-emerald-50 to-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
  },
  purple: {
    primary: "#7C3AED",
    gradient: "from-violet-600 to-violet-800",
    gradientLight: "from-violet-50 to-violet-100",
    badge: "bg-violet-100 text-violet-700",
  },
};

function getTheme(key: string) {
  return THEMES[key] || THEMES.blue;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("tr-TR").format(price) + " TL";
}

function waLink(phone: string | null | undefined, text?: string): string {
  if (!phone) return "#";
  const clean = phone.replace(/\D/g, "");
  const base = `https://wa.me/${clean}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/* ── Data fetching ─────────────────────────────────────────────────── */

interface AgentWebsite {
  id: string;
  user_id: string;
  slug: string;
  full_name: string;
  photo_url: string | null;
  slogan: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  theme: string;
  experience_years: number | null;
  total_sales: number | null;
  is_published: boolean;
}

interface Property {
  id: string;
  title: string | null;
  price: number | null;
  area: number | null;
  rooms: string | null;
  listing_type: string | null;
  location_district: string | null;
  type: string | null;
}

async function getWebsite(slug: string): Promise<AgentWebsite | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("agent_websites")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();
  return data as AgentWebsite | null;
}

async function getProperties(userId: string): Promise<Property[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("emlak_properties")
    .select("id, title, price, area, rooms, listing_type, location_district, type")
    .eq("user_id", userId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(12);
  return (data as Property[]) || [];
}

/* ── Metadata ──────────────────────────────────────────────────────── */

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getWebsite(slug);
  if (!site) return { title: "Sayfa bulunamadi" };

  const description = site.slogan || `${site.full_name} - Emlak Danismani`;
  return {
    title: `${site.full_name} | Emlak Danismani`,
    description,
    openGraph: {
      title: `${site.full_name} | Emlak Danismani`,
      description,
      type: "website",
    },
  };
}

/* ── Page ──────────────────────────────────────────────────────────── */

export default async function AgentWebsitePage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getWebsite(slug);
  if (!site) notFound();

  const properties = await getProperties(site.user_id);
  const theme = getTheme(site.theme);
  const initials = getInitials(site.full_name);

  return (
    <html lang="tr">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {/* ── Sticky Header ─────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white text-sm font-bold`}
              >
                {initials}
              </div>
              <span className="font-semibold text-sm">{site.full_name}</span>
            </div>
            <a
              href={waLink(site.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition`}
            >
              <WhatsAppIcon size={16} />
              WhatsApp
            </a>
          </div>
        </header>

        {/* ── Hero Section ──────────────────────────────────────── */}
        <section
          className={`bg-gradient-to-br ${theme.gradient} text-white py-16 md:py-24`}
        >
          <div className="max-w-3xl mx-auto px-4 text-center">
            {site.photo_url ? (
              <img
                src={site.photo_url}
                alt={site.full_name}
                className="w-28 h-28 rounded-full mx-auto mb-6 border-4 border-white/30 object-cover"
              />
            ) : (
              <div className="w-28 h-28 rounded-full mx-auto mb-6 border-4 border-white/30 bg-white/20 flex items-center justify-center text-4xl font-bold">
                {initials}
              </div>
            )}
            <h1 className="text-3xl md:text-5xl font-bold mb-3">
              {site.full_name}
            </h1>
            {site.slogan && (
              <p className="text-lg md:text-xl opacity-90 mb-8">
                {site.slogan}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={waLink(site.phone, "Merhaba, web sitenizden yaziyorum")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-full transition"
              >
                <WhatsAppIcon size={20} />
                WhatsApp&apos;tan Iletisim
              </a>
              <a
                href="#portfoy"
                className="inline-flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white font-semibold px-6 py-3 rounded-full transition"
              >
                Portfoyu Gor
              </a>
            </div>
          </div>
        </section>

        {/* ── About Section ─────────────────────────────────────── */}
        {(site.bio || site.experience_years || site.total_sales) && (
          <section className="py-12 md:py-16 bg-gray-50">
            <div className="max-w-3xl mx-auto px-4">
              {site.bio && (
                <p className="text-lg text-gray-700 leading-relaxed text-center mb-10">
                  {site.bio}
                </p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {site.experience_years != null && (
                  <StatCard
                    value={`${site.experience_years}+`}
                    label="Yil Deneyim"
                    theme={theme}
                  />
                )}
                {site.total_sales != null && (
                  <StatCard
                    value={`${site.total_sales}+`}
                    label="Basarili Satis"
                    theme={theme}
                  />
                )}
                <StatCard
                  value={`${properties.length}`}
                  label="Aktif Ilan"
                  theme={theme}
                />
                <StatCard value="98%" label="Memnuniyet" theme={theme} />
              </div>
            </div>
          </section>
        )}

        {/* ── Portfolio Section ──────────────────────────────────── */}
        <section id="portfoy" className="py-12 md:py-16">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
              Portfoy
            </h2>
            {properties.length === 0 ? (
              <p className="text-center text-gray-500">
                Portfoy yakinda guncellenecek
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {properties.map((p) => (
                  <PropertyCard key={p.id} property={p} theme={theme} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Contact Section ───────────────────────────────────── */}
        <section className={`py-12 md:py-16 bg-gradient-to-br ${theme.gradientLight}`}>
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Iletisim</h2>
            <div className="space-y-3 mb-8 text-gray-700">
              {site.phone && (
                <p>
                  <a href={`tel:${site.phone}`} className="hover:underline">
                    {site.phone}
                  </a>
                </p>
              )}
              {site.email && (
                <p>
                  <a href={`mailto:${site.email}`} className="hover:underline">
                    {site.email}
                  </a>
                </p>
              )}
              {site.address && <p>{site.address}</p>}
            </div>
            <a
              href={waLink(site.phone, "Merhaba, web sitenizden yaziyorum")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-4 rounded-full text-lg transition"
            >
              <WhatsAppIcon size={24} />
              WhatsApp&apos;tan Mesaj Gonderin
            </a>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────── */}
        <footer className="py-6 text-center text-sm text-gray-400 border-t border-gray-100">
          <p>&copy; 2026 {site.full_name}</p>
          <p className="mt-1">
            <a
              href="https://upudev.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600 transition"
            >
              UPU Dev ile olusturuldu
            </a>
          </p>
        </footer>

        {/* ── Floating WhatsApp Button ──────────────────────────── */}
        <a
          href={waLink(site.phone, "Merhaba, web sitenizden yaziyorum")}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg transition hover:scale-110"
          aria-label="WhatsApp ile iletisim"
        >
          <WhatsAppIcon size={28} color="white" />
        </a>
      </body>
    </html>
  );
}

/* ── Sub-components (inline) ───────────────────────────────────────── */

function StatCard({
  value,
  label,
  theme,
}: {
  value: string;
  label: string;
  theme: ReturnType<typeof getTheme>;
}) {
  return (
    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
      <div className="text-2xl font-bold" style={{ color: theme.primary }}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function PropertyCard({
  property,
  theme,
}: {
  property: Property;
  theme: ReturnType<typeof getTheme>;
}) {
  const isSale = property.listing_type === "satilik";
  const typeLabel = isSale ? "Satilik" : "Kiralik";
  const placeholderColor = isSale ? "bg-blue-100" : "bg-orange-100";

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition">
      <div
        className={`h-36 ${placeholderColor} flex items-center justify-center`}
      >
        <span className="text-4xl opacity-30">
          {isSale ? "🏠" : "🏢"}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">
            {property.title || property.type || "Ilan"}
          </h3>
          <span
            className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${theme.badge}`}
          >
            {typeLabel}
          </span>
        </div>
        {property.price != null && (
          <p className="font-bold text-lg" style={{ color: theme.primary }}>
            {formatPrice(property.price)}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          {property.area && <span>{property.area} m&sup2;</span>}
          {property.rooms && <span>{property.rooms}</span>}
          {property.location_district && (
            <span>{property.location_district}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function WhatsAppIcon({
  size = 24,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
