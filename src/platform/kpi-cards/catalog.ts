/**
 * KPI cards client catalog — Lucide ikon ve href üreticiler.
 *
 * Panel ana sayfası ve gelecekte ItemAddModal listesi bu objeyi tüketir.
 */

import {
  Building2,
  Users,
  FileText,
  Target,
  Presentation,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import type { KpiCardKey } from "./keys";

export interface KpiCardDef {
  key: KpiCardKey;
  label: string;
  Icon: LucideIcon;
  hrefFor: (token: string) => string;
}

const q = (path: string, t: string) =>
  t ? `${path}?t=${encodeURIComponent(t)}` : path;

export const KPI_CARDS: Record<KpiCardKey, KpiCardDef> = {
  properties: {
    key: "properties",
    label: "Mülklerim",
    Icon: Building2,
    hrefFor: (t) => q("/tr/mulklerim", t),
  },
  customers: {
    key: "customers",
    label: "Müşterilerim",
    Icon: Users,
    hrefFor: (t) => q("/tr/musterilerim", t),
  },
  contracts: {
    key: "contracts",
    label: "Sözleşmeler",
    Icon: FileText,
    hrefFor: (t) => q("/tr/sozlesmelerim", t),
  },
  tracking: {
    key: "tracking",
    label: "Takiplerim",
    Icon: Target,
    hrefFor: (t) => q("/tr/takip", t),
  },
  presentations: {
    key: "presentations",
    label: "Sunumlarım",
    Icon: Presentation,
    hrefFor: (t) => q("/tr/sunumlarim", t),
  },
  calendar: {
    key: "calendar",
    label: "Takvim",
    Icon: Calendar,
    hrefFor: (t) => q("/tr/takvim", t),
  },
};
