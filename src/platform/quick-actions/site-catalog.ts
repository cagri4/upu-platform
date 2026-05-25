/**
 * Site Hızlı İşlem client catalog — Lucide ikon + href üreticiler.
 *
 * Site panel ana sayfası + customize sayfası bu objeyi tüketir.
 * Bayi/emlak catalog ile paritetik.
 */

import {
  Megaphone,
  Key,
  Wallet,
  Wrench,
  BarChart3,
  Users,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import type { SiteQuickActionKey } from "./site-keys";

export interface SiteQuickActionDef {
  key: SiteQuickActionKey;
  label: string;
  Icon: LucideIcon;
  hrefFor: (token: string) => string;
}

const qs = (t: string) => (t ? `?t=${encodeURIComponent(t)}` : "");

export const SITE_QUICK_ACTIONS: Record<SiteQuickActionKey, SiteQuickActionDef> = {
  duyuru_gonder: {
    key: "duyuru_gonder",
    label: "Duyuru Gönder",
    Icon: Megaphone,
    hrefFor: (t) => `/api/panel/start?cmd=duyuru&t=${encodeURIComponent(t)}`,
  },
  bina_kodu: {
    key: "bina_kodu",
    label: "Bina Kodu",
    Icon: Key,
    hrefFor: (t) => `/api/panel/start?cmd=binakodu&t=${encodeURIComponent(t)}`,
  },
  aidat_yonetim: {
    key: "aidat_yonetim",
    label: "Aidat",
    Icon: Wallet,
    hrefFor: (t) => `/tr/site-aidat${qs(t)}`,
  },
  ariza_bildir: {
    key: "ariza_bildir",
    label: "Arıza Bildir",
    Icon: Wrench,
    hrefFor: (t) => `/api/panel/start?cmd=bakim&t=${encodeURIComponent(t)}`,
  },
  rapor_aylik: {
    key: "rapor_aylik",
    label: "Aylık Rapor",
    Icon: BarChart3,
    hrefFor: (t) => `/api/panel/start?cmd=rapor&t=${encodeURIComponent(t)}`,
  },
  sakin_listele: {
    key: "sakin_listele",
    label: "Sakinler",
    Icon: Users,
    hrefFor: (t) => `/tr/site-sakinlerim${qs(t)}`,
  },
  tahsilat_kaydet: {
    key: "tahsilat_kaydet",
    label: "Tahsilat",
    Icon: Receipt,
    hrefFor: (t) => `/api/panel/start?cmd=aidat&t=${encodeURIComponent(t)}`,
  },
};
