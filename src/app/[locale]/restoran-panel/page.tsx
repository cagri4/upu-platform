"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Sparkles,
  CalendarDays,
  UtensilsCrossed,
  Heart,
  Wallet,
  Cake,
  AlertTriangle,
  ClipboardList,
  Users,
  MessageCircle,
} from "lucide-react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";
import {
  HeroBanner,
  StatCard,
  ActionCircle,
  ListCard,
  Skeleton,
} from "@/tenants/restoran/components/banking";
import { useB2cOrdersRealtime } from "@/tenants/restoran/b2c/use-b2c-orders-realtime";
import { NewOrderBanner } from "@/tenants/restoran/b2c/new-order-banner";

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
      {({ token, init }) => (
        <Dashboard
          token={token}
          restaurantName={init.restaurantName}
          restaurantId={init.restaurantId}
          restaurantSlug={init.restaurantSlug}
        />
      )}
    </RestoranPanelShell>
  );
}

function Dashboard({
  token,
  restaurantName,
  restaurantId,
  restaurantSlug,
}: {
  token: string;
  restaurantName: string | null;
  restaurantId: string | null;
  restaurantSlug: string | null;
}) {
  const params = useParams<{ locale: string }>();
  const locale = params?.locale || "tr";
  const { newOrder, dismissNew } = useB2cOrdersRealtime(restaurantId);
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

  const q = (path: string) => (token ? `${path}?t=${encodeURIComponent(token)}` : path);
  const wa = (cmd: string) => `https://wa.me/31644967207?text=${encodeURIComponent(cmd)}`;

  return (
    <div className="space-y-5 sm:space-y-6">
      {newOrder && (
        <NewOrderBanner
          order={newOrder}
          locale={locale}
          token={token}
          onDismiss={dismissNew}
        />
      )}

      <HeroBanner
        Icon={Sparkles}
        title={restaurantName ? `${restaurantName} — Dashboard` : "Restoran Yönetim Paneli"}
        subtitle={
          restaurantSlug
            ? `Müşterileriniz: restoranai.upudev.nl/tr/r/${restaurantSlug}`
            : "Müdavim ilişkileri, rezervasyonlar, gün sonu — hepsi tek panelde."
        }
        ctaLabel={restaurantSlug ? "Public Site →" : undefined}
        ctaHref={restaurantSlug ? `/${locale}/r/${restaurantSlug}` : undefined}
      />

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3 text-sm">
          {errorMsg}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-4">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 px-1">
          Hızlı işlem
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex-shrink-0">
            <ActionCircle Icon={CalendarDays} label="Yeni rezervasyon" href={wa("rezervasyonekle")} external />
          </div>
          <div className="flex-shrink-0">
            <ActionCircle Icon={Heart} label="Müdavim panosu" href={q("/tr/restoran-mudavimler")} />
          </div>
          <div className="flex-shrink-0">
            <ActionCircle Icon={ClipboardList} label="Bugünkü brifing" href={wa("brifing")} external />
          </div>
          <div className="flex-shrink-0">
            <ActionCircle Icon={MessageCircle} label="WhatsApp" href={wa("yardim")} external />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="h-28" />
          ))}
        </div>
      ) : (
        kpis && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard
              Icon={CalendarDays}
              value={kpis.today_reservations}
              label="Bugün rezervasyon"
              trend={
                kpis.today_reservation_guests > 0
                  ? { text: `${kpis.today_reservation_guests} kişi`, positive: true }
                  : undefined
              }
              href={q("/tr/restoran-rezervasyonlar")}
            />
            <StatCard
              Icon={UtensilsCrossed}
              value={`${kpis.free_tables}/${kpis.total_tables}`}
              label="Boş masa"
              trend={
                kpis.occupied_tables > 0
                  ? { text: `${kpis.occupied_tables} dolu`, positive: false }
                  : undefined
              }
              href={q("/tr/restoran-masalar")}
            />
            <StatCard
              Icon={Heart}
              value={kpis.member_count}
              label="Müdavim"
              trend={
                kpis.today_birthdays > 0
                  ? { text: `${kpis.today_birthdays} doğum günü`, positive: true }
                  : undefined
              }
              href={q("/tr/restoran-mudavimler")}
            />
            <StatCard
              Icon={Wallet}
              value={fmtEur(kpis.week_revenue)}
              label="Bu hafta satış"
              trend={{ text: "son 7 gün", positive: true }}
            />
            <StatCard
              Icon={Cake}
              value={kpis.today_birthdays}
              label="Bugün doğum günü"
              trend={
                kpis.today_birthday_names.length > 0
                  ? { text: kpis.today_birthday_names.slice(0, 2).join(", "), positive: true }
                  : undefined
              }
              href={q("/tr/restoran-mudavimler")}
            />
            <StatCard
              Icon={AlertTriangle}
              value={kpis.critical_stock}
              label="Kritik stok"
              trend={
                kpis.critical_stock > 0
                  ? { text: "uyarı", positive: false }
                  : { text: "yeterli", positive: true }
              }
            />
          </div>
        )
      )}

      {kpis && kpis.critical_stock_items.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
            Kritik stok kalemleri
          </div>
          {kpis.critical_stock_items.map((item, i) => (
            <ListCard
              key={i}
              Icon={AlertTriangle}
              title={item.name}
              subtitle={`Stok: ${item.quantity} ${item.unit}`}
              rightLabel="Kritik"
              rightTone="rose"
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Hesap & ayarlar
        </div>
        <ListCard
          Icon={Users}
          title="Restoran Profilim"
          subtitle="Marka adı, açılış saatleri, brifing tercihi"
          rightLabel="Düzenle"
          href={q("/tr/restoran-profil")}
        />
      </div>
    </div>
  );
}
