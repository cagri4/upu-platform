/**
 * Site KPI card client catalog — Lucide ikon + label + href üreticiler.
 *
 * Site panel ana sayfası + in-place edit modal bu objeyi tüketir.
 */

import {
  Wallet,
  Wrench,
  Users,
  TrendingUp,
  Home,
  AlertTriangle,
  Percent,
  type LucideIcon,
} from "lucide-react";
import type { SiteKpiCardKey } from "./site-keys";

export interface SiteKpiCardDef {
  key: SiteKpiCardKey;
  label: string;
  Icon: LucideIcon;
  /** TRY currency formatlama gerekiyorsa true. */
  currency?: boolean;
  /** Yüzde işareti gerekiyorsa true (ör. doluluk oranı). */
  percent?: boolean;
  hrefFor: (token: string) => string;
}

const qs = (t: string) => (t ? `?t=${encodeURIComponent(t)}` : "");

export const SITE_KPI_CARDS: Record<SiteKpiCardKey, SiteKpiCardDef> = {
  payment_due_units: {
    key: "payment_due_units",
    label: "Ödenmemiş Aidat",
    Icon: Wallet,
    hrefFor: (t) => `/tr/site-aidat${qs(t)}`,
  },
  open_complaints: {
    key: "open_complaints",
    label: "Açık Talep",
    Icon: Wrench,
    hrefFor: (t) => `/tr/site-talepler${qs(t)}`,
  },
  active_residents: {
    key: "active_residents",
    label: "Aktif Sakin",
    Icon: Users,
    hrefFor: (t) => `/tr/site-sakinlerim${qs(t)}`,
  },
  monthly_dues_collected: {
    key: "monthly_dues_collected",
    label: "Bu Ay Tahsilat",
    Icon: TrendingUp,
    currency: true,
    hrefFor: (t) => `/tr/site-aidat${qs(t)}`,
  },
  total_units: {
    key: "total_units",
    label: "Toplam Daire",
    Icon: Home,
    hrefFor: (t) => `/tr/site-sakinlerim${qs(t)}`,
  },
  overdue_amount: {
    key: "overdue_amount",
    label: "Toplam Borç",
    Icon: AlertTriangle,
    currency: true,
    hrefFor: (t) => `/tr/site-aidat${qs(t)}`,
  },
  occupancy_rate: {
    key: "occupancy_rate",
    label: "Doluluk Oranı",
    Icon: Percent,
    percent: true,
    hrefFor: (t) => `/tr/site-sakinlerim${qs(t)}`,
  },
};
