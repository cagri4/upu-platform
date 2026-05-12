/**
 * Hızlı işlem client catalog — Lucide ikon ve href üreticiler.
 *
 * Server-safe key kümesi `./keys.ts` içinde. Burada her key için
 * label + Icon + token → href mapping tutulur. Hem panel ana sayfası
 * hem panel-ayarlari sayfası bu objeyi tüketir.
 */

import {
  Plus,
  UserPlus,
  FilePlus2,
  Sparkles,
  Target,
  Calendar,
  TrendingUp,
  Puzzle,
  type LucideIcon,
} from "lucide-react";
import type { QuickActionKey } from "./keys";

export interface QuickActionDef {
  key: QuickActionKey;
  label: string;
  Icon: LucideIcon;
  /** Token (boş string olabilir) ile href üretir. */
  hrefFor: (token: string) => string;
  /** wa.me gibi dış link'ler için ipucu (UI yeni sekmede açabilir). */
  external?: boolean;
}

const WA_BOT = "31644967207";

export const QUICK_ACTIONS: Record<QuickActionKey, QuickActionDef> = {
  mulk_ekle: {
    key: "mulk_ekle",
    label: "Mülk Ekle",
    Icon: Plus,
    hrefFor: (t) => `/api/panel/start?cmd=mulkekle${t ? `&t=${encodeURIComponent(t)}` : ""}`,
  },
  musteri_ekle: {
    key: "musteri_ekle",
    label: "Müşteri Ekle",
    Icon: UserPlus,
    hrefFor: (t) => `/api/panel/start?cmd=musteriEkle${t ? `&t=${encodeURIComponent(t)}` : ""}`,
  },
  sozlesme_yap: {
    key: "sozlesme_yap",
    label: "Sözleşme Yap",
    Icon: FilePlus2,
    hrefFor: (t) => `/tr/sozlesme-yap${t ? `?t=${encodeURIComponent(t)}` : ""}`,
  },
  sunum_yarat: {
    key: "sunum_yarat",
    label: "Sunum Yarat",
    Icon: Sparkles,
    hrefFor: (t) => `/tr/sunumlarim${t ? `?t=${encodeURIComponent(t)}` : ""}`,
  },
  takip_ekle: {
    key: "takip_ekle",
    label: "Takip Ekle",
    Icon: Target,
    hrefFor: (t) => `/tr/takip${t ? `?t=${encodeURIComponent(t)}` : ""}`,
  },
  hatirlatma: {
    key: "hatirlatma",
    label: "Hatırlatma",
    Icon: Calendar,
    hrefFor: (t) => `/tr/takvim${t ? `?t=${encodeURIComponent(t)}` : ""}`,
  },
  pazar_tara: {
    key: "pazar_tara",
    label: "Pazar Tara",
    Icon: TrendingUp,
    hrefFor: () => `https://wa.me/${WA_BOT}?text=${encodeURIComponent("/pazartara")}`,
    external: true,
  },
  eklenti: {
    key: "eklenti",
    label: "Eklenti",
    Icon: Puzzle,
    hrefFor: (t) => `/tr/eklenti${t ? `?t=${encodeURIComponent(t)}` : ""}`,
  },
};
