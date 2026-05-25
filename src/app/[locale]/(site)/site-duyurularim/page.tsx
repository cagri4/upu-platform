"use client";

/**
 * /tr/site-duyurularim — Etkinlik & Duyuru sayfası (banking style).
 *
 * Henüz dedicated `sy_announcements` tablosu yok — bu sayfa placeholder
 * + WA komut entegrasyonu sunar. AI sekreteri (sy_sekreter agent) ile
 * üretilen taslaklar V2'de agent_proposals tablosundan listelenecek.
 *
 * Bugünkü davranış:
 *  - HeroBanner + "Duyuru Yaz" CTA → WA bot'a yönlendir
 *  - Bilgi kartı (modül roadmap)
 *  - InfoChip: hızlı erişim — toplantı, etkinlik, acil duyuru
 */

import { useSearchParams } from "next/navigation";
import { Megaphone, Calendar, AlertTriangle, Mail, Sparkles } from "lucide-react";
import { HeroBanner, ListCard, InfoChip } from "@/components/banking";

export default function SiteDuyurularimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";
  const qs = token ? `?t=${encodeURIComponent(token)}` : "";

  const duyuruHref = `/api/panel/start?cmd=duyuru${qs.startsWith("?") ? "&" + qs.slice(1) : ""}`;
  const sakinlerHref = `/tr/site-sakinlerim${qs}`;

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Megaphone}
        title="Etkinlik & Duyuru"
        subtitle="Tüm sakinlere mesaj, etkinlik ve toplantı bildirimi gönderin."
        ctaLabel="Yeni Duyuru Yaz"
        ctaHref={duyuruHref}
      />

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Şablonlar
        </div>
        <ListCard
          Icon={Calendar}
          title="Toplantı Daveti"
          subtitle="Yönetim kurulu / olağan-olağanüstü kongre toplantısı çağrısı"
          rightLabel="Yaz"
          href={duyuruHref}
        />
        <ListCard
          Icon={Megaphone}
          title="Genel Duyuru"
          subtitle="Bakım, etkinlik, hizmet kesintisi gibi bilgilendirme mesajları"
          rightLabel="Yaz"
          href={duyuruHref}
        />
        <ListCard
          Icon={AlertTriangle}
          title="Acil Bildirim"
          subtitle="Su/elektrik kesintisi, asansör arızası, güvenlik uyarısı"
          rightLabel="Yaz"
          href={duyuruHref}
        />
        <ListCard
          Icon={Mail}
          title="Aidat Hatırlatma"
          subtitle="Borçlu sakinlere kişiselleştirilmiş ödeme hatırlatması"
          rightLabel="Yaz"
          href={duyuruHref}
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Yardımcı
        </div>
        <InfoChip
          Icon={Sparkles}
          text="Duyuru metnini AI sekreter yazsın — örnek bir konu söylemeniz yeterli"
          href={duyuruHref}
        />
        <InfoChip
          Icon={Megaphone}
          text="Sakin listesini görmek için Sakinler sayfasına gidin"
          href={sakinlerHref}
        />
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-sm text-amber-900 dark:text-amber-200">
        <p className="font-semibold mb-1">📜 Duyuru arşivi geliyor</p>
        <p>
          Gönderilmiş duyuruların geçmişi, kim okudu durumu ve şablon kütüphanesi
          ileri bir güncellemede burada görünecek. Şu an için yeni duyurular WhatsApp
          üzerinden yazılır.
        </p>
      </div>
    </div>
  );
}
