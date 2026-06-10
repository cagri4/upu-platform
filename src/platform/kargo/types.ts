/**
 * Kargo provider adapter interface — Faz 3 Sprint I.
 *
 * Tüm adapter'lar (Aras, Yurtiçi, MNG) bu interface'i implement eder.
 * Tetikleyici (emitShipmentForOrder) tenant'ın aktif kargo provider'ını
 * çözer ve createShipment çağırır.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ShipmentBuyer {
  name: string;
  address: string;
  city: string;
  district: string | null;
  phone: string | null;
}

export interface CreateShipmentArgs {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  receiver: ShipmentBuyer;
  packageDescription: string;
  /** Toplam ağırlık kg cinsinden (yoksa null). */
  weightKg: number | null;
  /** Toplam tutar — bazı kargolar Karşı Ödemeli (PTT) için kullanır. */
  totalAmount: number;
  /** Karşı ödemeli (Cash On Delivery) mi? */
  cashOnDelivery: boolean;
}

export interface CreateShipmentResult {
  success: boolean;
  errorMessage?: string;
  carrier: string;
  trackingNo: string | null;
  trackingUrl: string | null;
  mocked: boolean;
}

export interface TrackStatusResult {
  success: boolean;
  errorMessage?: string;
  status:
    | "created"
    | "picked_up"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "returned"
    | "unknown";
  lastUpdate: string | null;
  trackingUrl: string | null;
}

export interface ShipmentProvider {
  id: string;
  label: string;
  createShipment(sb: SupabaseClient, args: CreateShipmentArgs): Promise<CreateShipmentResult>;
  trackStatus(
    sb: SupabaseClient,
    args: { tenantId: string; trackingNo: string },
  ): Promise<TrackStatusResult>;
}
