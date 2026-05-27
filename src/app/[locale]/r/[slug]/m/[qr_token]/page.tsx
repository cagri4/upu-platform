/**
 * Masa QR entry: /r/{slug}/m/{qr_token}
 *
 * Müşteri QR taradığında buraya gelir. Server-side:
 *   1. Slug → rst_restaurants lookup
 *   2. qr_token → rst_tables lookup (restaurant_id eşleşmesi şart)
 *   3. Bulundu → client component'e geçir, localStorage'a yaz, /menu'ye yönlendir
 *   4. Bulunamadı → notFound (yanlış QR veya silinmiş masa)
 */
import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/tenants/restoran/b2c/restaurant-resolver";
import { getServiceClient } from "@/platform/auth/supabase";
import { TableEntryClient } from "@/tenants/restoran/b2c/table-entry-client";

interface RouteParams {
  locale: string;
  slug: string;
  qr_token: string;
}

export default async function MasaEntryPage({ params }: { params: Promise<RouteParams> }) {
  const { locale, slug, qr_token } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  // qr_token format check (UUID v4)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qr_token)) {
    notFound();
  }

  const sb = getServiceClient();
  const { data: table } = await sb
    .from("rst_tables")
    .select("id, label, capacity, zone, restaurant_id")
    .eq("qr_token", qr_token)
    .eq("restaurant_id", restaurant.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!table) notFound();

  return (
    <TableEntryClient
      locale={locale}
      slug={slug}
      brandName={restaurant.brand_name}
      primaryColor={restaurant.primary_color}
      tableContext={{
        tableId: table.id as string,
        qrToken: qr_token,
        tableLabel: table.label as string,
        capacity: (table.capacity as number) || null,
        zone: (table.zone as string) || null,
      }}
    />
  );
}
