"use client";

import { Target, MessageCircle, Cake, Sparkles } from "lucide-react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";
import {
  HeroBanner,
  ListCard,
} from "@/tenants/restoran/components/banking";

export default function CampaignsPage() {
  return (
    <RestoranPanelShell>
      {() => (
        <div className="space-y-5 sm:space-y-6">
          <HeroBanner
            Icon={Target}
            title="Kampanyalar"
            subtitle="Yakında: doğum günü indirimleri, sezon promosyonları, otomatik mesajlar."
          />

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
              <Target className="w-8 h-8" strokeWidth={2.2} />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Yakında</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto text-sm">
              Müdavimlerinize özel günlerde otomatik mesaj kampanyaları, doğum günü
              indirimleri ve sezon promosyonları için panel hazırlanıyor.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
              Şimdilik bunları yapabilirsiniz
            </div>
            <ListCard
              Icon={MessageCircle}
              title="WhatsApp sadakat panosu"
              subtitle="Müdavim listesi + dormant uyarısı"
              rightLabel="WA Aç"
              href="https://wa.me/31644967207?text=sadakat"
            />
            <ListCard
              Icon={Cake}
              title="Doğum günü olanları görün"
              subtitle="Bugün doğum günü kutlayan müdavimleriniz"
              rightLabel="Müdavimler"
              href="/tr/restoran-mudavimler"
            />
            <ListCard
              Icon={Sparkles}
              title="Yeni üye davet edin"
              subtitle="WhatsApp üzerinden hızlı kayıt linki"
              rightLabel="WA Aç"
              href="https://wa.me/31644967207?text=uyeol"
            />
          </div>
        </div>
      )}
    </RestoranPanelShell>
  );
}
