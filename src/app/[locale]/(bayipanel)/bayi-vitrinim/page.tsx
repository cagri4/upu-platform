"use client";

/**
 * Bayi vitrin editör — Faz C 3.5.
 * Bayinin mini-katalog konfigürasyonu: slug, başlık, renk, görünür ürünler.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Vitrine {
  id: string;
  slug: string;
  title: string | null;
  subtitle: string | null;
  logo_url: string | null;
  accent_color: string;
  is_active: boolean;
  show_prices: boolean;
  visible_product_ids: string[] | null;
  view_count: number;
  lead_count: number;
  conversion_count: number;
}

export default function BayiVitrinimPage() {
  const params = useSearchParams();
  const token = params.get("t") || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vitrine, setVitrine] = useState<Vitrine | null>(null);
  const [suggestedSlug, setSuggestedSlug] = useState<string | null>(null);
  const [form, setForm] = useState({
    slug: "",
    title: "",
    subtitle: "",
    accent_color: "#4f46e5",
    is_active: true,
    show_prices: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    const r = await fetch(`/api/bayi-vitrine/get${qs}`, { credentials: "same-origin" });
    const d = await r.json();
    if (r.ok) {
      if (d.vitrine) {
        setVitrine(d.vitrine);
        setForm({
          slug: d.vitrine.slug,
          title: d.vitrine.title || "",
          subtitle: d.vitrine.subtitle || "",
          accent_color: d.vitrine.accent_color || "#4f46e5",
          is_active: d.vitrine.is_active,
          show_prices: d.vitrine.show_prices,
        });
      } else {
        setSuggestedSlug(d.suggested_slug || null);
        setForm(f => ({ ...f, slug: d.suggested_slug || "" }));
      }
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const r = await fetch("/api/bayi-vitrine/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token: token || undefined, ...form }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(d.error || "Kayıt başarısız.");
      return;
    }
    setSuccess("Vitrin güncellendi.");
    await load();
  }

  const publicUrl = form.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/tr/v/${form.slug}`
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">🏪 Vitrinim</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Müşterilerin sipariş talep edebileceği mini-katalog.
        </p>
      </header>

      {loading ? (
        <div className="text-center text-sm text-slate-500 py-6">Yükleniyor…</div>
      ) : (
        <>
          {vitrine && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Görüntülenme" value={vitrine.view_count} />
              <Stat label="Talep" value={vitrine.lead_count} />
              <Stat label="Dönüşüm" value={vitrine.conversion_count} />
            </div>
          )}

          {publicUrl && form.slug && (
            <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm">
              <div className="text-xs text-slate-600 mb-1">Vitrin linkin:</div>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                className="font-mono text-indigo-700 break-all">
                {publicUrl}
              </a>
            </div>
          )}

          <div className="space-y-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
            <Field label={`Slug (vitrine linki: /v/${form.slug || "..."})`}>
              <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
                placeholder={suggestedSlug || "ornek-magaza"}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </Field>

            <Field label="Başlık">
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Mağaza adı"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </Field>

            <Field label="Alt başlık (slogan/açıklama)">
              <input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                placeholder="2025'in en iyi fiyatları"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </Field>

            <Field label="Vurgu rengi">
              <input type="color" value={form.accent_color}
                onChange={e => setForm({ ...form, accent_color: e.target.value })}
                className="w-16 h-9 rounded border border-slate-200" />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              Vitrin aktif (kapalıysa public sayfa 404 verir)
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.show_prices}
                onChange={e => setForm({ ...form, show_prices: e.target.checked })} />
              Fiyatları göster
            </label>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={() => void save()} disabled={saving || !form.slug}
              className="rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2 text-sm font-medium">
              {saving ? "Kaydediliyor…" : vitrine ? "Güncelle" : "Vitrin Oluştur"}
            </button>
            {publicUrl && form.slug && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                className="rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 text-sm font-medium">
                Önizle
              </a>
            )}
          </div>

          {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
          {success && <div className="mt-3 text-sm text-emerald-600">{success}</div>}
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800 p-3 text-center">
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
