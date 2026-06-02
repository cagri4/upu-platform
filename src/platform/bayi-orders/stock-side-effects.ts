/**
 * Sipariş durum geçişlerinde stok rezervasyonu yan etkileri.
 *
 * confirm  → bayi_consume_order_reservations: active → consumed,
 *            bayi_products.stock_quantity decrement, movements log
 * cancel   → bayi_release_order_reservations: active → released
 * reject   → bayi_release_order_reservations: active → released
 *
 * Caller transitionOrderStatus başarılı olduktan SONRA çağırır. RPC
 * hatası kullanıcı akışını blocklamaz — log + 200 dönülür (rezervasyon
 * tutarsızlığı admin tarafında ayrı izlenir).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function consumeReservationsForOrder(
  sb: SupabaseClient,
  orderId: string,
  changedByUserId: string,
): Promise<void> {
  const { error } = await sb.rpc("bayi_consume_order_reservations", {
    p_order_id: orderId,
    p_changed_by_user_id: changedByUserId,
  });
  if (error) {
    console.error("[stock-side-effects/consume]", orderId, error);
  }
}

export async function releaseReservationsForOrder(
  sb: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { error } = await sb.rpc("bayi_release_order_reservations", {
    p_order_id: orderId,
  });
  if (error) {
    console.error("[stock-side-effects/release]", orderId, error);
  }
}
