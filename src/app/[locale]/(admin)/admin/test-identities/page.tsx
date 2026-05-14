"use client";

/**
 * Admin Test Identities — sahte phone yönetimi + WA simulation console.
 *
 * Standalone page (existing /admin/page.tsx ile aynı yapı). adminpanel.upudev.nl
 * domain'inden erişilir. API endpoint'leri requireAdminUser guard'ı çalıştırır.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Plus, Trash2, Loader2, X } from "lucide-react";

interface Identity {
  id: string;
  virtual_phone: string;
  display_name: string | null;
  target_tenant: string | null;
  notes: string | null;
  created_at: string;
}

interface CapturedMessage {
  kind: string;
  phone: string;
  body?: string;
  buttons?: Array<{ id: string; title: string }>;
  sections?: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
  url?: string;
  buttonLabel?: string;
  document?: { url: string; filename: string; caption?: string };
}

interface SimulateResult {
  success: boolean;
  webhook_status: number;
  webhook_error: string | null;
  captured_messages: CapturedMessage[];
  profiles_before: Array<{ id: string; tenant_id: string | null; role: string | null; created_at: string }>;
  profiles_after: Array<{ id: string; tenant_id: string | null; role: string | null; created_at: string }>;
}

const TENANT_OPTIONS = ["emlak", "bayi", "market", "otel", "restoran", "siteyonetim", "muhasebe"] as const;

export default function AdminTestIdentitiesPage() {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [phoneForm, setPhoneForm] = useState("");
  const [nameForm, setNameForm] = useState("");
  const [tenantForm, setTenantForm] = useState<string>("bayi");
  const [notesForm, setNotesForm] = useState("");
  const [creating, setCreating] = useState(false);

  // Simulate console
  const [selected, setSelected] = useState<Identity | null>(null);
  const [msgText, setMsgText] = useState("Üye olmak istiyorum");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimulateResult | null>(null);

  useEffect(() => {
    void fetchList();
  }, []);

  async function fetchList() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/admin/test-identities/list", { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Liste alınamadı.");
        return;
      }
      setIdentities(d.identities || []);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const r = await fetch("/api/admin/test-identities/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          virtual_phone: phoneForm.trim(),
          display_name: nameForm.trim() || null,
          target_tenant: tenantForm || null,
          notes: notesForm.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Kayıt başarısız.");
        return;
      }
      setPhoneForm("");
      setNameForm("");
      setNotesForm("");
      await fetchList();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu test identity silinsin mi?")) return;
    try {
      const r = await fetch("/api/admin/test-identities/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Silinemedi.");
        return;
      }
      if (selected?.id === id) setSelected(null);
      await fetchList();
    } catch {
      setError("Bağlantı hatası.");
    }
  }

  async function handleSimulate() {
    if (!selected || !msgText.trim()) return;
    setSimulating(true);
    setSimResult(null);
    try {
      const r = await fetch("/api/admin/test-identities/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          virtual_phone: selected.virtual_phone,
          message_text: msgText.trim(),
        }),
      });
      const d = (await r.json()) as SimulateResult;
      setSimResult(d);
    } catch {
      setError("Simulate çağrısı başarısız.");
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/tr/admin" className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">🧪 Test Hesapları</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sahte phone ile WA bot davranışı simulate et
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Yeni Test Phone */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Yeni Test Telefon
          </h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="tel"
              required
              placeholder="virtual_phone (örn 905566806263)"
              value={phoneForm}
              onChange={(e) => setPhoneForm(e.target.value)}
              pattern="[0-9]{6,15}"
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
            />
            <input
              type="text"
              placeholder="display_name (opsiyonel)"
              value={nameForm}
              onChange={(e) => setNameForm(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
            />
            <select
              value={tenantForm}
              onChange={(e) => setTenantForm(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
            >
              {TENANT_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={creating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {creating ? "Ekleniyor…" : "Ekle"}
            </button>
            <input
              type="text"
              placeholder="notes (opsiyonel)"
              value={notesForm}
              onChange={(e) => setNotesForm(e.target.value)}
              className="md:col-span-4 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
            />
          </form>
        </section>

        {/* Liste */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Test Identities ({identities.length})
          </h2>
          {loading ? (
            <p className="text-sm text-slate-500">Yükleniyor…</p>
          ) : identities.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz test telefon yok. Üstten ekle.</p>
          ) : (
            <div className="space-y-2">
              {identities.map((id) => (
                <div
                  key={id.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                    selected?.id === id.id
                      ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-400"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono text-sm text-slate-900 dark:text-white">{id.virtual_phone}</code>
                      {id.display_name && <span className="text-sm text-slate-600 dark:text-slate-300">— {id.display_name}</span>}
                      {id.target_tenant && (
                        <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                          {id.target_tenant}
                        </span>
                      )}
                    </div>
                    {id.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{id.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelected(id); setSimResult(null); }}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Mesaj Gönder
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(id.id)}
                    className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-700 dark:text-rose-400 text-xs font-semibold px-2 py-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Simulate Console */}
        {selected && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                💬 Simulate — {selected.virtual_phone}
                {selected.target_tenant && <span className="text-xs text-slate-500 ml-2">({selected.target_tenant})</span>}
              </h2>
              <button
                type="button"
                onClick={() => { setSelected(null); setSimResult(null); }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <textarea
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                rows={3}
                placeholder="Mesaj metni (örn. 'Üye olmak istiyorum' veya 'BAYI: merhaba')"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={handleSimulate}
                disabled={simulating || !msgText.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2"
              >
                {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                {simulating ? "Gönderiliyor…" : "Webhook'a Gönder"}
              </button>
            </div>

            {simResult && (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className={simResult.success ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                    {simResult.success ? "✓" : "✗"} webhook_status: <strong>{simResult.webhook_status}</strong>
                  </span>
                  {simResult.webhook_error && (
                    <span className="text-rose-700">error: {simResult.webhook_error}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-3">
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">profile (before)</p>
                    <pre className="text-[11px] whitespace-pre-wrap break-words text-slate-600 dark:text-slate-400">
{JSON.stringify(simResult.profiles_before, null, 2)}
                    </pre>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-3">
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">profile (after)</p>
                    <pre className="text-[11px] whitespace-pre-wrap break-words text-slate-600 dark:text-slate-400">
{JSON.stringify(simResult.profiles_after, null, 2)}
                    </pre>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs mb-2">
                    captured_messages ({simResult.captured_messages.length})
                  </p>
                  {simResult.captured_messages.length === 0 ? (
                    <p className="text-xs text-slate-500">(boş — bot bu mesaja cevap vermedi)</p>
                  ) : (
                    <div className="space-y-2">
                      {simResult.captured_messages.map((m, i) => (
                        <CapturedMessageView key={i} m={m} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function CapturedMessageView({ m }: { m: CapturedMessage }) {
  const kindBadge: Record<string, string> = {
    text: "bg-slate-200 dark:bg-slate-700",
    buttons: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
    list: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
    url_button: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    document: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    mark_read: "bg-slate-100 dark:bg-slate-800 text-slate-500",
    nav_footer: "bg-slate-100 dark:bg-slate-800 text-slate-500",
  };
  return (
    <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-mono ${kindBadge[m.kind] || "bg-slate-200"}`}>
          {m.kind}
        </span>
        <code className="font-mono text-slate-500">→ {m.phone}</code>
      </div>
      {m.body && (
        <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{m.body}</p>
      )}
      {m.buttons && (
        <div className="flex flex-wrap gap-1 mt-1">
          {m.buttons.map((b) => (
            <span key={b.id} className="inline-block bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 font-mono text-[10px]">
              {b.title} <span className="text-slate-400">({b.id})</span>
            </span>
          ))}
        </div>
      )}
      {m.sections && (
        <div className="mt-1 space-y-1">
          {m.sections.map((s, i) => (
            <div key={i}>
              <p className="font-semibold text-slate-600 dark:text-slate-400">{s.title}</p>
              {s.rows.map((r) => (
                <p key={r.id} className="ml-2 font-mono text-[10px]">
                  • {r.title} <span className="text-slate-400">({r.id})</span>
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
      {m.url && (
        <p className="mt-1">
          <span className="font-semibold">{m.buttonLabel}</span> →{" "}
          <span className="font-mono text-slate-500 break-all">{m.url}</span>
        </p>
      )}
      {m.document && (
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          📎 {m.document.filename}
        </p>
      )}
    </div>
  );
}
