/**
 * Public sipariş sitesi layout — `/r/{slug}/*`
 *
 * Slug ile restoran lookup → 404 ya da white-label brand context'i sayfaya
 * geçir. CSS variable inject (--brand, --brand-fg) ile Tailwind brand color
 * (sayfa render'ında).
 *
 * Auth: yok. Anonim erişim. RLS rst_restaurants is_published=true filtreliyor.
 */
import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/tenants/restoran/b2c/restaurant-resolver";

interface RouteParams {
  locale: string;
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return { title: "Restoran bulunamadı — UPU" };
  }
  return {
    title: `${restaurant.brand_name} — Online Sipariş`,
    description: restaurant.tagline || `${restaurant.brand_name} menü + sipariş`,
    icons: restaurant.logo_url ? [{ rel: "icon", url: restaurant.logo_url }] : undefined,
  };
}

export default async function RestaurantPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    notFound();
  }

  // CSS variable inject — sayfa içinde Tailwind `style={{ color: 'var(--brand)' }}`
  // veya inline class ile kullanılır. JSX'te `style` prop'una da geçirebiliriz.
  const cssVars = `
    :root {
      --brand: ${restaurant.primary_color};
      --brand-fg: #ffffff;
      --brand-secondary: ${restaurant.secondary_color};
      --brand-font: ${restaurant.font_family};
    }
    body { font-family: var(--brand-font), Inter, system-ui, sans-serif; }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {children}
      </div>
    </>
  );
}
