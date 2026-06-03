/**
 * Bayi-spesifik ürün görünürlüğü helper'ları.
 *
 * Opt-out modeli: row yoksa → görünür. Admin bir ürünü gizlemek için
 * `bayi_product_visibility` tablosuna `visible=false` satır ekler.
 *
 * Lookup zinciri (profile → dealer):
 *   1. bayi_dealers.user_id = profile.id
 *   2. fallback: phone match
 *   3. fallback: email match (lower-case)
 * Bu zincir credit-limit.ts ile aynı pattern (single source-of-truth
 * profile-dealer eşleme).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

interface ProfileLookup {
  whatsapp_phone: string | null;
  email: string | null;
}

export async function resolveDealerIdForProfile(
  sb: SupabaseClient,
  tenantId: string,
  profileId: string,
  profile: ProfileLookup | null,
): Promise<string | null> {
  const { data: byUser } = await sb
    .from("bayi_dealers")
    .select("id, updated_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", profileId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (byUser && byUser.length > 0) return byUser[0].id as string;

  const phone = profile?.whatsapp_phone?.trim();
  if (phone) {
    const { data: byPhone } = await sb
      .from("bayi_dealers")
      .select("id, updated_at")
      .eq("tenant_id", tenantId)
      .eq("phone", phone)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (byPhone && byPhone.length > 0) return byPhone[0].id as string;
  }

  const email = profile?.email?.trim().toLowerCase();
  if (email) {
    const { data: byEmail } = await sb
      .from("bayi_dealers")
      .select("id, updated_at")
      .eq("tenant_id", tenantId)
      .ilike("email", email)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (byEmail && byEmail.length > 0) return byEmail[0].id as string;
  }

  return null;
}

/**
 * Bir dealer için açıkça gizlenmiş (visible=false) ürün id seti.
 * Dealer yoksa → boş set (filtre uygulanmaz).
 */
export async function getHiddenProductIdsForDealer(
  sb: SupabaseClient,
  dealerId: string | null,
): Promise<Set<string>> {
  if (!dealerId) return new Set<string>();
  const { data } = await sb
    .from("bayi_product_visibility")
    .select("product_id")
    .eq("dealer_id", dealerId)
    .eq("visible", false);
  return new Set((data || []).map((r: { product_id: string }) => r.product_id));
}
