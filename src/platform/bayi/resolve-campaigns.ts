/**
 * resolveCampaignsFor — bayi × cart → uygulanan kampanyalar.
 *
 * Akış:
 *   1. Aktif kampanyaları çek (status='active' + tarih aralığında)
 *   2. Her kampanyanın hedeflemesini kontrol et (all / segment / region / dealer)
 *   3. Kuralı cart üzerine uygula → indirim/hediye/kargo etkisi hesapla
 *   4. Kupon kodu ise sadece kullanıcı kod girmişse uygula
 *   5. Sonuç: indirim toplamı + applied campaigns listesi (audit için)
 *
 * Çakışma kuralı: tüm uygun kampanyalar stack edilir (eklenir). Çoklu
 * kampanya kullanımı yaygın (örn. segment indirimi + bayi-özel kupon).
 *
 * Bu motor Faz 2'de bayi-side checkout'unda çağrılacak. Şimdi dağıtıcı
 * tarafında "Performans" preview ve test için kullanılır.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CartLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  categoryId?: string | null;
}

export interface AppliedCampaign {
  campaignId: string;
  campaignName: string;
  type: string;
  discountAmount: number;
  giftProductId?: string | null;
  giftQuantity?: number | null;
  freeShipping?: boolean;
  affectedLines: string[];
  note: string;
}

export interface ResolveCampaignsResult {
  appliedCampaigns: AppliedCampaign[];
  totalDiscount: number;
  freeShipping: boolean;
  gifts: Array<{ productId: string; quantity: number; campaignId: string }>;
  subtotal: number;
  finalTotal: number;
}

interface CampaignRow {
  id: string;
  title: string;
  type: string | null;
  start_date: string;
  end_date: string;
  status: string;
  max_usage: number | null;
  per_dealer_max_usage: number | null;
  coupon_code: string | null;
}

interface TargetRow {
  campaign_id: string;
  target_type: string;
  target_value: string | null;
}

interface RuleRow {
  campaign_id: string;
  rule_type: string;
  params: Record<string, unknown>;
}

export async function resolveCampaignsFor(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    dealerId: string;
    cart: CartLine[];
    couponCode?: string | null;
  },
): Promise<ResolveCampaignsResult> {
  const { tenantId, dealerId, cart, couponCode } = args;
  const today = new Date().toISOString().slice(0, 10);
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  // Bayi segment + region (hedefleme kontrolü için)
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("segment, region")
    .eq("tenant_id", tenantId)
    .eq("id", dealerId)
    .maybeSingle();
  const dealerSegment = (dealer?.segment as string) || null;
  const dealerRegion = (dealer?.region as string) || null;

  // Aktif kampanyalar
  const { data: camps } = await sb
    .from("bayi_campaigns")
    .select(
      "id, title, type, start_date, end_date, status, max_usage, per_dealer_max_usage, coupon_code",
    )
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .lte("start_date", today)
    .gte("end_date", today);

  const eligibleCampaigns = (camps ?? []) as CampaignRow[];
  if (eligibleCampaigns.length === 0) {
    return {
      appliedCampaigns: [],
      totalDiscount: 0,
      freeShipping: false,
      gifts: [],
      subtotal,
      finalTotal: subtotal,
    };
  }

  const campaignIds = eligibleCampaigns.map((c) => c.id);
  const [{ data: targets }, { data: rules }] = await Promise.all([
    sb
      .from("bayi_campaign_targets")
      .select("campaign_id, target_type, target_value")
      .eq("tenant_id", tenantId)
      .in("campaign_id", campaignIds),
    sb
      .from("bayi_campaign_rules")
      .select("campaign_id, rule_type, params")
      .eq("tenant_id", tenantId)
      .in("campaign_id", campaignIds),
  ]);

  const targetsByCampaign = new Map<string, TargetRow[]>();
  (targets ?? []).forEach((t) => {
    const k = t.campaign_id as string;
    const arr = targetsByCampaign.get(k) ?? [];
    arr.push(t as TargetRow);
    targetsByCampaign.set(k, arr);
  });

  const rulesByCampaign = new Map<string, RuleRow[]>();
  (rules ?? []).forEach((r) => {
    const k = r.campaign_id as string;
    const arr = rulesByCampaign.get(k) ?? [];
    arr.push(r as RuleRow);
    rulesByCampaign.set(k, arr);
  });

  const applied: AppliedCampaign[] = [];
  let totalDiscount = 0;
  let freeShipping = false;
  const gifts: Array<{ productId: string; quantity: number; campaignId: string }> = [];

  for (const camp of eligibleCampaigns) {
    // Kupon kampanyası ise kod girmiş olmalı
    if (camp.type === "coupon") {
      if (!couponCode || couponCode.trim().toUpperCase() !== (camp.coupon_code ?? "").toUpperCase()) {
        continue;
      }
    }

    // Hedefleme kontrolü
    const camp_targets = targetsByCampaign.get(camp.id) ?? [];
    if (camp_targets.length === 0) continue;

    let matchesTarget = false;
    for (const t of camp_targets) {
      if (t.target_type === "all") {
        matchesTarget = true;
        break;
      }
      if (t.target_type === "segment" && t.target_value === dealerSegment) {
        matchesTarget = true;
        break;
      }
      if (t.target_type === "region" && t.target_value === dealerRegion) {
        matchesTarget = true;
        break;
      }
      if (t.target_type === "dealer" && t.target_value === dealerId) {
        matchesTarget = true;
        break;
      }
    }
    if (!matchesTarget) continue;

    // Kural(lar)ı uygula
    const camp_rules = rulesByCampaign.get(camp.id) ?? [];
    for (const rule of camp_rules) {
      const result = applyRule(rule, cart, subtotal);
      if (result.discount > 0 || result.gift || result.freeShipping) {
        applied.push({
          campaignId: camp.id,
          campaignName: camp.title,
          type: camp.type ?? rule.rule_type,
          discountAmount: result.discount,
          giftProductId: result.gift?.productId ?? null,
          giftQuantity: result.gift?.quantity ?? null,
          freeShipping: result.freeShipping,
          affectedLines: result.affectedLines,
          note: result.note,
        });
        totalDiscount += result.discount;
        if (result.freeShipping) freeShipping = true;
        if (result.gift) {
          gifts.push({
            productId: result.gift.productId,
            quantity: result.gift.quantity,
            campaignId: camp.id,
          });
        }
      }
    }
  }

  return {
    appliedCampaigns: applied,
    totalDiscount: +totalDiscount.toFixed(2),
    freeShipping,
    gifts,
    subtotal,
    finalTotal: +(subtotal - totalDiscount).toFixed(2),
  };
}

interface RuleApplyResult {
  discount: number;
  affectedLines: string[];
  note: string;
  gift?: { productId: string; quantity: number };
  freeShipping?: boolean;
}

function applyRule(rule: RuleRow, cart: CartLine[], subtotal: number): RuleApplyResult {
  const p = rule.params || {};

  if (rule.rule_type === "percent_discount" || rule.rule_type === "coupon") {
    const percent = Number(p.discount_percent ?? 0);
    if (percent <= 0) return empty();
    const appliesTo = (p.applies_to as string) || "all";
    let target = cart;
    if (appliesTo.startsWith("category:")) {
      const catId = appliesTo.split(":")[1];
      target = cart.filter((l) => l.categoryId === catId);
    } else if (appliesTo.startsWith("product:")) {
      const pid = appliesTo.split(":")[1];
      target = cart.filter((l) => l.productId === pid);
    }
    const sum = target.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const discount = +(sum * (percent / 100)).toFixed(2);
    return {
      discount,
      affectedLines: target.map((l) => l.productId),
      note: `%${percent} ${appliesTo === "all" ? "tüm sepete" : "seçili ürünlere"}`,
    };
  }

  if (rule.rule_type === "volume_discount") {
    const buy = Number(p.buy ?? 0);
    const free = Number(p.free ?? 0);
    if (buy <= 0 || free <= 0) return empty();
    const appliesTo = (p.applies_to as string) || "";
    if (!appliesTo.startsWith("product:")) return empty();
    const pid = appliesTo.split(":")[1];
    const line = cart.find((l) => l.productId === pid);
    if (!line) return empty();
    // Her "buy" miktarı için "free" adet bedava (toplam fiyat üzerinden)
    const cycles = Math.floor(line.quantity / (buy + free));
    const freebies = cycles * free;
    if (freebies <= 0) return empty();
    const discount = +(freebies * line.unitPrice).toFixed(2);
    return {
      discount,
      affectedLines: [pid],
      note: `Her ${buy + free} adetten ${free} bedava → ${freebies} adet bedava`,
    };
  }

  if (rule.rule_type === "gift_product") {
    const minTotal = Number(p.min_total ?? 0);
    const giftId = (p.gift_product_id as string) || "";
    const giftQty = Number(p.gift_quantity ?? 1);
    if (!giftId || subtotal < minTotal) return empty();
    return {
      discount: 0,
      affectedLines: [],
      note: `Hediye: ${giftQty} × ürün ${giftId.slice(0, 8)}`,
      gift: { productId: giftId, quantity: giftQty },
    };
  }

  if (rule.rule_type === "free_shipping") {
    const minTotal = Number(p.min_total ?? 0);
    if (subtotal < minTotal) return empty();
    return {
      discount: 0,
      affectedLines: [],
      note: `Ücretsiz kargo (₺${minTotal}+ sipariş)`,
      freeShipping: true,
    };
  }

  return empty();
}

function empty(): RuleApplyResult {
  return { discount: 0, affectedLines: [], note: "" };
}
