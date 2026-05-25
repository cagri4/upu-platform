/**
 * Otel KPI card client catalog — Lucide ikon + label + href üreticiler.
 *
 * Otel panel ana sayfası + in-place edit modal bu objeyi tüketir.
 */

import {
  BarChart3,
  Calendar,
  LogIn,
  LogOut,
  TrendingUp,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { OtelKpiCardKey } from "./otel-keys";

export interface OtelKpiCardDef {
  key: OtelKpiCardKey;
  label: string;
  Icon: LucideIcon;
  /** Format hint — "pct" % işaretli, "currency" TRY, "count" düz sayı. */
  format?: "pct" | "currency" | "count";
  hrefFor: (token: string) => string;
}

const qs = (t: string) => (t ? `?t=${encodeURIComponent(t)}` : "");

export const OTEL_KPI_CARDS: Record<OtelKpiCardKey, OtelKpiCardDef> = {
  occupancy_pct: {
    key: "occupancy_pct",
    label: "Bugün Doluluk",
    Icon: BarChart3,
    format: "pct",
    hrefFor: (t) => `/tr/otel-odalar${qs(t)}`,
  },
  reservations_week: {
    key: "reservations_week",
    label: "Bu Hafta Rezervasyon",
    Icon: Calendar,
    format: "count",
    hrefFor: (t) => `/tr/otel-rezervasyonlar${qs(t)}`,
  },
  today_checkin: {
    key: "today_checkin",
    label: "Bugün Çek-in",
    Icon: LogIn,
    format: "count",
    hrefFor: (t) => `/tr/otel-rezervasyonlar${qs(t)}`,
  },
  today_checkout: {
    key: "today_checkout",
    label: "Bugün Çek-out",
    Icon: LogOut,
    format: "count",
    hrefFor: (t) => `/tr/otel-rezervasyonlar${qs(t)}`,
  },
  monthly_revenue: {
    key: "monthly_revenue",
    label: "Bu Ay Gelir",
    Icon: TrendingUp,
    format: "currency",
    hrefFor: (t) => `/tr/otel-rezervasyonlar${qs(t)}`,
  },
  precheckin_pending: {
    key: "precheckin_pending",
    label: "Online Çek-in Eksik",
    Icon: ClipboardList,
    format: "count",
    hrefFor: (t) => `/tr/otel-rezervasyonlar${qs(t)}`,
  },
};
