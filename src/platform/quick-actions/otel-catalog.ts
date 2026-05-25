/**
 * Otel Hızlı İşlem client catalog — Lucide ikon + href üreticiler.
 *
 * Otel panel ana sayfası + customize sayfası bu objeyi tüketir. Bayi/emlak
 * `catalog.ts` ile paritetik.
 */

import {
  BedDouble,
  Users,
  DoorClosed,
  CalendarDays,
  CreditCard,
  MessageSquare,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { OtelQuickActionKey } from "./otel-keys";

export interface OtelQuickActionDef {
  key: OtelQuickActionKey;
  label: string;
  Icon: LucideIcon;
  hrefFor: (token: string) => string;
}

const qs = (t: string) => (t ? `?t=${encodeURIComponent(t)}` : "");

export const OTEL_QUICK_ACTIONS: Record<OtelQuickActionKey, OtelQuickActionDef> = {
  rezervasyonlar: {
    key: "rezervasyonlar",
    label: "Rezervasyonlar",
    Icon: BedDouble,
    hrefFor: (t) => `/tr/otel-rezervasyonlar${qs(t)}`,
  },
  konuklar: {
    key: "konuklar",
    label: "Müşteriler",
    Icon: Users,
    hrefFor: (t) => `/tr/otel-konuklar${qs(t)}`,
  },
  odalar: {
    key: "odalar",
    label: "Odalar",
    Icon: DoorClosed,
    hrefFor: (t) => `/tr/otel-odalar${qs(t)}`,
  },
  takvim: {
    key: "takvim",
    label: "Takvim",
    Icon: CalendarDays,
    hrefFor: (t) => `/tr/otel-takvim${qs(t)}`,
  },
  odemeler: {
    key: "odemeler",
    label: "Ödemeler",
    Icon: CreditCard,
    hrefFor: (t) => `/tr/otel-odemeler${qs(t)}`,
  },
  mesajlar: {
    key: "mesajlar",
    label: "Mesajlar",
    Icon: MessageSquare,
    hrefFor: (t) => `/tr/otel-mesajlar${qs(t)}`,
  },
  calisan_davet: {
    key: "calisan_davet",
    label: "Çalışan Davet",
    Icon: UserPlus,
    hrefFor: (t) => `/tr/otel-calisan-davet${qs(t)}`,
  },
};
