/**
 * Kargo provider registry — adapter dispatcher.
 */
import { createKargoProvider } from "./mock-base";
import type { ShipmentProvider } from "./types";

export const arasProvider: ShipmentProvider = createKargoProvider("aras", "Aras Kargo");
export const yurticiProvider: ShipmentProvider = createKargoProvider("yurtici", "Yurtiçi Kargo");
export const mngProvider: ShipmentProvider = createKargoProvider("mng", "MNG Kargo");

export const KARGO_PROVIDERS: ShipmentProvider[] = [
  arasProvider,
  yurticiProvider,
  mngProvider,
];

export function getKargoProviderById(id: string): ShipmentProvider | null {
  return KARGO_PROVIDERS.find((p) => p.id === id) ?? null;
}
