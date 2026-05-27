import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/tenants/restoran/b2c/restaurant-resolver";
import { getServiceClient } from "@/platform/auth/supabase";
import { OrderTrackingView, type OrderTracking } from "@/tenants/restoran/b2c/order-tracking-view";

interface RouteParams {
  locale: string;
  slug: string;
  id: string;
}

interface RawOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_type: string;
  delivery_address: Record<string, string | null> | null;
  items: Array<{
    name: string;
    variant_name: string | null;
    addons: Array<{ name: string; price: number }>;
    quantity: number;
    unit_price: number;
    total: number;
    notes: string | null;
  }>;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: string;
  payment_method: string;
  payment_status: string;
  estimated_ready_at: string | null;
  created_at: string;
  restaurant_id: string;
}

export default async function SiparisPage({ params }: { params: Promise<RouteParams> }) {
  const { locale, slug, id } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  // UUID kabaca validate (full UUID regex strict olmasın — eski siparişlere uyum)
  if (!/^[0-9a-f-]{20,}$/i.test(id)) notFound();

  const sb = getServiceClient();
  const { data } = await sb
    .from("rst_b2c_orders")
    .select(
      "id, order_number, customer_name, customer_phone, delivery_type, " +
      "delivery_address, items, notes, subtotal, delivery_fee, total, " +
      "status, payment_method, payment_status, estimated_ready_at, " +
      "created_at, restaurant_id",
    )
    .eq("id", id)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  if (!data) notFound();
  const order = data as unknown as RawOrder;

  const tracking: OrderTracking = {
    orderId: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    deliveryType: order.delivery_type,
    deliveryAddress: order.delivery_address,
    items: order.items,
    notes: order.notes,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.delivery_fee),
    total: Number(order.total),
    status: order.status,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    estimatedReadyAt: order.estimated_ready_at,
    createdAt: order.created_at,
  };

  return (
    <OrderTrackingView
      locale={locale}
      slug={slug}
      brandName={restaurant.brand_name}
      primaryColor={restaurant.primary_color}
      restaurantPhone={restaurant.phone}
      order={tracking}
    />
  );
}
