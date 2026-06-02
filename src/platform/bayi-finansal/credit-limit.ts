/**
 * Bayi kredi limiti enforcement helper.
 *
 * Portal sipariş akışında (`/api/bayi-dealer-orders/create`) çağırıyoruz:
 *   1. dealer_user_id (= profiles.id) → bayi_dealers kaydı eşle
 *      (önce user_id, sonra phone/email fallback)
 *   2. credit_limit NULL ise limitsiz (eski davranış)
 *   3. balance + total > credit_limit ise 409 dön
 *
 * Audit raporu (#106) — `balance > 0` = bayi borçlu (vade), bayiler/list
 * route'u ile aynı konvansiyon. balance < 0 ise bayi kredili (önceden
 * fazla ödemiş), enforcement'ta lehinde sayılır.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CreditCheckResult {
  status: "unlimited" | "ok" | "exceeded" | "no_dealer";
  dealerId: string | null;
  currentBalance: number;
  attemptedTotal: number;
  creditLimit: number | null;
  exceededBy: number;
}

interface DealerLookup {
  id: string;
  credit_limit: number | null;
  balance: number | null;
}

interface ProfileLookup {
  whatsapp_phone: string | null;
  email: string | null;
}

/**
 * Profil → bayi_dealers eşleştirme. Birden çok bayi eşleşirse en güncel
 * (en son updated_at) seçilir; updated_at yoksa created_at fallback.
 */
async function findDealerForProfile(
  sb: SupabaseClient,
  tenantId: string,
  profileId: string,
  profile: ProfileLookup | null,
): Promise<DealerLookup | null> {
  const { data: byUser } = await sb
    .from("bayi_dealers")
    .select("id, credit_limit, balance, updated_at, created_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", profileId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (byUser && byUser.length > 0) return byUser[0] as DealerLookup;

  const phone = profile?.whatsapp_phone?.trim();
  if (phone) {
    const { data: byPhone } = await sb
      .from("bayi_dealers")
      .select("id, credit_limit, balance, updated_at, created_at")
      .eq("tenant_id", tenantId)
      .eq("phone", phone)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (byPhone && byPhone.length > 0) return byPhone[0] as DealerLookup;
  }

  const email = profile?.email?.trim().toLowerCase();
  if (email) {
    const { data: byEmail } = await sb
      .from("bayi_dealers")
      .select("id, credit_limit, balance, updated_at, created_at")
      .eq("tenant_id", tenantId)
      .ilike("email", email)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (byEmail && byEmail.length > 0) return byEmail[0] as DealerLookup;
  }

  return null;
}

export async function checkCreditLimit(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    profileId: string;
    profile?: ProfileLookup | null;
    attemptedTotal: number;
  },
): Promise<CreditCheckResult> {
  const dealer = await findDealerForProfile(sb, args.tenantId, args.profileId, args.profile ?? null);

  if (!dealer) {
    return {
      status: "no_dealer",
      dealerId: null,
      currentBalance: 0,
      attemptedTotal: args.attemptedTotal,
      creditLimit: null,
      exceededBy: 0,
    };
  }

  if (dealer.credit_limit === null || dealer.credit_limit === undefined) {
    return {
      status: "unlimited",
      dealerId: dealer.id,
      currentBalance: Number(dealer.balance) || 0,
      attemptedTotal: args.attemptedTotal,
      creditLimit: null,
      exceededBy: 0,
    };
  }

  const balance = Number(dealer.balance) || 0;
  const limit = Number(dealer.credit_limit);
  const projected = balance + args.attemptedTotal;
  const exceededBy = projected - limit;

  return {
    status: exceededBy > 0 ? "exceeded" : "ok",
    dealerId: dealer.id,
    currentBalance: balance,
    attemptedTotal: args.attemptedTotal,
    creditLimit: limit,
    exceededBy: Math.max(0, exceededBy),
  };
}
