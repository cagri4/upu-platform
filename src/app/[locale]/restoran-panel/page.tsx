"use client";

import { useEffect, useState } from "react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";

interface Kpis {
  today_reservations: number;
  today_reservation_guests: number;
  free_tables: number;
  occupied_tables: number;
  total_tables: number;
  member_count: number;
  week_revenue: number;
  today_birthdays: number;
  today_birthday_names: string[];
  critical_stock: number;
  critical_stock_items: { name: string; quantity: number; unit: string }[];
}

function fmtEur(n: number): string {
  return `€${n.toLocaleString("tr-NL", { maximumFractionDigits: 0 })}`;
}

export default function RestoranDashboardPage() {
  return (
    <RestoranPanelShell>
      {({ token, init }) => <Dashboard token={token} restaurantName={init.restaurantName} />}
    </RestoranPanelShell>
  );
}

function Dashboard({ token, restaurantName }: { token: string; restaurantName: string | null }) {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/restoran-panel/dashboard?t=${token}`);
        const json = await res.json();
        if (!res.ok) {
          setErrorMsg(json.error || "KPI yüklenemedi.");
          return;
        }
        setKpis(json.kpis);
      } catch {
        setErrorMsg("Bağlantı hatası.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-6 sm:p-8 mb-6 shadow">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">
          {restaurantName || "Restoran"} — Dashboard
        </h1>
        <p className="text-amber-50 text-sm sm:text-base">
          Sisteminizi buradan yönetin. Müdavim ilişkileri, rezervasyonlar, gün sonu — hepsi tek panelde.
        </p>
      </div>

      {loading && <div className="text-slate-500 text-sm">KPI'lar yükleniyor…</div>}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">
          {errorMsg}
        </div>
      )}

      {kpis && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <KpiCard
              icon="📅"
              label="Bugün rezervasyon"
              value={String(kpis.today_reservations)}
              hint={kpis.today_reservation_guests ? `${kpis.today_reservation_guests} kişi` : undefined}
              gradient="from-amber-400 to-orange-500"
            />
            <KpiCard
              icon="🍽"
              label="Boş masa"
              value={`${kpis.free_tables}/${kpis.total_tables}`}
              hint={kpis.occupied_tables > 0 ? `${kpis.occupied_tables} dolu` : undefined}
              gradient="from-emerald-400 to-teal-500"
            />
            <KpiCard
              icon="💝"
              label="Müdavim"
              value={String(kpis.member_count)}
              hint={kpis.today_birthdays > 0 ? `${kpis.today_birthdays} doğum günü 🎂` : undefined}
              gradient="from-rose-400 to-pink-500"
            />
            <KpiCard
              icon="💰"
              label="Bu hafta satış"
              value={fmtEur(kpis.week_revenue)}
              hint="son 7 gün"
              gradient="from-indigo-400 to-blue-500"
            />
            <KpiCard
              icon="🎂"
              label="Bugün doğum günü"
              value={String(kpis.today_birthdays)}
              hint={kpis.today_birthday_names.length > 0 ? kpis.today_birthday_names.slice(0, 2).join(", ") : "—"}
              gradient="from-violet-400 to-fuchsia-500"
            />
            <KpiCard
              icon="🔴"
              label="Kritik stok"
              value={String(kpis.critical_stock)}
              hint={kpis.critical_stock > 0 ? "uyarı" : "yeterli"}
              gradient="from-stone-400 to-slate-500"
            />
          </div>

          {/* Kritik stok detay */}
          {kpis.critical_stock_items.length > 0 && (
            <div className="bg-white rounded-2xl shadow border border-slate-200 p-5 mb-6">
              <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                🔴 Kritik Stok Kalemleri
              </h2>
              <ul className="space-y-1.5">
                {kpis.critical_stock_items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.name}</span>
                    <span className="text-slate-500 font-medium">
                      {item.quantity} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-3">Hızlı İşlemler</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <QuickAction icon="📅" label="Yeni rezervasyon" href={`https://wa.me/31644967207?text=rezervasyonekle`} external />
              <QuickAction icon="💝" label="Müdavim panosu" href={`/tr/restoran-mudavimler?t=${token}`} />
              <QuickAction icon="📋" label="Bugünkü brifing" href={`https://wa.me/31644967207?text=brifing`} external />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, hint, gradient }: { icon: string; label: string; value: string; hint?: string; gradient: string }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} text-white rounded-2xl p-4 sm:p-5 shadow`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-bold leading-tight">{value}</div>
      <div className="text-xs sm:text-sm opacity-90 mt-1">{label}</div>
      {hint && <div className="text-xs opacity-75 mt-1">{hint}</div>}
    </div>
  );
}

function QuickAction({ icon, label, href, external }: { icon: string; label: string; href: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-amber-50 rounded-xl border border-slate-200 transition text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
    >
      <span className="text-xl">{icon}</span>
      <span>{label}</span>
    </a>
  );
}
