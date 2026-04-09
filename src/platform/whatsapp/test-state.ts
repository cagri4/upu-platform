/**
 * Test State Management — /kaydet, /yukle, /sifirla
 *
 * Dev workflow accelerator. Admin-only commands that let us snapshot a
 * test user's state and roll back to it after fixing bugs, instead of
 * tearing down and rebuilding the account from scratch every cycle.
 *
 * Save/load scope:
 *   - Platform user tables (missions, streaks, daily tasks, favorites, onboarding)
 *   - Tenant-specific feature tables (emlak_*, bayi_*, ...)
 *   - profiles.metadata (onboarding office/location, etc.)
 *
 * Explicitly NOT in scope (audit logs, shared content, system state):
 *   - bot_activity, platform_events — audit trails
 *   - platform_missions — shared content
 *   - command_sessions — cleared on load to avoid mid-flow pollution
 *   - tenants, invite_codes, subscriptions — system tables
 */
import type { WaContext } from "./types";
import { sendText, sendButtons } from "./send";
import { getServiceClient } from "@/platform/auth/supabase";
import { isAdmin } from "@/platform/admin/commands";

// ── Table lists ─────────────────────────────────────────────────────

const PLATFORM_TABLES = [
  "user_mission_progress",
  "user_streaks",
  "user_daily_tasks",
  "user_performance",
  "user_favorites",
  "onboarding_state",
];

const TENANT_TABLES: Record<string, string[]> = {
  emlak: [
    "emlak_properties",
    "emlak_customers",
    "emlak_presentations",
    "emlak_property_photos",
    "emlak_monitoring_criteria",
    "emlak_publishing_history",
  ],
  bayi: [
    "bayi_products",
    "bayi_orders",
    "bayi_order_items",
    "bayi_dealers",
    "bayi_dealer_invoices",
    "bayi_dealer_transactions",
    "bayi_dealer_visits",
    "bayi_collection_activities",
    "bayi_purchase_orders",
    "bayi_sales_targets",
    "bayi_campaigns",
    "bayi_invite_links",
  ],
  // Other tenants added as their gamification/tests come online
  muhasebe: [],
  otel: [],
  market: [],
  siteyonetim: [],
};

function getTables(tenantKey: string): string[] {
  return [...PLATFORM_TABLES, ...(TENANT_TABLES[tenantKey] || [])];
}

// ── Core save/load/reset ────────────────────────────────────────────

interface Snapshot {
  saved_at: string;
  tenant_key: string;
  tables: Record<string, unknown[]>;
  profile_metadata: Record<string, unknown> | null;
}

async function captureSnapshot(userId: string, tenantKey: string): Promise<Snapshot> {
  const supabase = getServiceClient();
  const snapshot: Snapshot = {
    saved_at: new Date().toISOString(),
    tenant_key: tenantKey,
    tables: {},
    profile_metadata: null,
  };

  for (const table of getTables(tenantKey)) {
    try {
      const { data, error } = await supabase.from(table).select("*").eq("user_id", userId);
      if (error) {
        // Table doesn't have user_id column or doesn't exist — skip silently
        continue;
      }
      snapshot.tables[table] = data || [];
    } catch {
      // Skip unreachable tables
    }
  }

  // Capture profile metadata
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();
  snapshot.profile_metadata = (profile?.metadata as Record<string, unknown>) || {};

  return snapshot;
}

async function restoreSnapshot(userId: string, tenantKey: string, snapshot: Snapshot): Promise<void> {
  const supabase = getServiceClient();
  const tables = getTables(tenantKey);

  // Step 1: Delete current user-scoped rows in all target tables.
  // We delete even the ones not in snapshot so the restore is a clean overwrite.
  for (const table of tables) {
    try {
      await supabase.from(table).delete().eq("user_id", userId);
    } catch {
      // Table missing user_id column — nothing to clean
    }
  }

  // Step 2: Clear any active command session (mid-flow pollution)
  try {
    await supabase.from("command_sessions").delete().eq("user_id", userId);
  } catch { /* ignore */ }

  // Step 3: Insert snapshot rows back, preserving UUIDs for referential integrity.
  for (const table of tables) {
    const rows = snapshot.tables[table];
    if (!rows || rows.length === 0) continue;
    try {
      await supabase.from(table).insert(rows);
    } catch (err) {
      console.error(`[test-state] restore insert failed for ${table}:`, err);
    }
  }

  // Step 4: Restore profile metadata
  if (snapshot.profile_metadata) {
    await supabase
      .from("profiles")
      .update({ metadata: snapshot.profile_metadata })
      .eq("id", userId);
  }
}

async function wipeAllState(userId: string, tenantKey: string): Promise<void> {
  const supabase = getServiceClient();
  const tables = getTables(tenantKey);

  for (const table of tables) {
    try {
      await supabase.from(table).delete().eq("user_id", userId);
    } catch { /* ignore */ }
  }

  // Clear session, metadata, and any saved snapshot
  try {
    await supabase.from("command_sessions").delete().eq("user_id", userId);
  } catch { /* ignore */ }

  try {
    await supabase.from("user_test_snapshots").delete().eq("user_id", userId);
  } catch { /* ignore */ }

  await supabase.from("profiles").update({ metadata: {} }).eq("id", userId);
}

// ── Command handlers ────────────────────────────────────────────────

export async function handleKaydet(ctx: WaContext): Promise<void> {
  if (!(await isAdmin(ctx))) {
    await sendText(ctx.phone, "Bu komut sadece admin kullancılar içindir.");
    return;
  }

  try {
    const snapshot = await captureSnapshot(ctx.userId, ctx.tenantKey);
    const supabase = getServiceClient();

    await supabase.from("user_test_snapshots").upsert({
      user_id: ctx.userId,
      tenant_key: ctx.tenantKey,
      data: snapshot,
      saved_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    // Build summary counts
    const counts = Object.entries(snapshot.tables)
      .filter(([, rows]) => rows.length > 0)
      .map(([table, rows]) => `  ${table}: ${rows.length}`)
      .join("\n");

    let msg = "✅ *Kayıt alındı*\n\n";
    msg += `📦 Snapshot: ${Object.keys(snapshot.tables).length} tablo tarandı\n`;
    if (counts) msg += `\n${counts}\n`;
    msg += `\n_/yukle ile geri dönebilirsin._`;

    await sendText(ctx.phone, msg);
  } catch (err) {
    console.error("[test-state:kaydet]", err);
    await sendText(ctx.phone, "❌ Kayıt başarısız. Logları kontrol et.");
  }
}

export async function handleYukle(ctx: WaContext): Promise<void> {
  if (!(await isAdmin(ctx))) {
    await sendText(ctx.phone, "Bu komut sadece admin kullancılar içindir.");
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: row } = await supabase
      .from("user_test_snapshots")
      .select("data, saved_at, tenant_key")
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (!row) {
      await sendText(ctx.phone, "❌ Kayıtlı snapshot bulunamadı. Önce */kaydet* kullan.");
      return;
    }

    const snapshot = row.data as Snapshot;

    if (snapshot.tenant_key && snapshot.tenant_key !== ctx.tenantKey) {
      await sendText(
        ctx.phone,
        `⚠️ Snapshot farklı bir SaaS'tan (${snapshot.tenant_key}). Yükleme iptal edildi.\n\nFarklı SaaS'ta kaydını almak istersen o SaaS'a geçip yeniden /kaydet yap.`,
      );
      return;
    }

    await restoreSnapshot(ctx.userId, ctx.tenantKey, snapshot);

    const savedAgo = Math.round((Date.now() - new Date(row.saved_at).getTime()) / 60000);
    await sendButtons(
      ctx.phone,
      `✅ *Kayıtlı duruma geri döndün*\n\n📦 ${savedAgo} dakika önceki snapshot yüklendi\n🧹 Aktif form iptal edildi\n\nMenüden devam edebilirsin.`,
      [{ id: "cmd:menu", title: "📋 Ana Menü" }],
    );
  } catch (err) {
    console.error("[test-state:yukle]", err);
    await sendText(ctx.phone, "❌ Yükleme başarısız. Logları kontrol et.");
  }
}

export async function handleSifirla(ctx: WaContext): Promise<void> {
  if (!(await isAdmin(ctx))) {
    await sendText(ctx.phone, "Bu komut sadece admin kullancılar içindir.");
    return;
  }

  await sendButtons(
    ctx.phone,
    "⚠️ *DİKKAT*\n\nBu komut tüm verilerini SİLECEK:\n• Mülkler, müşteriler, sunumlar\n• Mission state, streak, tasks\n• Onboarding kaydı\n• Kaydedilmiş snapshot\n\nProfilin (telefon, hesap) duruyor ama onboarding sıfırdan başlayacak.\n\nEmin misin?",
    [
      { id: "sifirla:confirm", title: "🗑 Evet, sil" },
      { id: "cmd:menu", title: "İptal" },
    ],
  );
}

export async function handleSifirlaCallback(ctx: WaContext, data: string): Promise<void> {
  if (data !== "sifirla:confirm") return;

  if (!(await isAdmin(ctx))) {
    await sendText(ctx.phone, "Bu komut sadece admin kullancılar içindir.");
    return;
  }

  try {
    await wipeAllState(ctx.userId, ctx.tenantKey);
    await sendText(ctx.phone, "✅ *Tüm verilerin silindi*\n\nOnboarding yeniden başlıyor...");

    // Re-init onboarding
    const { initOnboarding, getOnboardingFlow, sendOnboardingStep } = await import("./onboarding");
    await initOnboarding(ctx.userId, ctx.tenantId, ctx.tenantKey);

    const flow = getOnboardingFlow(ctx.tenantKey);
    if (flow && flow.steps.length > 0) {
      const state = {
        user_id: ctx.userId,
        tenant_key: ctx.tenantKey,
        current_step: flow.steps[0].key,
        business_info: {},
        completed_at: null,
      };
      await sendOnboardingStep(ctx, state);
    } else {
      await sendButtons(ctx.phone, "Hazır. Menüye git.", [
        { id: "cmd:menu", title: "📋 Ana Menü" },
      ]);
    }
  } catch (err) {
    console.error("[test-state:sifirla]", err);
    await sendText(ctx.phone, "❌ Sıfırlama başarısız. Logları kontrol et.");
  }
}

// ── Router entry point ──────────────────────────────────────────────

export function isTestStateCommand(lower: string): boolean {
  return lower === "kaydet" || lower === "yukle" || lower === "yükle" || lower === "sifirla" || lower === "sıfırla";
}

export async function routeTestStateCommand(ctx: WaContext, lower: string): Promise<void> {
  if (lower === "kaydet") return handleKaydet(ctx);
  if (lower === "yukle" || lower === "yükle") return handleYukle(ctx);
  if (lower === "sifirla" || lower === "sıfırla") return handleSifirla(ctx);
}
