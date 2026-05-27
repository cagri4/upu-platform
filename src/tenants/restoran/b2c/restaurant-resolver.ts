/**
 * Public restoran resolver — `/r/{slug}` rotaları için.
 *
 * Slug ile rst_restaurants lookup. Sadece is_published=true olanlar döner;
 * draft veya unpublished olanlar için null → sayfa 404 olur.
 *
 * RLS: rst_restaurants public SELECT policy zaten is_published=true filtreliyor,
 * anon client kullanılabilir. Ama API route'larda service client tercih edilir
 * (RLS bypass + performans). Bu helper ikisini de destekler.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/platform/auth/supabase";

export interface PublicRestaurant {
  id: string;
  tenant_id: string;
  owner_user_id: string | null;
  slug: string;
  brand_name: string;
  tagline: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  address: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  opening_hours: Record<string, string | string[]>;
  social: { instagram?: string; facebook?: string; tiktok?: string; google_maps_url?: string };
  is_published: boolean;
  accepts_online_payment: boolean;
  accepts_cash_on_delivery: boolean;
  accepts_dine_in: boolean;
  delivery_zones: Array<{ name: string; postal_codes?: string[]; min_order?: number; fee?: number }>;
  estimated_prep_minutes: number;
}

export async function getRestaurantBySlug(
  slug: string,
  client?: SupabaseClient,
): Promise<PublicRestaurant | null> {
  if (!slug || slug.length < 2 || slug.length > 64) return null;
  // slug temizliği: lowercase + a-z0-9- karakterler
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return null;

  const sb = client || getServiceClient();
  const { data, error } = await sb
    .from("rst_restaurants")
    .select(
      "id, tenant_id, owner_user_id, slug, brand_name, tagline, logo_url, hero_image_url, " +
      "primary_color, secondary_color, font_family, address, city, country, phone, email, " +
      "opening_hours, social, is_published, accepts_online_payment, accepts_cash_on_delivery, " +
      "accepts_dine_in, delivery_zones, estimated_prep_minutes",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as PublicRestaurant;
}

/**
 * Açık mı kontrol — opening_hours jsonb formatı:
 *   { "mon": "12:00-23:00", "tue": "12:00-23:00", ..., "closed": ["sun"] }
 * Bugünün gününe bakar, "HH:MM-HH:MM" aralığını parse eder. Aralık verisi
 * eksikse `true` döner (kapalı varsayma — admin yayına aldıysa açık kabul).
 */
export function isRestaurantOpenNow(
  hours: PublicRestaurant["opening_hours"],
  now: Date = new Date(),
): boolean {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayKey = days[now.getDay()];

  // Kapalı günler listesi
  const closed = hours.closed;
  if (Array.isArray(closed) && closed.includes(dayKey)) return false;

  const range = hours[dayKey];
  if (!range || typeof range !== "string") return true;  // Saat tanımı yoksa açık say

  const m = range.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!m) return true;

  const openMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const closeMin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Gece yarısı geçen aralıkları destekle (ör 18:00-02:00)
  if (closeMin < openMin) {
    return nowMin >= openMin || nowMin < closeMin;
  }
  return nowMin >= openMin && nowMin < closeMin;
}

/**
 * Açılış-kapanış metni — UI'da "Açık · 23:00'a kadar" / "Kapalı · 12:00'da açılır"
 */
export function getOpeningStatusText(
  hours: PublicRestaurant["opening_hours"],
  now: Date = new Date(),
): { open: boolean; text: string } {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayKey = days[now.getDay()];
  const range = hours[dayKey];

  const isOpen = isRestaurantOpenNow(hours, now);

  if (typeof range === "string") {
    const m = range.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (m) {
      const closeHHMM = `${m[3].padStart(2, "0")}:${m[4]}`;
      const openHHMM = `${m[1].padStart(2, "0")}:${m[2]}`;
      return isOpen
        ? { open: true, text: `${closeHHMM}'a kadar açık` }
        : { open: false, text: `${openHHMM}'da açılır` };
    }
  }
  return { open: isOpen, text: isOpen ? "Açık" : "Kapalı" };
}

/**
 * Slug güvenli oluştur — brand name'den. Türkçe karakter normalize +
 * lowercase + non-alphanumeric → '-'. Çakışma kontrolü yok (DB UNIQUE
 * constraint ile çakışırsa caller -2, -3 suffix denemeli).
 */
export function brandNameToSlug(name: string): string {
  const tr = name
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
  return tr
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 64);
}
