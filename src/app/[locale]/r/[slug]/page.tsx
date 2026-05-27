import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Clock,
  UtensilsCrossed,
  CalendarDays,
  Navigation,
  Instagram,
  Facebook,
} from "lucide-react";
import {
  getRestaurantBySlug,
  getOpeningStatusText,
} from "@/tenants/restoran/b2c/restaurant-resolver";
import { getServiceClient } from "@/platform/auth/supabase";

interface RouteParams {
  locale: string;
  slug: string;
}

interface FeaturedItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
}

function fmtEur(n: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? (Math.abs(n) < 100 ? 2 : 0);
  return `€${n.toLocaleString("tr-NL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

async function getFeaturedItems(restaurantId: string): Promise<FeaturedItem[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("rst_menu_items")
    .select("id, name, description, price, image_url")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .eq("is_available", true)
    .order("order_index", { ascending: true })
    .limit(4);
  return (data || []) as FeaturedItem[];
}

export default async function RestaurantHomePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const featured = await getFeaturedItems(restaurant.id);
  const status = getOpeningStatusText(restaurant.opening_hours);
  const mapsUrl =
    restaurant.social?.google_maps_url ||
    (restaurant.address
      ? `https://maps.google.com/?q=${encodeURIComponent(restaurant.address + (restaurant.city ? `, ${restaurant.city}` : ""))}`
      : null);

  const r = (path: string) => `/${locale}/r/${slug}${path}`;

  return (
    <main className="max-w-2xl mx-auto pb-16">
      {/* Hero */}
      <section className="relative">
        {restaurant.hero_image_url ? (
          <div
            className="h-56 sm:h-72 bg-cover bg-center relative"
            style={{ backgroundImage: `url(${restaurant.hero_image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/60" />
            <BrandBadge restaurant={restaurant} variant="overlay" />
          </div>
        ) : (
          <div
            className="h-44 sm:h-56 relative flex items-center justify-center"
            style={{
              backgroundImage: `linear-gradient(135deg, ${restaurant.primary_color}, ${restaurant.secondary_color})`,
            }}
          >
            <BrandBadge restaurant={restaurant} variant="solid" />
          </div>
        )}
      </section>

      <div className="px-4 sm:px-6 -mt-8 sm:-mt-10 relative z-10">
        {/* Status + adres kart */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200/70 dark:border-slate-800 p-5 mb-4">
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${
              status.open
                ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${status.open ? "bg-emerald-500" : "bg-slate-400"}`}
              aria-hidden="true"
            />
            {status.text}
          </div>

          {restaurant.tagline && (
            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-3">
              {restaurant.tagline}
            </p>
          )}

          <div className="space-y-1.5 text-sm">
            {restaurant.address && (
              <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
                <span>
                  {restaurant.address}
                  {restaurant.city ? `, ${restaurant.city}` : ""}
                </span>
              </div>
            )}
            {restaurant.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                <Phone className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                <span>{restaurant.phone}</span>
              </a>
            )}
            {restaurant.estimated_prep_minutes && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Clock className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                <span>Tahmini hazırlık {restaurant.estimated_prep_minutes} dk</span>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="grid grid-cols-1 gap-2 mb-5">
          <Link
            href={r("/menu")}
            className="flex items-center justify-center gap-2 text-white font-semibold px-5 py-3.5 rounded-2xl shadow-md hover:opacity-95 active:scale-[0.98] transition"
            style={{ backgroundColor: restaurant.primary_color }}
          >
            <UtensilsCrossed className="w-5 h-5" strokeWidth={2.2} />
            Sipariş Ver
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={restaurant.phone ? `tel:${restaurant.phone}` : "#"}
              className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium px-4 py-3 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <CalendarDays className="w-4 h-4" strokeWidth={2.2} />
              Rezervasyon
            </a>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium px-4 py-3 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <Navigation className="w-4 h-4" strokeWidth={2.2} />
                Yol Tarifi
              </a>
            )}
          </div>
        </div>

        {/* Öne çıkan ürünler */}
        {featured.length > 0 && (
          <section className="mb-6">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 px-1">
              Öne çıkan
            </div>
            <div className="grid grid-cols-2 gap-3">
              {featured.map((item) => (
                <Link
                  key={item.id}
                  href={r(`/menu#item-${item.id}`)}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  {item.image_url ? (
                    <div
                      className="aspect-square bg-cover bg-center"
                      style={{ backgroundImage: `url(${item.image_url})` }}
                    />
                  ) : (
                    <div className="aspect-square bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <UtensilsCrossed
                        className="w-10 h-10 text-slate-300 dark:text-slate-700"
                        strokeWidth={1.5}
                      />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                      {item.name}
                    </div>
                    <div
                      className="font-bold text-sm mt-1"
                      style={{ color: restaurant.primary_color }}
                    >
                      {fmtEur(item.price)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Teslimat bölgeleri */}
        {Array.isArray(restaurant.delivery_zones) && restaurant.delivery_zones.length > 0 && (
          <section className="mb-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Teslimat bölgeleri
            </div>
            <ul className="space-y-2">
              {restaurant.delivery_zones.map((zone, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{zone.name}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {zone.min_order ? `Min ${fmtEur(zone.min_order, { decimals: 0 })}` : ""}
                    {zone.fee != null && zone.fee > 0 ? ` · ${fmtEur(zone.fee)}` : zone.fee === 0 ? " · Ücretsiz" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sosyal medya */}
        {(restaurant.social?.instagram || restaurant.social?.facebook) && (
          <div className="flex items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
            {restaurant.social.instagram && (
              <a
                href={`https://instagram.com/${restaurant.social.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="hover:text-slate-700 dark:hover:text-slate-300 transition"
              >
                <Instagram className="w-5 h-5" strokeWidth={2.2} />
              </a>
            )}
            {restaurant.social.facebook && (
              <a
                href={restaurant.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="hover:text-slate-700 dark:hover:text-slate-300 transition"
              >
                <Facebook className="w-5 h-5" strokeWidth={2.2} />
              </a>
            )}
          </div>
        )}

        <div className="text-center text-xs text-slate-400 dark:text-slate-600 mt-8">
          UPU restoran ile yayında
        </div>
      </div>
    </main>
  );
}

function BrandBadge({
  restaurant,
  variant,
}: {
  restaurant: { brand_name: string; logo_url: string | null };
  variant: "overlay" | "solid";
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 px-4 text-center">
      {restaurant.logo_url ? (
        <img
          src={restaurant.logo_url}
          alt={restaurant.brand_name}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/95 p-1.5 shadow-lg mb-3 object-contain"
        />
      ) : (
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/95 shadow-lg mb-3 flex items-center justify-center text-3xl">
          🍽
        </div>
      )}
      <h1
        className={`text-2xl sm:text-3xl font-bold text-white leading-tight ${
          variant === "overlay" ? "drop-shadow-md" : ""
        }`}
      >
        {restaurant.brand_name}
      </h1>
    </div>
  );
}
