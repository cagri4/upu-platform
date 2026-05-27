/**
 * Restoran POS Provider — abstrak interface (Butlaroo paterni V2 hazırlık).
 *
 * MVP: Sadece NoopPOSProvider (DB'ye yazar, dış sistem çağırmaz).
 * V2: LightspeedPOSProvider, UntillPOSProvider, MplusPOSProvider, OracleMicrosPOSProvider.
 *
 * Çağrı yapısı (Çağrı resmi tanımı):
 *   "Tekrar eden iş süreçlerini DEVRALAN, AI API destekli web uygulaması"
 *
 * POS entegrasyonu = restoran'ın mevcut kasası ile UPU sipariş akışını köprüleyen
 * adaptör. UPU public B2C sitesinden gelen sipariş restoran'ın gerçek POS'una
 * itilir (kitchen ticket print + günlük raporlama tutarlı kalır).
 *
 * Hangi provider kullanılacağı rst_restaurants.pos_provider kolonu ile
 * belirlenir (V2 eklenecek). Provider config'i rst_restaurants.pos_config jsonb
 * içinde tutulur (API key, location ID vs.).
 *
 * Mock vs gerçek:
 *   - MVP demo: `noop` — Provider çağrıları silently no-op (sadece log)
 *   - V2 gerçek: API key + sertifika ile gerçek POS'a push
 *
 * Public satış sayfasında "Lightspeed, unTill, MplusKASSA entegrasyonu var"
 * mesajı verilebilir — ama gerçek devreye alma için manuel onboarding.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface POSOrder {
  id: string;                          // rst_b2c_orders.id
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryType: "delivery" | "pickup" | "dine_in";
  tableId: string | null;
  items: Array<{
    menuItemId: string;
    name: string;
    variantName: string | null;
    addons: Array<{ name: string; price: number }>;
    quantity: number;
    unitPrice: number;
    total: number;
    notes: string | null;
  }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
}

export interface POSMenuPullResult {
  success: boolean;
  itemCount: number;
  errors: string[];
}

export interface POSTableSyncResult {
  success: boolean;
  errors: string[];
}

export interface POSProvider {
  /** Provider tanımlayıcı (config seçimi için) */
  readonly name: "noop" | "lightspeed" | "untill" | "mplus" | "oracle_micros" | "bork";

  /** Provider hazır mı? Config OK + API erişimi? */
  isReady(): Promise<boolean>;

  /**
   * Yeni B2C sipariş geldiğinde POS'a it.
   * - noop: log + DB'ye sync state yaz
   * - gerçek: HTTP POST POS API'sine ticket
   */
  pushOrder(order: POSOrder): Promise<{ posOrderId?: string; success: boolean; error?: string }>;

  /**
   * POS'tan menü çek (V2).
   * - noop: no-op
   * - gerçek: GET menu items, rst_menu_items'a upsert (manual mode)
   */
  pullMenu?(restaurantId: string): Promise<POSMenuPullResult>;

  /**
   * Masa durumu senkronizasyonu (V2).
   * - noop: no-op
   * - gerçek: rst_tables status değişikliğini POS'a bildir
   */
  syncTable?(args: { tableId: string; status: string }): Promise<POSTableSyncResult>;
}

// ──────────────────────────────────────────────────────────────────────────
// NoopPOSProvider — MVP default
// ──────────────────────────────────────────────────────────────────────────

export class NoopPOSProvider implements POSProvider {
  readonly name = "noop" as const;

  constructor(private supabase?: SupabaseClient) { /* opsiyonel */ }

  async isReady(): Promise<boolean> {
    return true;
  }

  async pushOrder(order: POSOrder): Promise<{ posOrderId?: string; success: boolean }> {
    // Sessiz no-op — log için console.info
    console.info("[POS:noop] pushOrder", { id: order.id, total: order.total });
    return { success: true };
  }

  async pullMenu(_restaurantId: string): Promise<POSMenuPullResult> {
    return { success: true, itemCount: 0, errors: [] };
  }

  async syncTable(_args: { tableId: string; status: string }): Promise<POSTableSyncResult> {
    return { success: true, errors: [] };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Provider factory — V2'de DB'den seçilen provider'ı resolve eder
// ──────────────────────────────────────────────────────────────────────────

export function getPOSProvider(
  name: POSProvider["name"] = "noop",
  supabase?: SupabaseClient,
): POSProvider {
  switch (name) {
    case "noop":
      return new NoopPOSProvider(supabase);
    case "lightspeed":
    case "untill":
    case "mplus":
    case "oracle_micros":
    case "bork":
      // V2: gerçek provider'lar eklenecek. Şimdilik noop fallback (uyarı log)
      console.warn(`[POS] ${name} provider henüz implement edilmedi, noop fallback.`);
      return new NoopPOSProvider(supabase);
    default:
      return new NoopPOSProvider(supabase);
  }
}
