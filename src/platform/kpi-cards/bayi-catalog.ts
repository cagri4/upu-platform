/**
 * Bayi KPI card client catalog — Lucide ikon + label + href üreticiler.
 *
 * Bayi panel ana sayfası + in-place edit modal bu objeyi tüketir.
 */

import {
  Building2,
  ClipboardList,
  TrendingDown,
  TrendingUp,
  PackageX,
  Mail,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import type { BayiKpiCardKey } from "./bayi-keys";

export interface BayiKpiCardDef {
  key: BayiKpiCardKey;
  label: string;
  Icon: LucideIcon;
  /** Currency formatlama (TRY) gerekiyorsa true; aksi takdirde sayı. */
  currency?: boolean;
  hrefFor: (token: string) => string;
}

const qs = (t: string) => (t ? `?t=${encodeURIComponent(t)}` : "");

export const BAYI_KPI_CARDS: Record<BayiKpiCardKey, BayiKpiCardDef> = {
  dealer_count: {
    key: "dealer_count",
    label: "Toplam Bayi",
    Icon: Building2,
    hrefFor: (t) => `/tr/bayiler${qs(t)}`,
  },
  active_orders: {
    key: "active_orders",
    label: "Aktif Sipariş",
    Icon: ClipboardList,
    hrefFor: (t) => `/tr/bayi-siparislerim${qs(t)}`,
  },
  overdue_amount: {
    key: "overdue_amount",
    label: "Bekleyen Tahsilat",
    Icon: TrendingDown,
    currency: true,
    hrefFor: (t) => `/tr/bayi-tahsilatlarim${qs(t)}`,
  },
  month_revenue: {
    key: "month_revenue",
    label: "Bu Ay Ciro",
    Icon: TrendingUp,
    currency: true,
    hrefFor: (t) => `/tr/bayi-raporlar${qs(t)}`,
  },
  critical_stock: {
    key: "critical_stock",
    label: "Kritik Stok",
    Icon: PackageX,
    hrefFor: (t) => `/tr/bayi-urunlerim${qs(t)}`,
  },
  active_invites: {
    key: "active_invites",
    label: "Aktif Davet",
    Icon: Mail,
    hrefFor: (t) => `/tr/bayi-davetleri${qs(t)}`,
  },
  pending_invoices: {
    key: "pending_invoices",
    label: "Ödenmemiş Fatura",
    Icon: Receipt,
    hrefFor: (t) => `/tr/bayi-tahsilatlarim${qs(t)}`,
  },
};
