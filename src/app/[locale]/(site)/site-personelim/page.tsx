"use client";

/**
 * /tr/site-personelim — Personel & görev yönetimi (banking style).
 *
 * Henüz `sy_personel` veya `sy_staff_tasks` tablosu yok — bu sayfa
 * placeholder + WA komut entegrasyonu sunar. Personel modülü V2'de
 * dedicated tablo + görev atama akışıyla genişletilecek.
 *
 * Bugünkü davranış:
 *  - HeroBanner + roller (kapıcı, güvenlik, temizlik) listesi
 *  - Roadmap kartı (görev atama, devam etme/tamamlama, performans)
 */

import { useSearchParams } from "next/navigation";
import {
  Hammer,
  Shield,
  Sparkles,
  KeyRound,
  ClipboardList,
  Phone,
} from "lucide-react";
import { HeroBanner, ListCard, InfoChip } from "@/components/banking";

interface RoleRow {
  id: string;
  Icon: typeof Hammer;
  title: string;
  subtitle: string;
}

const ROLES: RoleRow[] = [
  {
    id: "kapici",
    Icon: KeyRound,
    title: "Kapıcı / Yönetim Asistanı",
    subtitle: "Bina giriş çıkış, paket teslimi, genel takip",
  },
  {
    id: "guvenlik",
    Icon: Shield,
    title: "Güvenlik",
    subtitle: "Saat kontrolü, kamera izleme, devriye",
  },
  {
    id: "temizlik",
    Icon: Sparkles,
    title: "Temizlik Personeli",
    subtitle: "Ortak alan günlük temizlik, atık toplama",
  },
  {
    id: "teknisyen",
    Icon: Hammer,
    title: "Teknisyen / Bakımcı",
    subtitle: "Asansör, su, elektrik bakım ve arıza müdahale",
  },
];

export default function SitePersonelimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";
  const qs = token ? `?t=${encodeURIComponent(token)}` : "";

  const menuHref = `/api/panel/start?cmd=menu${qs.startsWith("?") ? "&" + qs.slice(1) : ""}`;
  const taleplerHref = `/tr/site-talepler${qs}`;

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Hammer}
        title="Personel & Görevler"
        subtitle="Bina çalışanlarınız ve görev atamalarınız tek listede."
      />

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Personel Rolleri
        </div>
        {ROLES.map((role) => (
          <ListCard
            key={role.id}
            Icon={role.Icon}
            title={role.title}
            subtitle={role.subtitle}
            rightLabel="Yakında"
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Bağlı işlemler
        </div>
        <InfoChip
          Icon={ClipboardList}
          text="Açık talepleri görüntüle"
          href={taleplerHref}
        />
        <InfoChip
          Icon={Phone}
          text="Yönetici komut menüsünü WhatsApp'ta aç"
          href={menuHref}
        />
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-sm text-amber-900 dark:text-amber-200">
        <p className="font-semibold mb-1">🛠 Personel modülü geliyor</p>
        <p>
          Çalışan kaydı, görev atama, devam çizelgesi ve performans takibi
          buraya gelecek. Şu an için bakım/arıza atamaları
          &ldquo;Şikayet/Talep&rdquo; sayfasından yönetilir.
        </p>
      </div>
    </div>
  );
}
