/**
 * Logo Tiger sync orchestrator — Faz 3 Sprint J.
 *
 * 4 entity için Logo → UPU pull:
 *   - products  → bayi_products (upsert by code)
 *   - stock     → bayi_products.stock_quantity (update only)
 *   - prices    → bayi_price_lists + bayi_price_list_items (upsert)
 *   - dealers   → bayi_dealers (upsert by company_name veya tax_no)
 *
 * Idempotent: aynı kod tekrar gelirse update, yoksa insert.
 * Mock akış: client.ts mock data döner → DB'ye gerçek INSERT yapılır
 * (dağıtıcı UI'da "Logo'dan geldi" örneği görsün).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordSyncResult } from "@/platform/integrations/tenant-settings";
import {
  fetchDealers,
  fetchPrices,
  fetchProducts,
  fetchStock,
} from "./client";
import type { SyncEntity, SyncRunResult, SyncStats } from "./types";

async function syncProducts(
  sb: SupabaseClient,
  tenantId: string,
): Promise<SyncStats> {
  const start = Date.now();
  const stats: SyncStats = {
    entity: "products",
    fetched: 0,
    upserted: 0,
    skipped: 0,
    errors: 0,
    mocked: false,
    durationMs: 0,
  };
  try {
    const { items, mocked } = await fetchProducts(sb, tenantId);
    stats.mocked = mocked;
    stats.fetched = items.length;

    // Kategori cache (name → id), gelmemişse oluştur
    const { data: cats } = await sb
      .from("bayi_categories")
      .select("id, name")
      .eq("tenant_id", tenantId);
    const catMap = new Map<string, string>();
    (cats ?? []).forEach((c) => {
      const key = ((c.name as string) || "").toLowerCase().trim();
      if (key) catMap.set(key, c.id as string);
    });

    for (const p of items) {
      let categoryId: string | null = null;
      if (p.categoryName) {
        const key = p.categoryName.toLowerCase().trim();
        const cached = catMap.get(key);
        if (cached) {
          categoryId = cached;
        } else {
          const { data: created } = await sb
            .from("bayi_categories")
            .insert({
              tenant_id: tenantId,
              name: p.categoryName,
              is_active: true,
            })
            .select("id")
            .single();
          if (created) {
            categoryId = created.id as string;
            catMap.set(key, categoryId);
          }
        }
      }

      // Var mı kontrol — code + tenant unique
      const { data: existing } = await sb
        .from("bayi_products")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("code", p.code)
        .maybeSingle();

      const payload = {
        name: p.name,
        description: p.description,
        barcode: p.barcode,
        brand: p.brand,
        unit: p.unit,
        base_price: p.basePrice,
        category_id: categoryId,
        is_active: true,
      };

      if (existing) {
        await sb
          .from("bayi_products")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId)
          .eq("id", existing.id);
      } else {
        const { error } = await sb.from("bayi_products").insert({
          tenant_id: tenantId,
          code: p.code,
          ...payload,
        });
        if (error) {
          stats.errors++;
          continue;
        }
      }
      stats.upserted++;
    }
  } catch (err) {
    console.error("[logo:sync:products]", err);
    stats.errors++;
  }
  stats.durationMs = Date.now() - start;
  return stats;
}

async function syncStock(sb: SupabaseClient, tenantId: string): Promise<SyncStats> {
  const start = Date.now();
  const stats: SyncStats = {
    entity: "stock",
    fetched: 0,
    upserted: 0,
    skipped: 0,
    errors: 0,
    mocked: false,
    durationMs: 0,
  };
  try {
    const { items, mocked } = await fetchStock(sb, tenantId);
    stats.mocked = mocked;
    stats.fetched = items.length;

    // Aynı productCode birden çok depoda olabilir → topla
    const totals = new Map<string, number>();
    for (const s of items) {
      totals.set(
        s.productCode,
        (totals.get(s.productCode) ?? 0) + Number(s.quantity ?? 0),
      );
    }

    for (const [code, qty] of totals.entries()) {
      const { data: prod } = await sb
        .from("bayi_products")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("code", code)
        .maybeSingle();
      if (!prod) {
        stats.skipped++;
        continue;
      }
      await sb
        .from("bayi_products")
        .update({
          stock_quantity: Math.floor(qty),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("id", prod.id);
      stats.upserted++;
    }
  } catch (err) {
    console.error("[logo:sync:stock]", err);
    stats.errors++;
  }
  stats.durationMs = Date.now() - start;
  return stats;
}

async function syncPrices(sb: SupabaseClient, tenantId: string): Promise<SyncStats> {
  const start = Date.now();
  const stats: SyncStats = {
    entity: "prices",
    fetched: 0,
    upserted: 0,
    skipped: 0,
    errors: 0,
    mocked: false,
    durationMs: 0,
  };
  try {
    const { items, mocked } = await fetchPrices(sb, tenantId);
    stats.mocked = mocked;
    stats.fetched = items.length;

    // Liste başlıklarını topla (code → name)
    const lists = new Map<string, string>();
    for (const it of items) {
      if (!lists.has(it.priceListCode)) {
        lists.set(it.priceListCode, it.priceListName);
      }
    }

    // Her liste için bayi_price_lists upsert (notes alanına logo code yaz)
    const listIdByCode = new Map<string, string>();
    for (const [code, name] of lists.entries()) {
      const { data: existing } = await sb
        .from("bayi_price_lists")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", name)
        .maybeSingle();
      if (existing) {
        listIdByCode.set(code, existing.id as string);
      } else {
        const { data: created, error } = await sb
          .from("bayi_price_lists")
          .insert({
            tenant_id: tenantId,
            name,
            description: `Logo Tiger: ${code}`,
            currency: "TRY",
            is_active: true,
          })
          .select("id")
          .single();
        if (error || !created) {
          stats.errors++;
          continue;
        }
        listIdByCode.set(code, created.id as string);
      }
    }

    // Item'ları upsert
    for (const it of items) {
      const listId = listIdByCode.get(it.priceListCode);
      if (!listId) {
        stats.skipped++;
        continue;
      }
      const { data: prod } = await sb
        .from("bayi_products")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("code", it.productCode)
        .maybeSingle();
      if (!prod) {
        stats.skipped++;
        continue;
      }
      const { error } = await sb.from("bayi_price_list_items").upsert(
        {
          tenant_id: tenantId,
          price_list_id: listId,
          product_id: prod.id,
          unit_price: it.unitPrice,
          currency: it.currency || "TRY",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "price_list_id,product_id" },
      );
      if (error) {
        stats.errors++;
      } else {
        stats.upserted++;
      }
    }
  } catch (err) {
    console.error("[logo:sync:prices]", err);
    stats.errors++;
  }
  stats.durationMs = Date.now() - start;
  return stats;
}

async function syncDealers(sb: SupabaseClient, tenantId: string): Promise<SyncStats> {
  const start = Date.now();
  const stats: SyncStats = {
    entity: "dealers",
    fetched: 0,
    upserted: 0,
    skipped: 0,
    errors: 0,
    mocked: false,
    durationMs: 0,
  };
  try {
    const { items, mocked } = await fetchDealers(sb, tenantId);
    stats.mocked = mocked;
    stats.fetched = items.length;

    for (const d of items) {
      // tax_no öncelikli match, yoksa name
      let query = sb
        .from("bayi_dealers")
        .select("id")
        .eq("tenant_id", tenantId);
      if (d.taxNumber) {
        query = query.or(`tax_no.eq.${d.taxNumber},tax_number.eq.${d.taxNumber}`);
      } else {
        query = query.eq("company_name", d.name);
      }
      const { data: existing } = await query.limit(1).maybeSingle();

      const payload = {
        name: d.name,
        company_name: d.name,
        tax_no: d.taxNumber,
        tax_number: d.taxNumber,
        tax_office: d.taxOffice,
        address: d.address,
        city: d.city,
        phone: d.phone,
        email: d.email,
        credit_limit: d.creditLimit,
        payment_term_days: d.paymentTermDays,
        is_active: true,
        status: "active",
      };

      if (existing) {
        await sb
          .from("bayi_dealers")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId)
          .eq("id", existing.id);
      } else {
        // Email zorunlu görünüyor (NOT NULL); yoksa code'dan üret
        const email = d.email || `${d.code.replace(/\W+/g, "-")}@logo.import`;
        const { error } = await sb.from("bayi_dealers").insert({
          tenant_id: tenantId,
          ...payload,
          email,
        });
        if (error) {
          stats.errors++;
          continue;
        }
      }
      stats.upserted++;
    }
  } catch (err) {
    console.error("[logo:sync:dealers]", err);
    stats.errors++;
  }
  stats.durationMs = Date.now() - start;
  return stats;
}

const SYNC_FUNCS: Record<
  SyncEntity,
  (sb: SupabaseClient, tenantId: string) => Promise<SyncStats>
> = {
  products: syncProducts,
  stock: syncStock,
  prices: syncPrices,
  dealers: syncDealers,
};

export async function runLogoSync(
  sb: SupabaseClient,
  args: { tenantId: string; entities?: SyncEntity[] },
): Promise<SyncRunResult> {
  const entities: SyncEntity[] = args.entities && args.entities.length > 0
    ? args.entities
    : ["products", "stock", "prices", "dealers"];

  const stats: SyncStats[] = [];
  let totalErrors = 0;

  for (const e of entities) {
    try {
      const s = await SYNC_FUNCS[e](sb, args.tenantId);
      stats.push(s);
      totalErrors += s.errors;
    } catch (err) {
      console.error(`[logo:sync:${e}:fatal]`, err);
      totalErrors++;
      stats.push({
        entity: e,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        errors: 1,
        mocked: false,
        durationMs: 0,
      });
    }
  }

  await recordSyncResult(sb, {
    tenantId: args.tenantId,
    provider: "logo_tiger",
    status: totalErrors === 0 ? "ok" : "error",
    errorMessage: totalErrors > 0 ? `${totalErrors} entity error` : undefined,
  });

  return { ok: totalErrors === 0, stats };
}
