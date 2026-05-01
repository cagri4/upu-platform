/**
 * Otel multi-property resolver.
 *
 * `profiles.capabilities` is the **global default** capability bundle. For
 * binlerce-otel ölçeği, per-hotel override comes from `hotel_employees`.
 *
 *   - Owner (`capabilities = ['*']`): tüm bağlı oteller (otel_user_hotels)
 *   - Employee: hotel_employees.capabilities (per-hotel)
 *   - Guest: profile.capabilities (lifetime, hotel-bağımsız çekirdek)
 *
 * Service role calls (WhatsApp router) bypass RLS — bu helper'lar
 * application-level scope filter olarak kullanılır.
 */

import { OWNER_ALL, OTEL_CAPABILITIES, type OtelCapability } from "./capabilities";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hangi otellere erişim var? Owner için otel_user_hotels, employee için
 * hotel_employees. Birleşik liste döner.
 */
export async function getUserHotelIds(
  supabase: SupabaseClient,
  profileId: string,
): Promise<string[]> {
  const ids = new Set<string>();

  // Owner kanalı (otel_user_hotels — column: user_id)
  const { data: owned } = await supabase
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", profileId);
  for (const r of owned ?? []) if (r.hotel_id) ids.add(r.hotel_id);

  // Employee kanalı (hotel_employees)
  const { data: emp } = await supabase
    .from("hotel_employees")
    .select("hotel_id")
    .eq("profile_id", profileId);
  for (const r of emp ?? []) if (r.hotel_id) ids.add(r.hotel_id);

  return Array.from(ids);
}

/**
 * Belirli bir otel context'inde kullanıcının efektif capability'lerini döner.
 *
 * Karar ağacı:
 *  1. profile.capabilities = ['*']  → owner, tüm yetkiler. Owner'ın bu otele
 *     bağlılığı otel_user_hotels'den doğrulanır; bağlı değilse boş.
 *  2. hotel_employees row var → o satırın capabilities'i (per-hotel override)
 *  3. Hiçbiri yoksa → profile.capabilities (global fallback — guest, single-hotel
 *     deployment'lar için)
 */
export async function getEffectiveCapabilities(
  supabase: SupabaseClient,
  profileId: string,
  hotelId: string | null,
): Promise<string[]> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("capabilities, role")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) return [];

  const profileCaps: string[] = Array.isArray(profile.capabilities) ? profile.capabilities : [];
  const isOwner = profileCaps.includes(OWNER_ALL);

  // hotelId vermezsek (örn: davet öncesi, multi-hotel resolver'a giriş yok),
  // global capability bundle yeterli.
  if (!hotelId) return profileCaps;

  // Owner: otel_user_hotels bağlılığı kontrolü (column: user_id)
  if (isOwner) {
    const { data: bind } = await supabase
      .from("otel_user_hotels")
      .select("hotel_id")
      .eq("user_id", profileId)
      .eq("hotel_id", hotelId)
      .maybeSingle();
    return bind ? [OWNER_ALL] : [];
  }

  // Employee: hotel_employees row varsa onu kullan
  const { data: empRow } = await supabase
    .from("hotel_employees")
    .select("capabilities")
    .eq("profile_id", profileId)
    .eq("hotel_id", hotelId)
    .maybeSingle();

  if (empRow && Array.isArray(empRow.capabilities) && empRow.capabilities.length > 0) {
    return empRow.capabilities;
  }

  // Guest veya single-hotel fallback: profile.capabilities
  return profileCaps;
}

/**
 * Bir kullanıcının "etkin" hotel_id'si — multi-hotel sahipler için
 * default seçim. saas_active_session'da kayıtlıysa onu, değilse
 * otel_user_hotels'in ilkini.
 */
export async function getActiveHotelId(
  supabase: SupabaseClient,
  profileId: string,
): Promise<string | null> {
  // saas_active_session metadata'sında hotel_id var mı?
  const { data: sess } = await supabase
    .from("saas_active_session")
    .select("metadata")
    .eq("phone", "")              // session'lar phone bazlı; profileId üzerinden çekemiyoruz
    .maybeSingle();
  // (Bu kısım WaContext'le ilgili; gerçek lookup router tarafında olur.
  //  Helper'da fallback olarak ilk bağlı oteli döner.)
  void sess;

  const { data: owned } = await supabase
    .from("otel_user_hotels")
    .select("hotel_id, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (owned && owned.length > 0 && owned[0].hotel_id) return owned[0].hotel_id;

  const { data: emp } = await supabase
    .from("hotel_employees")
    .select("hotel_id, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (emp && emp.length > 0 && emp[0].hotel_id) return emp[0].hotel_id;

  return null;
}

/**
 * Application-level scope filter — tüm `otel_*` query'lerinin where clause'unda
 * kullanılır. WhatsApp service-role bypass'ından dolayı RLS yetmiyor; kod tarafı
 * filter ekler.
 *
 * Kullanım:
 *   const hotels = await getUserHotelIds(sb, ctx.userId);
 *   sb.from("otel_reservations").select("*").in("hotel_id", hotels);
 */
export async function applyHotelScope<T extends { in: (col: string, vals: string[]) => unknown }>(
  query: T,
  supabase: SupabaseClient,
  profileId: string,
): Promise<T> {
  const hotels = await getUserHotelIds(supabase, profileId);
  if (hotels.length === 0) {
    // No bound hotel → empty result. Use a sentinel UUID that never matches.
    return query.in("hotel_id", ["00000000-0000-0000-0000-000000000000"]) as T;
  }
  return query.in("hotel_id", hotels) as T;
}

// Re-export for convenience
export { OTEL_CAPABILITIES, type OtelCapability };
