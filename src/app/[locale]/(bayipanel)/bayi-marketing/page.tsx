"use client";

/**
 * Drip Marketing Automation — Faz C 3.6.
 * Liste + 5-step wizard. Admin-only.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface DripStats { active: number; completed: number; total: number }
interface Campaign {
  id: string;
  name: string;
  description: string | null;
  audience: { kind: string; days?: number; value?: number };
  channel: string;
  is_active: boolean;
  enrollment_mode: string;
  step_count: number;
  stats: DripStats;
  created_at: string;
}

const AUDIENCE_PRESETS: Array<{ id: string; label: string; defaultParams?: Record<string, number> }> = [
  { id: "all", label: "Tüm aktif bayiler" },
  { id: "inactive_days", label: "N gün sipariş vermeyenler", defaultParams: { days: 30 } },
  { id: "score_below", label: "Skoru N altında", defaultParams: { value: 50 } },
  { id: "overdue", label: "Vadesi geçenler" },
  { id: "new_dealer_days", label: "Son N gün yeni bayi", defaultParams: { days: 7 } },
];

interface StepDraft {
  step_order: number;
  delay_days: number;
  subject: string;
  body: string;
}

const DEFAULT_STEPS: StepDraft[] = [
  { step_order: 1, delay_days: 0, subject: "", body: "" },
];

export default function BayiMarketingPage() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    audience_kind: "all",
    audience_param: 30,
    enrollment_mode: "manual",
    is_active: false,
  });
  const [steps, setSteps] = useState<StepDraft[]>(DEFAULT_STEPS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    const r = await fetch(`/api/bayi-drip/list${qs}`, { credentials: "same-origin" });
    const d = await r.json();
    if (r.ok) setCampaigns(d.campaigns || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "", audience_kind: "all", audience_param: 30, enrollment_mode: "manual", is_active: false });
    setSteps([{ step_order: 1, delay_days: 0, subject: "", body: "" }]);
    setError(null);
    setEditorOpen(true);
  }

  function addStep() {
    setSteps(s => [...s, { step_order: s.length + 1, delay_days: 3, subject: "", body: "" }]);
  }
  function removeStep(idx: number) {
    setSteps(s => s.filter((_, i) => i !== idx).map((st, i) => ({ ...st, step_order: i + 1 })));
  }
  function updateStep(idx: number, patch: Partial<StepDraft>) {
    setSteps(s => s.map((st, i) => i === idx ? { ...st, ...patch } : st));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const audience: { kind: string; days?: number; value?: number } = { kind: form.audience_kind };
    if (form.audience_kind === "inactive_days" || form.audience_kind === "new_dealer_days") {
      audience.days = Number(form.audience_param) || 30;
    } else if (form.audience_kind === "score_below") {
      audience.value = Number(form.audience_param) || 50;
    }

    const r = await fetch("/api/bayi-drip/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        token: token || undefined,
        id: editing?.id,
        name: form.name,
        description: form.description,
        audience,
        channel: "whatsapp",
        enrollment_mode: form.enrollment_mode,
        is_active: form.is_active,
        steps: steps.filter(s => s.body.trim()),
      }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(d.error || "Kayıt başarısız.");
      return;
    }
    setEditorOpen(false);
    await load();
  }

  async function toggle(id: string, isActive: boolean) {
    await fetch("/api/bayi-drip/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token: token || undefined, id, is_active: isActive }),
    });
    await load();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">📨 Marketing Automation</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Drip dizileri — onboarding, churn recovery, upsell.
          </p>
        </div>
        <button onClick={openNew}
          className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-medium">
          + Yeni Drip
        </button>
      </header>

      {loading ? (
        <div className="text-center text-sm text-slate-500 py-6">Yükleniyor…</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-8 text-center">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm text-slate-500">Henüz drip kampanyası yok.</p>
          <button onClick={openNew} className="mt-3 text-sm text-indigo-600 hover:underline">İlkini oluştur →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map(c => (
            <article key={c.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</h3>
                  {c.description && <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>}
                </div>
                <button onClick={() => void toggle(c.id, !c.is_active)}
                  className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {c.is_active ? "● Aktif" : "○ Pasif"}
                </button>
              </div>
              <div className="flex gap-3 text-[11px] text-slate-500 mt-2">
                <span>{c.step_count} adım</span>
                <span>·</span>
                <span>{c.stats.active} aktif</span>
                <span>·</span>
                <span>{c.stats.completed} tamamlandı</span>
                <span>·</span>
                <span>{c.enrollment_mode}</span>
                <span>·</span>
                <span>audience: {c.audience.kind}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-3" onClick={() => setEditorOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
              {editing ? "Drip Düzenle" : "Yeni Drip Kampanyası"}
            </h2>

            <div className="space-y-3">
              <Field label="Kampanya adı *">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Yeni bayi onboarding"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
              </Field>

              <Field label="Açıklama">
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
              </Field>

              <Field label="Hedef kitle">
                <select value={form.audience_kind}
                  onChange={e => setForm({ ...form, audience_kind: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                  {AUDIENCE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                {["inactive_days", "score_below", "new_dealer_days"].includes(form.audience_kind) && (
                  <input type="number" value={form.audience_param}
                    onChange={e => setForm({ ...form, audience_param: Number(e.target.value) })}
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    placeholder={form.audience_kind === "score_below" ? "Skor eşiği (örn 50)" : "Gün (örn 30)"} />
                )}
              </Field>

              <Field label="Enrollment modu">
                <select value={form.enrollment_mode}
                  onChange={e => setForm({ ...form, enrollment_mode: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <option value="manual">Manuel (admin enroll eder)</option>
                  <option value="auto">Otomatik (segment'e uyanları cron enroll eder)</option>
                </select>
              </Field>

              <div className="border-t border-slate-200 dark:border-slate-700/50 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mesaj adımları</h3>
                  <button onClick={addStep} className="text-xs text-indigo-600 hover:underline">+ Adım ekle</button>
                </div>

                <div className="space-y-2">
                  {steps.map((s, idx) => (
                    <div key={idx} className="border border-slate-200 dark:border-slate-700/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-500">#{idx + 1}</span>
                        {steps.length > 1 && (
                          <button onClick={() => removeStep(idx)} className="text-xs text-rose-600 hover:underline">Kaldır</button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Gecikme (gün)">
                          <input type="number" min={0} value={s.delay_days}
                            onChange={e => updateStep(idx, { delay_days: Number(e.target.value) })}
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm" />
                        </Field>
                        <Field label="Başlık">
                          <input value={s.subject}
                            onChange={e => updateStep(idx, { subject: e.target.value })}
                            placeholder="(opsiyonel)"
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm" />
                        </Field>
                      </div>
                      <Field label="Mesaj">
                        <textarea value={s.body}
                          onChange={e => updateStep(idx, { body: e.target.value })}
                          rows={3}
                          placeholder="Merhaba {{dealer_name}}, kampanyamız başladı..."
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm resize-none" />
                      </Field>
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                Aktif (cron tarafından çalıştırılır)
              </label>
            </div>

            {error && <div className="text-xs text-rose-600 mt-3">{error}</div>}

            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditorOpen(false)}
                className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium">İptal</button>
              <button onClick={() => void save()} disabled={saving || !form.name}
                className="flex-1 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-3 py-2 text-sm font-medium">
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</span>
      {children}
    </label>
  );
}
