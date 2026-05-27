import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/tenants/restoran/b2c/restaurant-resolver";
import { getServiceClient } from "@/platform/auth/supabase";
import { MenuView, type MenuItemFull, type Category } from "@/tenants/restoran/b2c/menu-view";

interface RouteParams {
  locale: string;
  slug: string;
}

async function fetchMenu(restaurantId: string): Promise<{ categories: Category[]; items: MenuItemFull[] }> {
  const sb = getServiceClient();

  const [{ data: catData }, { data: itemData }] = await Promise.all([
    sb
      .from("rst_menu_categories")
      .select("id, name, description, image_url, order_index, translations")
      .eq("restaurant_id", restaurantId)
      .eq("is_available", true)
      .order("order_index", { ascending: true }),
    sb
      .from("rst_menu_items")
      .select(
        "id, name, description, category_id, category, price, image_url, allergens, calories, " +
        "is_vegetarian, is_vegan, is_spicy, prep_minutes, is_available, order_index, translations, upsell_ids",
      )
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("order_index", { ascending: true }),
  ]);

  // Supabase select dönüş tipi GenericStringError olarak inferred — cast.
  const itemRows = (itemData || []) as unknown as Array<{
    id: string;
    name: string;
    description: string | null;
    category_id: string | null;
    category: string | null;
    price: number;
    image_url: string | null;
    allergens: string[] | null;
    calories: number | null;
    is_vegetarian: boolean;
    is_vegan: boolean;
    is_spicy: boolean;
    prep_minutes: number | null;
    is_available: boolean;
    order_index: number;
    translations: Record<string, Record<string, string>> | null;
    upsell_ids: string[] | null;
  }>;
  const itemIds = itemRows.map((i) => i.id);
  let variants: { id: string; menu_item_id: string; name: string; price_diff: number; is_default: boolean; order_index: number }[] = [];
  let addons: { id: string; menu_item_id: string; name: string; price: number; order_index: number }[] = [];

  if (itemIds.length > 0) {
    const [{ data: vData }, { data: aData }] = await Promise.all([
      sb
        .from("rst_menu_variants")
        .select("id, menu_item_id, name, price_diff, is_default, order_index")
        .in("menu_item_id", itemIds)
        .order("order_index", { ascending: true }),
      sb
        .from("rst_menu_addons")
        .select("id, menu_item_id, name, price, order_index")
        .in("menu_item_id", itemIds)
        .order("order_index", { ascending: true }),
    ]);
    variants = (vData || []) as typeof variants;
    addons = (aData || []) as typeof addons;
  }

  const items: MenuItemFull[] = itemRows.map((it) => {
    const itemVariants = variants
      .filter((v) => v.menu_item_id === it.id)
      .map((v) => ({ id: v.id, name: v.name, priceDiff: Number(v.price_diff) || 0, isDefault: v.is_default }));
    const itemAddons = addons
      .filter((a) => a.menu_item_id === it.id)
      .map((a) => ({ id: a.id, name: a.name, price: Number(a.price) || 0 }));

    return {
      id: it.id,
      name: it.name,
      description: it.description,
      categoryId: it.category_id,
      categoryName: it.category,
      price: Number(it.price) || 0,
      imageUrl: it.image_url,
      allergens: (it.allergens || []) as string[],
      calories: it.calories,
      isVegetarian: !!it.is_vegetarian,
      isVegan: !!it.is_vegan,
      isSpicy: !!it.is_spicy,
      prepMinutes: it.prep_minutes,
      isAvailable: !!it.is_available,
      variants: itemVariants,
      addons: itemAddons,
      translations: (it.translations || null) as MenuItemFull["translations"],
      upsellIds: (it.upsell_ids || []) as string[],
    };
  });

  const categories: Category[] = ((catData || []) as unknown as Array<{
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    translations: Record<string, Record<string, string>> | null;
  }>).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    imageUrl: c.image_url,
    translations: (c.translations || null) as Category["translations"],
  }));

  return { categories, items };
}

export default async function MenuPage({ params }: { params: Promise<RouteParams> }) {
  const { locale, slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const { categories, items } = await fetchMenu(restaurant.id);

  // Restoran metadata'sından menu_greeting + enabled_languages + default_language al (Sprint 3 D1)
  const sb2 = getServiceClient();
  const { data: rest2 } = await sb2
    .from("rst_restaurants")
    .select("menu_greeting, enabled_languages, default_language")
    .eq("id", restaurant.id)
    .maybeSingle();
  const menuGreeting = (rest2?.menu_greeting as string | null) || null;
  const enabledLanguages = (rest2?.enabled_languages as string[] | null) || ["tr", "nl", "en"];
  const defaultLanguage = (rest2?.default_language as string | null) || "tr";

  return (
    <MenuView
      locale={locale}
      slug={slug}
      brandName={restaurant.brand_name}
      primaryColor={restaurant.primary_color}
      categories={categories}
      items={items}
      menuGreeting={menuGreeting}
      enabledLanguages={enabledLanguages}
      defaultLanguage={defaultLanguage}
    />
  );
}
