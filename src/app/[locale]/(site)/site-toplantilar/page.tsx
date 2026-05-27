"use client";

/**
 * /tr/site-toplantilar — Modül 4: Toplantı & Karar Yönetimi (Sprint 3, KMK 634).
 *
 * Banking style toplantı liste + modal create. KMK 634 zorunluluklarına
 * uyumlu: olağan/olağanüstü ayrımı, çoğurluk hesabı (arsa payı),
 * 15 gün öncesi çağrı uyarı.
 *
 * Karar defteri PDF generation V2 (Çağrı brief'inde karar_defteri_pdf_url
 * alanı var ama gerçek PDF üretim Sprint 3 sonuna ertelendi).
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  AlertTriangle,
} from "lucide-react";
import { HeroBanner, ListCard, Skeleton } from "@/components/banking";

interface Meeting {
  id: string;
  title: string;
  meeting_type: string;
  agenda: unknown;
  scheduled_at: string;
  location: string | null;
  invitees: unknown;
  attendees: unknown;
  quorum_required_percent: number;
  quorum_actual_percent: number | null;
  status: string;
  karar_defteri_pdf_url: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string; Icon: typeof Calendar }> = {
  cagrildi: { label: "Çağrıldı", color: "amber", Icon: Clock },
  yapildi: { label: "Yapıldı", color: "emerald", Icon: CheckCircle2 },
  iptal: { label: "İptal", color: "rose", Icon: XCircle },
};

export default function SiteToplantilarPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Meeting[]>([]);
  const [building, setBuilding] = useState<{ id: string; name: string; arsa_payi_denominator: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "new" | "edit"; data?: Meeting } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/site/toplantilar${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) setError(d.error);
        else {
          setList(d.meetings || []);
          setBuilding(d.building || null);
        }
      })
      .catch(() => setError("Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const upcoming = list.filter((m) => m.status === "cagrildi" && new Date(m.scheduled_at) > new Date());
  const past = list.filter((m) => m.status !== "iptal" && (m.status === "yapildi" || new Date(m.scheduled_at) <= new Date()));
  const cancelled = list.filter((m) => m.status === "iptal");

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Calendar}
        title="Toplantılar & Kararlar"
        subtitle={building ? `${building.name} — KMK 634 uyumlu yönetim` : "Site genel kurul toplantıları"}
        ctaLabel="Yeni Toplantı"
        ctaOnClick={() => setModal({ mode: "new" })}
      />

      {!building?.arsa_payi_denominator && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Arsa payı toplamı eksik
          </p>
          <p>
            KMK 634 toplantı çoğunluk hesabı için <strong>toplam arsa payı</strong> gerekli.
            Bina ayarlarından arsa_payi_denominator değerini girin (sy_buildings).
            Olağan toplantı %51, olağanüstü %66 (2/3) çoğunluk gerekir.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Gelecek toplantılar */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide px-1">
            Yaklaşan ({upcoming.length})
          </div>
          {upcoming.map((m) => (
            <MeetingCard key={m.id} m={m} onClick={() => setModal({ mode: "edit", data: m })} />
          ))}
        </div>
      )}

      {/* Geçmiş toplantılar */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Geçmiş ({past.length})
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-16" />)}
          </div>
        ) : past.length === 0 && upcoming.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center space-y-2">
            <div className="text-4xl">📋</div>
            <div className="font-semibold text-slate-900 dark:text-white">Henüz toplantı yok</div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              İlk toplantınızı çağırmak için sağ üstteki butonu kullanın.
            </p>
          </div>
        ) : (
          past.map((m) => (
            <MeetingCard key={m.id} m={m} onClick={() => setModal({ mode: "edit", data: m })} />
          ))
        )}
      </div>

      {/* İptal edilenler (varsa) */}
      {cancelled.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-rose-500 uppercase tracking-wide px-1">
            İptal ({cancelled.length})
          </div>
          {cancelled.map((m) => (
            <div
              key={m.id}
              className="bg-slate-100 dark:bg-slate-900/50 rounded-2xl px-4 py-3 border border-slate-200/70 dark:border-slate-800 opacity-60 line-through text-sm"
            >
              {m.title} · {new Date(m.scheduled_at).toLocaleDateString("tr-TR")}
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 text-xs text-blue-900 dark:text-blue-200 space-y-1">
        <p className="font-semibold">📜 KMK 634 (Kat Mülkiyeti Kanunu) özet:</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>Olağan toplantı: yılda 1 kez, salt çoğunluk (%51 arsa payı)</li>
          <li>Olağanüstü toplantı: 2/3 çoğunluk (%66 arsa payı)</li>
          <li>Çağrı: en az 15 gün önce yazılı (KMK m.29)</li>
          <li>Karar defteri: yasal arşiv, noter onaylı (V2 PDF üretimi)</li>
        </ul>
      </div>

      {modal && (
        <MeetingModal
          mode={modal.mode}
          initial={modal.data}
          token={token}
          arsaPayiDenominator={building?.arsa_payi_denominator || null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function MeetingCard({ m, onClick }: { m: Meeting; onClick: () => void }) {
  const meta = STATUS_META[m.status] || STATUS_META.cagrildi;
  const Icon = meta.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3.5 shadow-sm hover:shadow-md active:scale-[0.99] transition flex items-center gap-3 text-left"
    >
      <div className={`w-10 h-10 rounded-xl bg-${meta.color}-50 dark:bg-${meta.color}-950/40 text-${meta.color}-600 dark:text-${meta.color}-400 flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{m.title}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {m.meeting_type === "olaganustu" ? "Olağanüstü" : "Olağan"} · {new Date(m.scheduled_at).toLocaleString("tr-TR")}
          {m.location && ` · ${m.location}`}
        </div>
      </div>
      <span className={`text-xs font-semibold text-${meta.color}-600 dark:text-${meta.color}-400`}>
        {meta.label}
      </span>
    </button>
  );
}

interface ModalProps {
  mode: "new" | "edit";
  initial?: Meeting;
  token: string;
  arsaPayiDenominator: number | null;
  onClose: () => void;
  onSaved: () => void;
}

function MeetingModal({ mode, initial, token, arsaPayiDenominator, onClose, onSaved }: ModalProps) {
  const [title, setTitle] = useState(initial?.title || "");
  const [meeting_type, setMeetingType] = useState(initial?.meeting_type || "olagan");
  const [scheduled_at, setScheduledAt] = useState(
    initial?.scheduled_at ? initial.scheduled_at.slice(0, 16) : "",
  );
  const [location, setLocation] = useState(initial?.location || "");
  const [quorum_required_percent, setQuorumRequired] = useState(
    String(initial?.quorum_required_percent || (meeting_type === "olaganustu" ? 66 : 51)),
  );
  const [agenda_text, setAgendaText] = useState(
    Array.isArray(initial?.agenda) && initial?.agenda.length > 0
      ? (initial.agenda as Array<{ madde?: string }>).map((a) => a.madde || "").join("\n")
      : "",
  );
  const [status, setStatus] = useState(initial?.status || "cagrildi");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function onTypeChange(t: string) {
    setMeetingType(t);
    setQuorumRequired(t === "olaganustu" ? "66" : "51");
  }

  async function save() {
    if (!title.trim() || !scheduled_at) {
      setMsg({ kind: "err", text: "Başlık ve tarih zorunlu." });
      return;
    }
    setSaving(true);
    setMsg(null);

    const agenda = agenda_text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((madde, i) => ({ madde, oylama_turu: "lehte_aleyhte", item_no: i + 1 }));

    const payload: Record<string, unknown> = {
      title: title.trim(),
      meeting_type,
      scheduled_at: new Date(scheduled_at).toISOString(),
      location: location.trim() || null,
      agenda,
      quorum_required_percent: Number(quorum_required_percent),
    };
    if (mode === "edit") {
      payload.id = initial?.id;
      payload.status = status;
    }

    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const res = await fetch(`/api/site/toplantilar${qs}`, {
        method: mode === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: d.error || "Kaydedilemedi." });
      } else {
        const okText = d.kmk_warning
          ? `✓ Kaydedildi · ⚠ ${d.kmk_warning}`
          : "✓ Kaydedildi";
        setMsg({ kind: "ok", text: okText });
        window.setTimeout(() => onSaved(), 2000);
      }
    } catch {
      setMsg({ kind: "err", text: "Bağlantı hatası." });
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    if (!initial?.id) return;
    if (!confirm(`"${initial.title}" iptal edilsin mi?`)) return;
    setSaving(true);
    try {
      const qs = `?id=${encodeURIComponent(initial.id)}${token ? `&t=${encodeURIComponent(token)}` : ""}`;
      const res = await fetch(`/api/site/toplantilar${qs}`, { method: "DELETE", credentials: "same-origin" });
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
            {mode === "new" ? "Yeni Toplantı" : "Toplantı Düzenle"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <Field label="Başlık *" value={title} onChange={setTitle} />

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tür</label>
          <select
            value={meeting_type}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm"
          >
            <option value="olagan">Olağan (yıllık, %51)</option>
            <option value="olaganustu">Olağanüstü (%66 / 2-3)</option>
          </select>
        </div>

        <Field label="Tarih & Saat *" value={scheduled_at} onChange={setScheduledAt} type="datetime-local" />
        <Field label="Yer" value={location} onChange={setLocation} />

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Çoğunluk Yüzdesi {arsaPayiDenominator ? `(${arsaPayiDenominator} arsa payı üzerinden)` : ""}
          </label>
          <input
            type="number"
            value={quorum_required_percent}
            onChange={(e) => setQuorumRequired(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Gündem (her satır bir madde)
          </label>
          <textarea
            value={agenda_text}
            onChange={(e) => setAgendaText(e.target.value)}
            rows={5}
            placeholder="1. Yıllık faaliyet raporu&#10;2. Bütçe onayı&#10;3. Yönetim kurulu seçimi"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm"
          />
        </div>

        {mode === "edit" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Durum</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm"
            >
              <option value="cagrildi">Çağrıldı</option>
              <option value="yapildi">Yapıldı</option>
              <option value="iptal">İptal</option>
            </select>
          </div>
        )}

        {msg && (
          <div className={`rounded-lg p-2 text-xs ${msg.kind === "ok" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"}`}>
            {msg.text}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition active:scale-[0.98]"
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {mode === "edit" && initial?.status !== "iptal" && (
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="px-3 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 py-2.5 rounded-lg text-sm font-semibold transition"
            >
              İptal Et
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition text-sm"
      />
    </div>
  );
}
