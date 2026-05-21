/**
 * Bayi referral / credit engine — Faz C 3.7.
 *
 * Akış:
 *   1. Bayi A → kod oluştur (bayi_referral_codes)
 *   2. Yeni bayi B signup sonrası /api/bayi-referral/claim → status='accepted'
 *   3. Cron — B'nin ilk dealer order'ı saptanırsa → status='earned',
 *      addCredit(A, reward_amount) çağrılır.
 *   4. Bayi A bir sonraki sipariş ekranında "Kredi kullan" işaretler →
 *      applyCreditToOrder.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

export type CreditSource = "referral_earn" | "order_apply" | "manual_adjust" | "expire";

export interface CreditMovementInput {
  tenantId: string;
  dealerUserId: string;
  delta: number;
  source: CreditSource;
  referenceId?: string;
  description?: string;
  createdBy?: string;
}

export async function generateCode(
  sb: SupabaseClient,
  tenantId: string,
  dealerUserId: string,
  rewardAmount: number = 100,
): Promise<{ id: string; code: string } | { error: string }> {
  // Already has active code?
  const { data: existing } = await sb
    .from("bayi_referral_codes")
    .select("id, code")
    .eq("dealer_user_id", dealerUserId)
    .eq("is_active", true)
    .maybeSingle();
  if (existing) return existing;

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomBytes(4).toString("hex").toUpperCase().slice(0, 8);
    const { data, error } = await sb
      .from("bayi_referral_codes")
      .insert({
        tenant_id: tenantId,
        dealer_user_id: dealerUserId,
        code,
        reward_amount: rewardAmount,
        reward_currency: "TRY",
        is_active: true,
      })
      .select("id, code")
      .single();
    if (data) return data;
    if (error && !`${error.message}`.match(/duplicate|unique/i)) {
      return { error: error.message };
    }
  }
  return { error: "Kod oluşturulamadı, lütfen tekrar deneyin." };
}

export async function addCredit(
  sb: SupabaseClient,
  input: CreditMovementInput,
): Promise<void> {
  const { dealerUserId, tenantId, delta, source, referenceId, description, createdBy } = input;
  const nowIso = new Date().toISOString();

  // Upsert dealer_credits row (composite increment via fetch + update — not
  // atomic but adequate for low contention; for high TPS use RPC).
  const { data: current } = await sb
    .from("bayi_dealer_credits")
    .select("balance, lifetime_earned, lifetime_used")
    .eq("dealer_user_id", dealerUserId)
    .maybeSingle();

  const nextBalance = (Number(current?.balance) || 0) + delta;
  const nextEarned = (Number(current?.lifetime_earned) || 0) + (delta > 0 ? delta : 0);
  const nextUsed = (Number(current?.lifetime_used) || 0) + (delta < 0 ? Math.abs(delta) : 0);

  if (current) {
    await sb
      .from("bayi_dealer_credits")
      .update({
        balance: nextBalance,
        lifetime_earned: nextEarned,
        lifetime_used: nextUsed,
        last_movement_at: nowIso,
      })
      .eq("dealer_user_id", dealerUserId);
  } else {
    await sb.from("bayi_dealer_credits").insert({
      dealer_user_id: dealerUserId,
      tenant_id: tenantId,
      balance: nextBalance,
      currency: "TRY",
      lifetime_earned: nextEarned,
      lifetime_used: nextUsed,
      last_movement_at: nowIso,
    });
  }

  await sb.from("bayi_credit_movements").insert({
    tenant_id: tenantId,
    dealer_user_id: dealerUserId,
    delta,
    source,
    reference_id: referenceId || null,
    description: description ? description.slice(0, 500) : null,
    created_by: createdBy || null,
  });
}

export async function claimReferral(
  sb: SupabaseClient,
  code: string,
  newDealerUserId: string,
  newDealerName?: string | null,
): Promise<{ ok: true; referral_id: string } | { ok: false; error: string }> {
  const { data: codeRow } = await sb
    .from("bayi_referral_codes")
    .select("id, tenant_id, dealer_user_id, max_uses, current_uses, reward_amount, reward_currency, is_active, expires_at")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!codeRow || !codeRow.is_active) return { ok: false, error: "Kod geçersiz." };
  if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Kodun süresi dolmuş." };
  }
  if (codeRow.max_uses && codeRow.current_uses >= codeRow.max_uses) {
    return { ok: false, error: "Kod kullanım limiti dolmuş." };
  }
  if (codeRow.dealer_user_id === newDealerUserId) {
    return { ok: false, error: "Kendi kodunuzu kullanamazsınız." };
  }

  // Tek referral / referred-dealer kuralı
  const { data: existing } = await sb
    .from("bayi_referrals")
    .select("id, status")
    .eq("referred_dealer_id", newDealerUserId)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "Bu bayi zaten bir referans ile kayıtlı." };
  }

  const nowIso = new Date().toISOString();
  const { data: ref, error: refErr } = await sb
    .from("bayi_referrals")
    .insert({
      tenant_id: codeRow.tenant_id,
      referrer_dealer_id: codeRow.dealer_user_id,
      referred_dealer_id: newDealerUserId,
      referred_name: newDealerName ? newDealerName.slice(0, 200) : null,
      code_id: codeRow.id,
      status: "accepted",
      reward_amount: codeRow.reward_amount,
      reward_currency: codeRow.reward_currency,
      accepted_at: nowIso,
    })
    .select("id")
    .single();

  if (refErr || !ref) return { ok: false, error: refErr?.message || "Kayıt başarısız." };

  await sb
    .from("bayi_referral_codes")
    .update({ current_uses: (codeRow.current_uses || 0) + 1 })
    .eq("id", codeRow.id);

  return { ok: true, referral_id: ref.id };
}

interface AwardStats {
  candidates: number;
  awarded: number;
  errors: number;
}

/**
 * Cron — accepted referrals'ları tarayıp referred_dealer'ın ilk siparişi
 * varsa earned + credit award. Idempotent (status check).
 */
export async function awardEligibleReferrals(sb: SupabaseClient): Promise<AwardStats> {
  const stats: AwardStats = { candidates: 0, awarded: 0, errors: 0 };

  const { data: accepted } = await sb
    .from("bayi_referrals")
    .select("id, tenant_id, referrer_dealer_id, referred_dealer_id, reward_amount, reward_currency")
    .eq("status", "accepted")
    .not("referred_dealer_id", "is", null)
    .limit(500);

  stats.candidates = (accepted || []).length;

  for (const ref of accepted || []) {
    try {
      // İlk başarılı sipariş kontrolü (status not in rejected/cancelled)
      const { data: firstOrder } = await sb
        .from("bayi_dealer_orders")
        .select("id, created_at, status")
        .eq("dealer_user_id", ref.referred_dealer_id)
        .not("status", "in", "(rejected,cancelled)")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!firstOrder) continue;

      const nowIso = new Date().toISOString();
      const reward = Number(ref.reward_amount) || 0;

      await sb
        .from("bayi_referrals")
        .update({
          status: "earned",
          earned_at: nowIso,
          first_order_id: firstOrder.id,
        })
        .eq("id", ref.id)
        .eq("status", "accepted"); // race guard

      if (reward > 0) {
        await addCredit(sb, {
          tenantId: ref.tenant_id,
          dealerUserId: ref.referrer_dealer_id,
          delta: reward,
          source: "referral_earn",
          referenceId: ref.id,
          description: "Referans ödülü — yeni bayinin ilk siparişi tahakkuk etti.",
        });
      }

      stats.awarded++;
    } catch (err) {
      console.error("[referral:award]", err);
      stats.errors++;
    }
  }

  return stats;
}
