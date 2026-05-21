"use client";

/**
 * Otomatik Kampanya Yönetimi — Faz B 3.4.
 *
 * Kural listesi + "Yeni kural" form. 3 event type, 2 action type.
 * Idempotent çalıştırma — cron her saat tarama yapar.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Trigger {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  conditions: Record<string, unknown>;
  action_type: string;
  action_payload: Record<string, unknown>;
  cooldown_days: number;
  is_active: boolean;
  last_run_at: string | null;
  stats: { sent: number; skipped: number; failed: number };
}

const EVENT_OPTIONS = [
  { value: "orderless_n_days", label: "Sipariş atmadı (N gün)" },
  { value: "overdue_days",     label: "Vade gecikmesi (N gün)" },
  { value: "score_below",      label: "Performans skoru altında" },
];
const ACTION_OPTIONS = [
  { value: "wa_message",  label: "Bayiye WA mesajı" },
  { value: "admin_alert", label: "Admin'e uyarı" },
];

export default function BayiKampanyaOtomatikPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("orderless_n_days");
  const [eventValue, setEventValue] = useState("30");
  const [actionType, setActionType] = useState("admin_alert");
  const [actionTemplate, setActionTemplate] = useState("");
  const [cooldown, setCooldown] = useState("30");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    const r = await fetch(`/api/bayi-campaign-triggers/list${qs}`, { credentials: "same-origin" });
    const d = await r.json();
    if (r.ok) setTriggers(d.triggers || []);
    else setError(d.error || "Listelenemedi.");
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function saveTrigger() {
    if (name.trim().length < 2) { setError("İsim en az 2 karakter."); return; }
    const conditions = eventType === "score_below"
      ? { score: Number(eventValue) || 50 }
      : { days: Number(eventValue) || 30 };
    const action_payload = actionType === "wa_message"
      ? { template: actionTemplate.trim() || undefined }
      : {};
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/bayi-campaign-triggers/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          token: token || undefined,
          name: name.trim(),
          event_type: eventType,
          conditions,
          action_type: actionType,
          action_payload,
          cooldown_days: Number(cooldown) || 30,
          is_active: true,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Kayıt başarısız."); return; }
      setName(""); setEventValue("30"); setActionTemplate(""); setShowForm(false);
      await load();
    } finally { setSaving(false); }
  }

  async function toggle(id: string, active: boolean) {
    await fetch("/api/bayi-campaign-triggers/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token: token || undefined, id, is_active: active }),
    });
    await load();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">⚡ Otomatik Kampanya</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Trigger + condition + action — sistem yıl boyu çalışsın.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
        >
          {showForm ? "Kapat" : "+ Yeni Kural"}
        </button>
      </header>

      {error && <div className="mb-3 bg-rose-50 border border-rose-200 rounded-lg p-2 text-xs text-rose-700">⚠️ {error}</div>}

      {showForm && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-4 mb-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Kural Adı</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" placeholder="Örn: 30g sipariş atmayan bayilere uyarı" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Olay</span>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800">
                {EVENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {eventType === "score_below" ? "Skor eşiği (0-100)" : "Gün sayısı"}
              </span>
              <input type="number" value={eventValue} onChange={(e) => setEventValue(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Aksiyon</span>
              <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800">
                {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Cooldown (gün)</span>
              <input type="number" value={cooldown} onChange={(e) => setCooldown(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
            </label>
          </div>
          {actionType === "wa_message" && (
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Mesaj şablonu (opsiyonel — boşsa default)</span>
              <textarea value={actionTemplate} onChange={(e) => setActionTemplate(e.target.value)} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" placeholder="Merhaba {{dealer_name}}, kampanyamız sizin için aktif…" />
            </label>
          )}
          <button onClick={() => void saveTrigger()} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 rounded-lg font-medium disabled:opacity-50">
            {saving ? "Kaydediliyor…" : "Kuralı Kaydet"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-slate-500 py-6">Yükleniyor…</div>
      ) : triggers.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-8 text-center">
          <div className="text-4xl mb-2">⚡</div>
          <p className="text-sm text-slate-500">Henüz kural yok. &quot;+ Yeni Kural&quot; ile ekle.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {triggers.map(t => {
            const ev = EVENT_OPTIONS.find(o => o.value === t.event_type)?.label || t.event_type;
            const ac = ACTION_OPTIONS.find(o => o.value === t.action_type)?.label || t.action_type;
            const cond = t.event_type === "score_below" ? `< ${t.conditions.score}` : `${t.conditions.days} gün`;
            return (
              <div key={t.id} className={`bg-white dark:bg-slate-800 border rounded-xl p-3 ${t.is_active ? "border-slate-200 dark:border-slate-800/50" : "border-slate-100 opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{t.name}</h3>
                      {!t.is_active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Pasif</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      <strong>{ev}</strong> ({cond}) → <strong>{ac}</strong> · cooldown {t.cooldown_days}g
                    </p>
                    <div className="text-[11px] text-slate-400 mt-1 flex gap-3">
                      <span>✅ {t.stats.sent} gönderildi</span>
                      {t.stats.skipped > 0 && <span>⏭ {t.stats.skipped} atlandı</span>}
                      {t.stats.failed > 0 && <span className="text-rose-500">✗ {t.stats.failed} başarısız</span>}
                      {t.last_run_at && <span>· son {new Date(t.last_run_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => void toggle(t.id, !t.is_active)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium ${t.is_active ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                  >
                    {t.is_active ? "Duraklat" : "Aktive et"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-400 text-center mt-4">
        Cron her saat tarama yapar — &quot;Sipariş atmadı&quot; ve &quot;Vade&quot; eventları gerçek-zamanlıya yakın çalışır.
      </p>
    </div>
  );
}
