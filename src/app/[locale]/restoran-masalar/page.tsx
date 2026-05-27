"use client";

import { useEffect, useState } from "react";
import {
  UtensilsCrossed,
  CircleCheck,
  CircleX,
  Clock,
  Sparkles,
  QrCode,
  Download,
  X,
  ExternalLink,
  Bell,
  Receipt,
  AlertTriangle,
  MessageCircle,
  Check,
} from "lucide-react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";
import {
  HeroBanner,
  Skeleton,
} from "@/tenants/restoran/components/banking";
import { useTableCallsRealtime, type PendingTableCall } from "@/tenants/restoran/b2c/use-table-calls-realtime";

interface Table {
  id: string;
  label: string;
  capacity: number | null;
  zone: string | null;
  status: string;
  current_check_amount: number | null;
}

type Tone = "amber" | "emerald" | "rose" | "slate";

const STATUS_META: Record<string, { label: string; tone: Tone; Icon: typeof CircleCheck; bg: string; color: string }> = {
  free: { label: "Boş", tone: "emerald", Icon: CircleCheck, bg: "bg-emerald-50 dark:bg-emerald-950/40", color: "text-emerald-700 dark:text-emerald-300" },
  occupied: { label: "Dolu", tone: "rose", Icon: CircleX, bg: "bg-rose-50 dark:bg-rose-950/40", color: "text-rose-700 dark:text-rose-300" },
  reserved: { label: "Rezerve", tone: "amber", Icon: Clock, bg: "bg-amber-50 dark:bg-amber-950/40", color: "text-amber-700 dark:text-amber-300" },
  cleaning: { label: "Temizleniyor", tone: "slate", Icon: Sparkles, bg: "bg-slate-100 dark:bg-slate-800", color: "text-slate-600 dark:text-slate-400" },
};

export default function TablesPage() {
  return (
    <RestoranPanelShell>
      {({ token, init }) => <Grid token={token} restaurantId={init.restaurantId} />}
    </RestoranPanelShell>
  );
}

function Grid({ token, restaurantId }: { token: string; restaurantId: string | null }) {
  const [items, setItems] = useState<Table[] | null>(null);
  const [error, setError] = useState<string>("");
  const [qrTable, setQrTable] = useState<Table | null>(null);
  const { pendingByTable, newCall, dismissNew, ack } = useTableCallsRealtime(restaurantId, token);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/restoran-panel/list?type=tables&t=${token}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error || "Yüklenemedi."); return; }
        setItems(json.items);
      } catch { setError("Bağlantı hatası."); }
    })();
  }, [token]);

  const zones: Record<string, Table[]> = {};
  for (const t of items || []) {
    const z = t.zone || "Genel";
    (zones[z] = zones[z] || []).push(t);
  }

  const total = items?.length || 0;
  const free = (items || []).filter((t) => t.status === "free").length;
  const occupied = (items || []).filter((t) => t.status === "occupied").length;

  const pendingCount = Object.keys(pendingByTable).length;

  return (
    <div className="space-y-5 sm:space-y-6">
      {newCall && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300 rounded-2xl px-4 py-3 text-sm flex items-center justify-between gap-3 animate-pulse">
          <span className="flex items-center gap-2 font-semibold">
            <Bell className="w-4 h-4" strokeWidth={2.4} />
            🛎 Yeni çağrı! Aşağıdaki masaya bakın
          </span>
          <button
            type="button"
            onClick={dismissNew}
            className="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline"
          >
            Tamam
          </button>
        </div>
      )}

      <HeroBanner
        Icon={UtensilsCrossed}
        title="Masalar"
        subtitle={
          items
            ? `${total} masa · ${free} boş · ${occupied} dolu${pendingCount > 0 ? ` · 🛎 ${pendingCount} çağrı bekliyor` : ""}`
            : "Masalarınız yükleniyor…"
        }
      />

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!items && !error && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="h-20" />
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
          Henüz masa tanımlanmamış.
        </div>
      )}

      {Object.entries(zones).map(([zone, tables]) => (
        <div key={zone} className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
            {zone}
          </div>
          {tables.map((t) => {
            const meta = STATUS_META[t.status] || STATUS_META.free;
            const StatusIcon = meta.Icon;
            const parts: string[] = [];
            if (t.capacity) parts.push(`${t.capacity} kişilik`);
            if (t.current_check_amount && t.current_check_amount > 0) {
              parts.push(
                `Hesap: €${t.current_check_amount.toLocaleString("tr-NL", { maximumFractionDigits: 0 })}`
              );
            }
            const pending = pendingByTable[t.id];
            return (
              <div
                key={t.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm px-4 py-3.5 ${
                  pending
                    ? "border-2 border-rose-400 dark:border-rose-600 animate-pulse"
                    : "border-slate-200/70 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${meta.bg} ${meta.color} flex items-center justify-center flex-shrink-0`}>
                    <StatusIcon className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      Masa {t.label}
                    </div>
                    {parts.length > 0 && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {parts.join(" · ")}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                  <button
                    type="button"
                    onClick={() => setQrTable(t)}
                    className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/30 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 text-xs font-medium transition active:scale-95"
                    aria-label={`Masa ${t.label} QR kodu`}
                  >
                    <QrCode className="w-3.5 h-3.5" strokeWidth={2.4} />
                    QR
                  </button>
                </div>
                {pending && <PendingCallBanner call={pending} onAck={ack} />}
              </div>
            );
          })}
        </div>
      ))}

      {qrTable && (
        <QrModal token={token} table={qrTable} onClose={() => setQrTable(null)} />
      )}
    </div>
  );
}

function PendingCallBanner({
  call,
  onAck,
}: {
  call: PendingTableCall;
  onAck: (callId: string, resolved?: boolean) => void;
}) {
  const reasonMeta = {
    call: { label: "Garson çağrısı", Icon: Bell, color: "text-rose-700 dark:text-rose-300" },
    bill_request: { label: "Hesap istendi", Icon: Receipt, color: "text-amber-700 dark:text-amber-300" },
    complaint: { label: "Şikayet", Icon: AlertTriangle, color: "text-rose-700 dark:text-rose-300" },
    other: { label: "Başka", Icon: MessageCircle, color: "text-slate-700 dark:text-slate-300" },
  }[call.reason];
  const Icon = reasonMeta.Icon;
  const ageSeconds = Math.floor((Date.now() - new Date(call.called_at).getTime()) / 1000);
  const ageLabel = ageSeconds < 60 ? `${ageSeconds}sn` : `${Math.floor(ageSeconds / 60)}dk önce`;

  return (
    <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-900/50 flex items-center gap-2">
      <Icon className={`w-4 h-4 flex-shrink-0 ${reasonMeta.color}`} strokeWidth={2.4} />
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold ${reasonMeta.color}`}>
          🛎 {reasonMeta.label} · {ageLabel}
        </div>
        {call.notes && (
          <div className="text-xs text-slate-600 dark:text-slate-400 italic mt-0.5">
            “{call.notes}”
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onAck(call.id, true)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition active:scale-95"
      >
        <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
        Yanıtladım
      </button>
    </div>
  );
}

function QrModal({
  token,
  table,
  onClose,
}: {
  token: string;
  table: Table;
  onClose: () => void;
}) {
  const pngUrl = `/api/restoran-panel/tables/${table.id}/qr?t=${encodeURIComponent(token)}&format=png`;
  const svgUrl = `/api/restoran-panel/tables/${table.id}/qr?t=${encodeURIComponent(token)}&format=svg`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Masa {table.label} QR Kodu
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" strokeWidth={2.4} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex justify-center bg-white dark:bg-slate-100 rounded-2xl p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pngUrl}
              alt={`Masa ${table.label} QR kodu`}
              className="w-64 h-64 object-contain"
              loading="lazy"
            />
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 text-center leading-relaxed">
            Bu QR kodu masaya yapıştırın veya yazdırın.<br />
            Müşteriler okuttuklarında masa-aware menü açılır:<br />
            <code className="text-amber-700 dark:text-amber-400 break-all">
              /r/{`{slug}`}/m/{`{qr_token}`}
            </code>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <a
              href={pngUrl}
              download={`masa-${table.label}-qr.png`}
              className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition active:scale-95"
            >
              <Download className="w-4 h-4" strokeWidth={2.4} />
              PNG İndir
            </a>
            <a
              href={svgUrl}
              download={`masa-${table.label}-qr.svg`}
              className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium px-4 py-2.5 rounded-xl text-sm transition active:scale-95"
            >
              <Download className="w-4 h-4" strokeWidth={2.4} />
              SVG İndir
            </a>
          </div>

          <a
            href={pngUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.2} />
            QR'ı yeni sekmede aç (yazdırma için)
          </a>
        </div>
      </div>
    </div>
  );
}
