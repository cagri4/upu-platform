"use client";

/**
 * /tr/site-butce — Modül 2: Gider & Bütçe (Sprint 2).
 *
 * Yıl bazlı plan vs gerçekleşen tablosu. Kategori bazında varyans hesabı,
 * %20+ sapmaya kırmızı uyarı. Plansız harcama kategorileri ayrı listede.
 *
 * Banking style: HeroBanner + 3 StatCard (planlanan/gerçekleşen/kalan) +
 * progress bar'lı satır listesi + plansız listesi.
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  X,
  Trash2,
} from "lucide-react";
import { HeroBanner, StatCard, Skeleton } from "@/components/banking";

interface BudgetRow {
  id: string;
  category: string;
  year: number;
  planned_kurus: number;
  actual_kurus: number;
  remaining_kurus: number;
  variance_percent: number;
  overrun: boolean;
  notes: string | null;
}

interface UnplannedRow {
  category: string;
  actual_kurus: number;
}

interface Total {
  planned_kurus: number;
  actual_kurus: number;
  remaining_kurus: number;
}

function formatTL(kurus: number): string {
  if (!kurus) return "₺0";
  if (kurus >= 100_000_000) return `₺${(kurus / 100_000_000).toFixed(1)}M`;
  if (kurus >= 100_000) return `₺${Math.round(kurus / 100_000)}K`;
  return `₺${Math.round(kurus / 100).toLocaleString("tr-TR")}`;
}

export default function SiteButcePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [unplanned, setUnplanned] = useState<UnplannedRow[]>([]);
  const [total, setTotal] = useState<Total | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "new" | "edit"; data?: BudgetRow } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("year", String(year));
    if (token) params.set("t", token);
    fetch(`/api/site/butce?${params.toString()}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) setError(d.error);
        else {
          setBudgets(d.budgets || []);
          setUnplanned(d.unplanned || []);
          setTotal(d.total || null);
        }
      })
      .catch(() => setError("Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [year, token]);

  useEffect(() => { load(); }, [load]);

  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={PieChart}
        title={`Bütçe ${year}`}
        subtitle="Yıllık kategori planı vs gerçekleşen harcama analizi"
        ctaLabel="Yeni Kategori"
        ctaOnClick={() => setModal({ mode: "new" })}
      />

      {/* Yıl seçici */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-1.5 inline-flex shadow-sm">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(y)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition ${
              year === y
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Özet StatCards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {loading || !total ? (
          <>
            <Skeleton height="h-28" />
            <Skeleton height="h-28" />
            <Skeleton height="h-28" />
          </>
        ) : (
          <>
            <StatCard
              Icon={PieChart}
              value={formatTL(total.planned_kurus)}
              label="Planlanan Toplam"
            />
            <StatCard
              Icon={TrendingDown}
              value={formatTL(total.actual_kurus)}
              label="Gerçekleşen"
            />
            <StatCard
              Icon={TrendingUp}
              value={formatTL(total.remaining_kurus)}
              label={total.remaining_kurus >= 0 ? "Kalan Bütçe" : "Aşım"}
            />
          </>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Bütçe kategorileri */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Kategori Bütçeleri
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-20" />)}
          </div>
        ) : budgets.length === 0 ? (
          <EmptyState year={year} onAdd={() => setModal({ mode: "new" })} />
        ) : (
          budgets.map((b) => (
            <BudgetRowCard key={b.id} row={b} onEdit={() => setModal({ mode: "edit", data: b })} />
          ))
        )}
      </div>

      {/* Plansız harcamalar */}
      {unplanned.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide px-1 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> Bütçesiz Harcama Kategorileri
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/50 p-4 text-sm text-rose-900 dark:text-rose-200 space-y-1">
            {unplanned.map((u) => (
              <div key={u.category} className="flex justify-between">
                <span className="font-medium">{u.category}</span>
                <span>{formatTL(u.actual_kurus)}</span>
              </div>
            ))}
            <p className="text-xs pt-2 opacity-80">
              Bu kategoriler için yıllık bütçe tanımlanmamış. &ldquo;Yeni Kategori&rdquo; ile ekleyin.
            </p>
          </div>
        </div>
      )}

      {modal && (
        <BudgetModal
          mode={modal.mode}
          initial={modal.data}
          year={year}
          token={token}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function BudgetRowCard({ row, onEdit }: { row: BudgetRow; onEdit: () => void }) {
  const pct = row.planned_kurus > 0
    ? Math.min(Math.round((row.actual_kurus / row.planned_kurus) * 100), 200)
    : 0;
  const barColor =
    row.overrun ? "bg-rose-500" :
    pct >= 80 ? "bg-amber-500" :
    "bg-emerald-500";

  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition text-left"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-slate-900 dark:text-white">{row.category}</span>
        <span className={`text-xs font-semibold ${row.overrun ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"}`}>
          {row.overrun && "⚠ "}{row.variance_percent > 0 ? "+" : ""}{row.variance_percent}%
        </span>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex justify-between">
        <span>Plan {formatTL(row.planned_kurus)}</span>
        <span>Gerçekleşen {formatTL(row.actual_kurus)}</span>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </button>
  );
}

function EmptyState({ year, onAdd }: { year: number; onAdd: () => void }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center space-y-3">
      <div className="text-4xl">📊</div>
      <div className="font-semibold text-slate-900 dark:text-white">
        {year} için kategori bütçesi yok
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Asansör, peyzaj, güvenlik, idare gibi kategoriler için yıllık plan girin.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition active:scale-95"
      >
        <Plus className="w-4 h-4" /> Kategori Ekle
      </button>
    </div>
  );
}

interface BudgetModalProps {
  mode: "new" | "edit";
  initial?: BudgetRow;
  year: number;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

function BudgetModal({ mode, initial, year, token, onClose, onSaved }: BudgetModalProps) {
  const [category, setCategory] = useState(initial?.category || "");
  const [plannedTL, setPlannedTL] = useState(
    initial?.planned_kurus ? String(Math.round(initial.planned_kurus / 100)) : "",
  );
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (!category.trim()) {
      setMsg("Kategori adı zorunlu.");
      return;
    }
    setSaving(true);
    setMsg(null);

    const payload: Record<string, unknown> = {
      yearly_planned_kurus: plannedTL ? Number(plannedTL) * 100 : 0,
      notes: notes.trim() || null,
    };
    if (mode === "new") {
      payload.category = category.trim();
      payload.year = year;
    } else {
      payload.id = initial?.id;
    }

    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/site/butce${qs}`, {
        method: mode === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) setMsg(d.error || "Kaydedilemedi.");
      else onSaved();
    } catch {
      setMsg("Bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow() {
    if (!initial?.id) return;
    if (!confirm(`${initial.category} kategorisi silinsin mi?`)) return;
    setSaving(true);
    try {
      const qs = `?id=${encodeURIComponent(initial.id)}${token ? `&t=${encodeURIComponent(token)}` : ""}`;
      const res = await fetch(`/api/site/butce${qs}`, { method: "DELETE", credentials: "same-origin" });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-3 my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            {mode === "new" ? `Yeni Kategori — ${year}` : `${initial?.category} — ${year}`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {mode === "new" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Kategori *</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="örn: asansor, peyzaj, guvenlik..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Yıllık Plan (₺)</label>
          <input
            type="number"
            value={plannedTL}
            onChange={(e) => setPlannedTL(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Notlar</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
          />
        </div>

        {msg && <p className="text-sm text-rose-600 dark:text-rose-400">{msg}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition active:scale-[0.98]"
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {mode === "edit" && (
            <button
              type="button"
              onClick={deleteRow}
              disabled={saving}
              className="px-3 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 py-2.5 rounded-lg text-sm font-semibold transition"
              aria-label="Sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
