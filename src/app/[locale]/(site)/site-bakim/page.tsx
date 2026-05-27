"use client";

/**
 * /tr/site-bakim — Modül 6: Bakım Planlama (Sprint 3).
 *
 * Periyodik bakım takvimi. Asansör (6 ay TS EN 81-20), yangın tüp (yıllık),
 * jeneratör (yıllık), peyzaj (aylık), çatı temizlik (6 ay) vb. TR standart
 * bakım türleri legal_basis alanında saklı.
 *
 * 3 grup: Vadesi Geçmiş (rose) / Yaklaşan 30 gün (amber) / Diğer.
 * "Tamamlandı" butonu → last_done_at + next_due_at otomatik shift.
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  X,
  Trash2,
  RotateCw,
} from "lucide-react";
import { HeroBanner, ListCard, Skeleton } from "@/components/banking";

interface MaintenanceRow {
  id: string;
  title: string;
  category: string;
  period_days: number;
  last_done_at: string | null;
  next_due_at: string;
  assigned_supplier_id: string | null;
  status: string;
  legal_basis: string | null;
  notes: string | null;
  created_at: string;
  sy_suppliers?: { company_name: string | null; sector: string | null } | null;
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const STANDARD_PRESETS = [
  { title: "Asansör Aylık Muayene", category: "asansor", period_days: 30, legal_basis: "TS EN 81-20 (aylık kontrol)" },
  { title: "Asansör Yıllık Muayene", category: "asansor", period_days: 365, legal_basis: "TS EN 81-20 (yıllık)" },
  { title: "Yangın Tüpü Yıllık Kontrol", category: "yangin", period_days: 365, legal_basis: "İSG yönetmeliği" },
  { title: "Jeneratör Yıllık Bakım", category: "jenerator", period_days: 365, legal_basis: "Üretici şartnamesi" },
  { title: "Peyzaj Aylık Bakım", category: "peyzaj", period_days: 30, legal_basis: "Sözleşme" },
  { title: "Çatı Temizliği", category: "catitemizlik", period_days: 180, legal_basis: "Önleyici bakım" },
  { title: "Su Deposu Temizliği", category: "sudeposu", period_days: 180, legal_basis: "Sağlık Bakanlığı yönetmeliği" },
];

export default function SiteBakimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<MaintenanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "new" | "edit"; data?: MaintenanceRow } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/site/bakim${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) setError(d.error);
        else setList(d.schedule || []);
      })
      .catch(() => setError("Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const overdue = list.filter((m) => m.status === "overdue");
  const upcoming = list.filter((m) => {
    if (m.status === "overdue") return false;
    const days = daysUntil(m.next_due_at);
    return days >= 0 && days <= 30;
  });
  const others = list.filter((m) => {
    if (m.status === "overdue") return false;
    const days = daysUntil(m.next_due_at);
    return days > 30;
  });

  async function markDone(id: string) {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    await fetch(`/api/site/bakim${qs}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id, mark_done: true }),
    });
    load();
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Wrench}
        title="Bakım Takvimi"
        subtitle={`${overdue.length} vadesi geçmiş · ${upcoming.length} yaklaşan · ${others.length} diğer`}
        ctaLabel="Yeni Bakım"
        ctaOnClick={() => setModal({ mode: "new" })}
      />

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Vadesi geçmiş */}
      {overdue.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide px-1 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> Vadesi Geçmiş ({overdue.length})
          </div>
          {overdue.map((m) => (
            <MaintenanceCard
              key={m.id}
              m={m}
              tone="rose"
              onEdit={() => setModal({ mode: "edit", data: m })}
              onMarkDone={() => markDone(m.id)}
            />
          ))}
        </div>
      )}

      {/* Yaklaşan 30 gün */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide px-1">
            Yaklaşan 30 gün ({upcoming.length})
          </div>
          {upcoming.map((m) => (
            <MaintenanceCard
              key={m.id}
              m={m}
              tone="amber"
              onEdit={() => setModal({ mode: "edit", data: m })}
              onMarkDone={() => markDone(m.id)}
            />
          ))}
        </div>
      )}

      {/* Diğer */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Diğer ({others.length})
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-16" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center space-y-3">
            <div className="text-4xl">🛠</div>
            <div className="font-semibold text-slate-900 dark:text-white">Bakım takvimi boş</div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Standart TR bakım türlerinden (asansör, yangın, jeneratör...) seçerek başlayın.
            </p>
            <button
              type="button"
              onClick={() => setModal({ mode: "new" })}
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition active:scale-95"
            >
              + Yeni Bakım Ekle
            </button>
          </div>
        ) : (
          others.map((m) => (
            <MaintenanceCard
              key={m.id}
              m={m}
              tone="slate"
              onEdit={() => setModal({ mode: "edit", data: m })}
              onMarkDone={() => markDone(m.id)}
            />
          ))
        )}
      </div>

      {modal && (
        <MaintenanceModal
          mode={modal.mode}
          initial={modal.data}
          token={token}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function MaintenanceCard({
  m,
  tone,
  onEdit,
  onMarkDone,
}: {
  m: MaintenanceRow;
  tone: "rose" | "amber" | "slate";
  onEdit: () => void;
  onMarkDone: () => void;
}) {
  const days = daysUntil(m.next_due_at);
  const dueText = days < 0
    ? `${Math.abs(days)} gün önce vadesi`
    : days === 0
      ? "Bugün"
      : `${days} gün sonra`;

  const supplier = m.sy_suppliers?.company_name;
  const toneClass = {
    rose: "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50",
    amber: "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50",
    slate: "bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800",
  }[tone];

  return (
    <div className={`rounded-2xl px-4 py-3.5 border shadow-sm ${toneClass} flex items-center gap-3`}>
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          tone === "rose" ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400" :
          tone === "amber" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" :
          "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
        }`}>
          <Wrench className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {m.title}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {dueText}
            {supplier && ` · ${supplier}`}
            {m.legal_basis && ` · ${m.legal_basis}`}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onMarkDone}
        aria-label="Tamamlandı"
        className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
      >
        <CheckCircle2 className="w-3.5 h-3.5" /> Yapıldı
      </button>
    </div>
  );
}

interface ModalProps {
  mode: "new" | "edit";
  initial?: MaintenanceRow;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

function MaintenanceModal({ mode, initial, token, onClose, onSaved }: ModalProps) {
  const [title, setTitle] = useState(initial?.title || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [period_days, setPeriodDays] = useState(String(initial?.period_days || ""));
  const [next_due_at, setNextDueAt] = useState(
    initial?.next_due_at ? initial.next_due_at.slice(0, 10) : "",
  );
  const [legal_basis, setLegalBasis] = useState(initial?.legal_basis || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function applyPreset(preset: typeof STANDARD_PRESETS[number]) {
    setTitle(preset.title);
    setCategory(preset.category);
    setPeriodDays(String(preset.period_days));
    setLegalBasis(preset.legal_basis);
    // İlk vade today + period_days
    const next = new Date(Date.now() + preset.period_days * 24 * 60 * 60 * 1000);
    setNextDueAt(next.toISOString().slice(0, 10));
  }

  async function save() {
    if (!title.trim() || !category.trim() || !period_days || !next_due_at) {
      setMsg("Başlık, kategori, periyot, vade tarihi zorunlu.");
      return;
    }
    setSaving(true);
    setMsg(null);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      category: category.trim(),
      period_days: Number(period_days),
      next_due_at: new Date(next_due_at).toISOString(),
      legal_basis: legal_basis.trim() || null,
      notes: notes.trim() || null,
    };
    if (mode === "edit") payload.id = initial?.id;

    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/site/bakim${qs}`, {
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
    if (!confirm(`"${initial.title}" silinsin mi?`)) return;
    setSaving(true);
    try {
      const qs = `?id=${encodeURIComponent(initial.id)}${token ? `&t=${encodeURIComponent(token)}` : ""}`;
      const res = await fetch(`/api/site/bakim${qs}`, { method: "DELETE", credentials: "same-origin" });
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
            {mode === "new" ? "Yeni Bakım" : "Bakım Düzenle"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {mode === "new" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Standart bakım türü (opsiyonel)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STANDARD_PRESETS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-slate-700 dark:text-slate-300 rounded-lg transition"
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Başlık *" value={title} onChange={setTitle} />
        <Field label="Kategori * (asansor, yangin, jenerator, peyzaj...)" value={category} onChange={setCategory} />
        <Field label="Periyot (gün) *" value={period_days} onChange={setPeriodDays} type="number" />
        <Field label="Sonraki Vade *" value={next_due_at} onChange={setNextDueAt} type="date" />
        <Field label="Yasal Dayanak (TS EN 81-20 vb.)" value={legal_basis} onChange={setLegalBasis} />
        <Field label="Notlar" value={notes} onChange={setNotes} textarea />

        {msg && <p className="text-sm text-rose-600 dark:text-rose-400">{msg}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition active:scale-[0.98]"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2"><RotateCw className="w-4 h-4 animate-spin" /> Kaydediliyor</span>
            ) : "Kaydet"}
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  textarea?: boolean;
}) {
  const cls = "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition text-sm";
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} min-h-[60px]`} rows={2} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}
