/**
 * Bayi Hızlı İşlem client catalog — Lucide ikon + href üreticiler.
 *
 * Bayi panel ana sayfası + bayi panel-ayarlari customize sayfası bu
 * objeyi tüketir. Emlak `catalog.ts` ile paritetik.
 */

import {
  UserPlus,
  Users,
  ShoppingCart,
  Bell,
  Megaphone,
  Clock,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import type { BayiQuickActionKey } from "./bayi-keys";

export interface BayiQuickActionDef {
  key: BayiQuickActionKey;
  label: string;
  Icon: LucideIcon;
  hrefFor: (token: string) => string;
}

const qs = (t: string) => (t ? `?t=${encodeURIComponent(t)}` : "");

export const BAYI_QUICK_ACTIONS: Record<BayiQuickActionKey, BayiQuickActionDef> = {
  bayi_davet: {
    key: "bayi_davet",
    label: "Bayi Davet",
    Icon: UserPlus,
    hrefFor: (t) => `/tr/bayi-davet${qs(t)}`,
  },
  kullanici_ekle: {
    key: "kullanici_ekle",
    label: "Kullanıcı Ekle",
    Icon: Users,
    hrefFor: (t) => `/tr/kullanici-davet${qs(t)}`,
  },
  siparis_kaydet: {
    key: "siparis_kaydet",
    label: "Sipariş Kaydet",
    Icon: ShoppingCart,
    hrefFor: (t) => `/tr/bayi-siparis${qs(t)}`,
  },
  tahsilat: {
    key: "tahsilat",
    label: "Tahsilat",
    Icon: Bell,
    hrefFor: (t) => `/tr/bayi-tahsilatlarim${qs(t)}`,
  },
  kampanya: {
    key: "kampanya",
    label: "Kampanya",
    Icon: Megaphone,
    hrefFor: (t) => `/tr/bayi-kampanya${qs(t)}`,
  },
  vade_hatirla: {
    key: "vade_hatirla",
    label: "Vade Hatırla",
    Icon: Clock,
    hrefFor: (t) => `/tr/bayi-vade-hatirlatma${qs(t)}`,
  },
  cirolarim: {
    key: "cirolarim",
    label: "Cirolarım",
    Icon: BarChart3,
    hrefFor: (t) => `/tr/bayi-raporlar${qs(t)}`,
  },
};
