"use client";

import { BarChart3, MessageCircle, ClipboardList } from "lucide-react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";
import {
  HeroBanner,
  ListCard,
} from "@/tenants/restoran/components/banking";

export default function ReportsPage() {
  return (
    <RestoranPanelShell>
      {() => (
        <div className="space-y-5 sm:space-y-6">
          <HeroBanner
            Icon={BarChart3}
            title="Raporlar"
            subtitle="Yakında: haftalık ciro grafiği, çok satan ürünler, müşteri sıklığı, gün sonu kasa."
          />

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
              <BarChart3 className="w-8 h-8" strokeWidth={2.2} />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Yakında</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto text-sm">
              Haftalık ciro grafiği, en çok satan menü kalemleri, müşteri sıklık
              analizi ve gün sonu kasa raporları için panel hazırlanıyor.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
              Şimdilik bunları yapabilirsiniz
            </div>
            <ListCard
              Icon={ClipboardList}
              title="Günlük brifing"
              subtitle="Dünkü satış + bugün rezervasyon + uyarılar"
              rightLabel="WA Aç"
              href="https://wa.me/31644967207?text=brifing"
            />
            <ListCard
              Icon={MessageCircle}
              title="Müdavim panosu"
              subtitle="Müşteri sıklığı + dormant + doğum günleri"
              rightLabel="Aç"
              href="/tr/restoran-mudavimler"
            />
          </div>
        </div>
      )}
    </RestoranPanelShell>
  );
}
