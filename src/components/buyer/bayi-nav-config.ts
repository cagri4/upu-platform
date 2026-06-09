/**
 * Bayi (alıcı) sidebar nav config — V3 stilinde.
 *
 * Ayşe Hanım (market sahibi) görünümü. Sade — sadece alıcı işleri:
 * ana sayfa, katalog, sepet, siparişlerim, faturalar, bildirimler, profil.
 *
 * Dağıtıcı işleri (Bayilerim, Cari Ekstre, Vade, Tahsilat, Gelen Siparişler)
 * BU panel'de yok — onlar `(dagitici)` route group'unda.
 */
import {
  LayoutDashboard,
  ShoppingBag,
  ShoppingCart,
  ClipboardList,
  Receipt,
  Bell,
  User,
} from "lucide-react";
import type { SidebarNavSection } from "@/components/admin/v3-shell";

export function buyerNavSections(
  locale: string,
  badges: { cart?: number; notifications?: number } = {},
): SidebarNavSection[] {
  const base = `/${locale}/bayi`;
  return [
    {
      section: "Alışveriş",
      items: [
        {
          label: "Ana Sayfa",
          href: base,
          match: base,
          icon: LayoutDashboard,
        },
        {
          label: "Katalog",
          href: `${base}/katalog`,
          match: `${base}/katalog`,
          icon: ShoppingBag,
        },
        {
          label: "Sepetim",
          href: `${base}/sepet`,
          match: `${base}/sepet`,
          icon: ShoppingCart,
          badge: badges.cart && badges.cart > 0 ? String(badges.cart) : undefined,
        },
      ],
    },
    {
      section: "Geçmiş",
      items: [
        {
          label: "Siparişlerim",
          href: `${base}/siparislerim`,
          match: `${base}/siparislerim`,
          icon: ClipboardList,
        },
        {
          label: "Faturalarım",
          href: `${base}/faturalarim`,
          match: `${base}/faturalarim`,
          icon: Receipt,
        },
      ],
    },
    {
      section: "Hesap",
      items: [
        {
          label: "Bildirimler",
          href: `${base}/bildirimler`,
          match: `${base}/bildirimler`,
          icon: Bell,
          badge:
            badges.notifications && badges.notifications > 0
              ? String(badges.notifications)
              : undefined,
        },
        {
          label: "Profilim",
          href: `${base}/profil`,
          match: `${base}/profil`,
          icon: User,
        },
      ],
    },
  ];
}
