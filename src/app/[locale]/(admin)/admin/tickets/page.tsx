"use client";

import { useEffect, useState, useCallback } from "react";

interface TicketRow {
  id: number;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  user: { name: string; phone: string | null; email: string | null };
  last_message: { message: string; sender_type: string; created_at: string } | null;
}

interface Stats {
  open: number;
  in_progress: number;
  replied: number;
  resolved: number;
  closed: number;
  today: number;
  total: number;
}

const STATUS_OPTIONS: { id: string; label: string; color: string }[] = [
  { id: "all", label: "Tümü", color: "bg-slate-600" },
  { id: "open", label: "Açık", color: "bg-rose-600" },
  { id: "in_progress", label: "İşlemde", color: "bg-amber-600" },
  { id: "replied", label: "Yanıtlandı", color: "bg-emerald-600" },
  { id: "resolved", label: "Çözüldü", color: "bg-slate-500" },
  { id: "closed", label: "Kapalı", color: "bg-slate-700" },
];

const SINCE_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "Tüm zamanlar" },
  { id: "24h", label: "Bugün" },
  { id: "7d", label: "Son 7 gün" },
  { id: "30d", label: "Son 30 gün" },
];

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function statusBadge(s: string): string {
  switch (s) {
    case "open": return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    case "in_progress": return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    case "replied": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "resolved": return "bg-slate-500/20 text-slate-300 border-slate-500/40";
    case "closed": return "bg-slate-700/40 text-slate-400 border-slate-700/60";
    default: return "bg-slate-700/40 text-slate-400 border-slate-700/60";
  }
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [since, setSince] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        status: statusFilter,
        since,
        ...(search ? { search } : {}),
      }).toString();
      const res = await fetch(`/api/admin/tickets?${qs}`, { credentials: "same-origin" });
      const d = await res.json();
      if (res.ok) {
        setTickets(d.tickets || []);
        setStats(d.stats || null);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, since, search]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-slate-400 hover:text-white text-sm">← Admin</a>
            <span className="text-slate-700">/</span>
            <span className="text-2xl">🛟</span>
            <h1 className="text-xl font-bold">Destek Talepleri</h1>
          </div>
          <span className="text-sm text-slate-400">adminpanel.upudev.nl</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
            <StatCard label="Toplam" value={stats.total} color="bg-slate-800" />
            <StatCard label="Bugün" value={stats.today} color="bg-indigo-800" />
            <StatCard label="Açık" value={stats.open} color="bg-rose-800" />
            <StatCard label="İşlemde" value={stats.in_progress} color="bg-amber-800" />
            <StatCard label="Yanıtlandı" value={stats.replied} color="bg-emerald-800" />
            <StatCard label="Çözüldü" value={stats.resolved} color="bg-slate-700" />
            <StatCard label="Kapalı" value={stats.closed} color="bg-slate-700" />
          </div>
        )}

        {/* Filters */}
        <div className="bg-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(o => (
              <button
                key={o.id}
                onClick={() => setStatusFilter(o.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  statusFilter === o.id ? "bg-white text-slate-900 border-white" : "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {SINCE_OPTIONS.map(o => (
              <button
                key={o.id}
                onClick={() => setSince(o.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  since === o.id ? "bg-white text-slate-900 border-white" : "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600"
                }`}
              >
                {o.label}
              </button>
            ))}
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Konu veya kullanıcı ara..."
              className="flex-1 min-w-[200px] bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center text-slate-500 py-12">Yükleniyor...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center text-slate-500 py-12">Bu filtreyle eşleşen talep yok.</div>
        ) : (
          <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">#</th>
                  <th className="text-left px-4 py-3 font-semibold">Kullanıcı</th>
                  <th className="text-left px-4 py-3 font-semibold">Konu</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Son Mesaj</th>
                  <th className="text-left px-4 py-3 font-semibold">Durum</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-slate-400 font-mono">#{t.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.user.name}</div>
                      <div className="text-xs text-slate-500">{t.user.phone || t.user.email || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/admin/tickets/${t.id}`} className="text-indigo-400 hover:text-indigo-300 font-medium">
                        {t.subject}
                      </a>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-400">
                      {t.last_message ? (
                        <>
                          {t.last_message.sender_type === "admin" ? "📬 " : "💬 "}
                          {t.last_message.message.length > 60 ? t.last_message.message.slice(0, 60) + "…" : t.last_message.message}
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border font-medium ${statusBadge(t.status)}`}>
                        {STATUS_OPTIONS.find(o => o.id === t.status)?.label || t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-400 text-xs">
                      {fmt(t.updated_at || t.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`${color} rounded-lg p-3`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-300 mt-0.5">{label}</div>
    </div>
  );
}
