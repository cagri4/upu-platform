/**
 * Logo Tiger REST client types — Faz 3 Sprint J.
 *
 * Logo'nun LogoConnect REST API'si üzerinden ürün/stok/fiyat/bayi
 * (carihesap) verilerini çekiyoruz. Tek yönlü pull (Logo → UPU).
 * İlerleyen fazlarda webhook (Logo → UPU push) veya 2-yönlü senkron
 * eklenebilir.
 */

export interface LogoProduct {
  code: string;
  name: string;
  description: string | null;
  barcode: string | null;
  brand: string | null;
  unit: string;
  basePrice: number;
  vatRate: number | null;
  categoryName: string | null;
}

export interface LogoStockSnapshot {
  productCode: string;
  warehouse: string | null;
  quantity: number;
}

export interface LogoPriceListItem {
  priceListCode: string;
  priceListName: string;
  productCode: string;
  unitPrice: number;
  currency: string;
}

export interface LogoCariHesap {
  code: string;
  name: string;
  taxNumber: string | null;
  taxOffice: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  creditLimit: number | null;
  paymentTermDays: number | null;
}

export type SyncEntity = "products" | "stock" | "prices" | "dealers";

export interface SyncStats {
  entity: SyncEntity;
  fetched: number;
  upserted: number;
  skipped: number;
  errors: number;
  mocked: boolean;
  durationMs: number;
}

export interface SyncRunResult {
  ok: boolean;
  errorMessage?: string;
  stats: SyncStats[];
}
