"use client";

import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";

export default function CampaignsPage() {
  return (
    <RestoranPanelShell>
      {() => (
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-5">🎯 Kampanyalar</h1>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow border border-slate-200 p-8 text-center">
            <div className="text-5xl mb-4">🎯</div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Yakında</h2>
            <p className="text-slate-600 max-w-md mx-auto">
              Müdavimlerinize özel günlerde otomatik mesaj kampanyaları, doğum günü
              indirimleri ve sezon promosyonları için panel hazırlanıyor.
            </p>
            <p className="text-sm text-slate-500 mt-4">
              Şimdilik WhatsApp&apos;tan <code>sadakat</code> komutuyla müdavim
              panosuna erişebilirsiniz.
            </p>
          </div>
        </div>
      )}
    </RestoranPanelShell>
  );
}
