/**
 * isPro / getSubscription — abonelik durumu helper'ı.
 *
 * Tier semantik:
 * - plan='trial' AND trial_ends_at > now() → effective Pro (deneme süresinde
 *   tüm Pro özellikleri açık)
 * - plan in ('pro_monthly', 'pro_yearly') AND status='active' → Pro
 * - diğer her şey (plan='free', status='canceled'/'expired'/'past_due',
 *   trial bitmiş) → Free
 *
 * Trial sona erince user'ı Free'ye düşürmek cron tarafından yapılır
 * (api/cron/billing-tick); ancak isPro defansif olarak DB'deki ham veriyi
 * okur — cron çalışmamış bile olsa trial_ends_at < now ise pro değil.
 */
import { getServiceClient } from "@/platform/auth/supabase";

export interface Subscription {
  user_id: string;
  plan: "trial" | "free" | "pro_monthly" | "pro_yearly" | string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  payment_provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as Subscription | null) ?? null;
}

export async function isPro(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId);
  if (!sub) return false;
  return isProSub(sub);
}

export function isProSub(sub: Subscription): boolean {
  // Trial sürerken Pro
  if (sub.plan === "trial") {
    if (!sub.trial_ends_at) return false;
    return new Date(sub.trial_ends_at).getTime() > Date.now();
  }
  // Aktif Pro abonelik
  if (sub.plan === "pro_monthly" || sub.plan === "pro_yearly") {
    return sub.status === "active";
  }
  return false;
}

/**
 * Yeni kullanıcı için trial başlatma (idempotent).
 * Subscription kaydı yoksa oluşturur, varsa dokunmaz.
 * 14 gün trial.
 */
export async function ensureTrialSubscription(userId: string): Promise<Subscription> {
  const existing = await getSubscription(userId);
  if (existing) return existing;
  const sb = getServiceClient();
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan: "trial",
      status: "active",
      trial_ends_at: trialEndsAt,
    })
    .select("*")
    .single();
  if (error || !data) {
    // Race koşulu olabilir — yeniden oku
    const refetch = await getSubscription(userId);
    if (refetch) return refetch;
    throw error || new Error("Trial başlatılamadı.");
  }
  return data as unknown as Subscription;
}
