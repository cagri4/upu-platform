import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/tenants/restoran/b2c/restaurant-resolver";
import { CartView } from "@/tenants/restoran/b2c/cart-view";

interface RouteParams {
  locale: string;
  slug: string;
}

export default async function SepetPage({ params }: { params: Promise<RouteParams> }) {
  const { locale, slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  return (
    <CartView
      locale={locale}
      slug={slug}
      brandName={restaurant.brand_name}
      primaryColor={restaurant.primary_color}
      acceptsOnlinePayment={restaurant.accepts_online_payment}
      acceptsCashOnDelivery={restaurant.accepts_cash_on_delivery}
      acceptsDineIn={restaurant.accepts_dine_in}
      deliveryZones={restaurant.delivery_zones}
      estimatedPrepMinutes={restaurant.estimated_prep_minutes}
    />
  );
}
