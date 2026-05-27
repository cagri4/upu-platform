"use client";

/**
 * /tr/site-tedarikciler — Tedarikçi CRUD (Modül 5, Sprint 2).
 *
 * Banking style ListCard + inline modal. site-personelim ile simetrik.
 * Sözleşme bitiş tarihine 30 gün kala uyarı vurgu (rose chip).
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, Plus, X, Trash2, RotateCw, AlertTriangle } from "lucide-react";
import { HeroBanner, ListCard, Skeleton } from "@/components/banking";

interface Supplier {
  id: string;
  company_name: string;
  sector: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  service: string | null;
  monthly_fee_kurus: number | null;
  contract_start: string | null;
  contract_end: string | null;
  contract_pdf_url: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

function formatTL(kurus: number | null): string {
  if (!kurus) return "—";
  return `₺${Math.round(kurus / 100).toLocaleString("tr-TR")}`;
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function SiteTedarikcilerPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "new" | "edit"; data?: Supplier } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/site/tedarikciler${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) setError(d.error);
        else setList(d.suppliers || []);
      })
      .catch(() => setError("Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const activeList = list.filter((s) => s.is_active);
  const inactiveList = list.filter((s) => !s.is_active);

  const expiringSoon = activeList.filter((s) => {
    const d = daysUntil(s.contract_end);
    return d !== null && d <= 30 && d >= 0;
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Briefcase}
        title="Tedarikçiler"
        subtitle={`${activeList.length} aktif · ${list.length} toplam`}
        ctaLabel="Yeni Tedarikçi"
        ctaOnClick={() => setModal({ mode: "new" })}
      />

      {expiringSoon.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Sözleşme yenileme yaklaşıyor
          </p>
          <p>{expiringSoon.length} tedarikçi sözleşmesi 30 gün içinde sona eriyor.</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-sm">
          ⚠ {error}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Aktif Tedarikçiler
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-16" />)}
          </div>
        ) : activeList.length === 0 ? (
          <EmptyState onAdd={() => setModal({ mode: "new" })} />
        ) : (
          activeList.map((s) => {
            const days = daysUntil(s.contract_end);
            const rightLabel = days !== null && days <= 30 && days >= 0
              ? `${days} gün kaldı`
              : "Düzenle";
            return (
              <ListCard
                key={s.id}
                Icon={Briefcase}
                title={`${s.company_name} · ${s.sector}`}
                subtitle={[
                  s.contact_phone && `📞 ${s.contact_phone}`,
                  s.monthly_fee_kurus && `💰 ${formatTL(s.monthly_fee_kurus)}/ay`,
                  s.contract_end && `📅 sözleşme ${s.contract_end}`,
                ].filter(Boolean).join("  ·  ")}
                rightLabel={rightLabel}
                onClick={() => setModal({ mode: "edit", data: s })}
              />
            );
          })
        )}
      </div>

      {inactiveList.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
            Pasif ({inactiveList.length})
          </div>
          {inactiveList.map((s) => (
            <div
              key={s.id}
              className="bg-slate-100 dark:bg-slate-900/50 rounded-2xl px-4 py-3 border border-slate-200/70 dark:border-slate-800 opacity-60 cursor-pointer hover:opacity-100 transition"
              onClick={() => setModal({ mode: "edit", data: s })}
            >
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {s.company_name} · {s.sector}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Pasif · Düzenlemek için tıklayın</div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <SupplierModal
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

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center space-y-3">
      <div className="text-4xl">🤝</div>
      <div className="font-semibold text-slate-900 dark:text-white">Tedarikçi kaydı yok</div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Asansör, peyzaj, güvenlik, temizlik firmalarınızı buraya kaydedin.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition active:scale-95"
      >
        <Plus className="w-4 h-4" /> Yeni Tedarikçi Ekle
      </button>
    </div>
  );
}

interface ModalProps {
  mode: "new" | "edit";
  initial?: Supplier;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

function SupplierModal({ mode, initial, token, onClose, onSaved }: ModalProps) {
  const [company_name, setCompanyName] = useState(initial?.company_name || "");
  const [sector, setSector] = useState(initial?.sector || "");
  const [contact_name, setContactName] = useState(initial?.contact_name || "");
  const [contact_phone, setContactPhone] = useState(initial?.contact_phone || "");
  const [contact_email, setContactEmail] = useState(initial?.contact_email || "");
  const [service, setService] = useState(initial?.service || "");
  const [feeTL, setFeeTL] = useState(
    initial?.monthly_fee_kurus ? String(Math.round(initial.monthly_fee_kurus / 100)) : "",
  );
  const [contract_start, setContractStart] = useState(initial?.contract_start || "");
  const [contract_end, setContractEnd] = useState(initial?.contract_end || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [is_active, setIsActive] = useState(initial?.is_active !== false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (!company_name.trim() || !sector.trim()) {
      setMsg("Firma adı ve sektör zorunlu.");
      return;
    }
    setSaving(true);
    setMsg(null);

    const payload = {
      id: initial?.id,
      company_name: company_name.trim(),
      sector: sector.trim(),
      contact_name: contact_name.trim() || null,
      contact_phone: contact_phone.trim() || null,
      contact_email: contact_email.trim() || null,
      service: service.trim() || null,
      monthly_fee_kurus: feeTL ? Number(feeTL) * 100 : null,
      contract_start: contract_start || null,
      contract_end: contract_end || null,
      notes: notes.trim() || null,
      is_active,
    };

    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/site/tedarikciler${qs}`, {
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

  async function softDelete() {
    if (!initial?.id) return;
    if (!confirm(`${initial.company_name} pasifleştirilsin mi?`)) return;
    setSaving(true);
    try {
      const qs = `?id=${encodeURIComponent(initial.id)}${token ? `&t=${encodeURIComponent(token)}` : ""}`;
      const res = await fetch(`/api/site/tedarikciler${qs}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
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
            {mode === "new" ? "Yeni Tedarikçi" : "Tedarikçi Düzenle"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <Field label="Firma Adı *" value={company_name} onChange={setCompanyName} />
        <Field label="Sektör * (asansör, peyzaj, güvenlik...)" value={sector} onChange={setSector} />
        <Field label="Yetkili Adı" value={contact_name} onChange={setContactName} />
        <Field label="Yetkili Telefon" value={contact_phone} onChange={setContactPhone} />
        <Field label="Email" value={contact_email} onChange={setContactEmail} type="email" />
        <Field label="Hizmet Açıklaması" value={service} onChange={setService} />
        <Field label="Aylık Ücret (₺)" value={feeTL} onChange={setFeeTL} type="number" />
        <Field label="Sözleşme Başlangıç" value={contract_start} onChange={setContractStart} type="date" />
        <Field label="Sözleşme Bitiş" value={contract_end} onChange={setContractEnd} type="date" />
        <Field label="Notlar" value={notes} onChange={setNotes} textarea />

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={is_active} onChange={(e) => setIsActive(e.target.checked)} />
          Aktif
        </label>

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
          {mode === "edit" && initial?.is_active && (
            <button
              type="button"
              onClick={softDelete}
              disabled={saving}
              className="px-3 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition"
              aria-label="Pasifleştir"
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
  const cls = "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition text-sm";
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
