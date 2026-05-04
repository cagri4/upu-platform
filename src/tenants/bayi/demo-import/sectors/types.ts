/**
 * Sektör bazlı demo dataset ortak tipleri.
 *
 * Her sektör (boya/gida/hirdavat/tekstil/temizlik) bu interface'lere
 * uyan bir SectorDataset export eder. sectors/index.ts dispatcher
 * profile.metadata.firma_profili.sektor değerine göre uygun seti seçer.
 *
 * Currency-agnostic: tüm tutarlar numeric, UI tenant_locale'e göre render eder.
 */

export interface SectorProduct {
  name: string;
  code: string;
  category: string;
  unit: string;
  unit_price: number;
  stock_quantity: number;
  brand: string;
  vat_rate: number;
  ean: string | null;
}

export interface SectorDealer {
  name: string;
  city: string;
  country: string;
  contact_name: string;
  contact_phone: string;
  is_active: boolean;
  balance: number;
  status_note?: string;
}

export interface SectorOrder {
  dealer_index: number;
  product_index: number;
  quantity: number;
  status: "pending" | "preparing" | "shipped" | "delivered";
  days_ago: number;
}

export interface SectorInvoice {
  dealer_index: number;
  amount: number;
  is_paid: boolean;
  due_days_offset: number;
}

export interface SectorDataset {
  slug: string;
  label: string;
  categories: string[];
  products: SectorProduct[];
  dealers: SectorDealer[];
  orders: SectorOrder[];
  invoices: SectorInvoice[];
}
