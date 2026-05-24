"use client";

/**
 * Bayi'nin vitrininden gelen lead'leri yönet — Faz C 3.5.
 * Sekmeler: Yeni / İletişimde / Dönüşmüş / Reddedildi / Tümü.
 * Aksiyonlar: İletişim kuruldu / Siparişe dönüştür / Reddet.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

interface Lead {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_message: string | null;
  items: Array<{ product_name?: string; quantity?: number; unit_price?: number }> | null;
  est_total: number | null;
  currency: string | null;
  status: string;
  source: string | null;
  converted_order_id: string | null;
  created_at: string;
  contacted_at: string | null;
  converted_at: string | null;
  rejected_at: string | null;
  notes: string | null;
}

const TABS = [
  { id: "new", label: "Yeni", color: "rose" },
  { id: "contacted", label: "İletişimde", color: "amber" },
  { id: "converted", label: "Dönüşmüş", color: "emerald" },
  { id: "rejected", label: "Reddedildi", color: "slate" },
  { id: "all", label: "Tümü", color: "indigo" },
];

export default function BayiMusteriTalepleriPage() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const [tab, setTab] = useState("new");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ status: tab, limit: "100" });
    if (token) qs.set("t", token);
    const r = await fetch(`/api/bayi-vitrine/leads/list?${qs}`, { credentials: "same-origin" });
    const d = await r.json();
    if (r.ok) {
      setLeads(d.leads || []);
      setCounts(d.counts || {});
    }
    setLoading(false);
  }, [tab, token]);

  useEffect(() => { void load(); }, [load]);

  async function act(id: string, action: "contact" | "convert" | "reject") {
    if (action === "reject" && !confirm("Bu talebi reddetmek istediğinize emin misiniz?")) return;
    setActing(id);
    const r = await fetch("/api/bayi-vitrine/leads/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token: token || undefined, id, action }),
    });
    const d = await r.json();
    setActing(null);
    if (!r.ok) {
      alert(d.error || "İşlem başarısız.");
      return;
    }
    if (action === "convert" && d.converted_order_id) {
      const target = `/tr/bayi-siparislerim`;
      window.location.href = token ? `${target}?t=${encodeURIComponent(token)}` : target;
      return;
    }
    await load();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">📥 Müşteri Talepleri</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Vitrin sayfandan gelen sipariş talepleri.
        </p>
      </header>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {TABS.map(t => {
          const count = t.id === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[t.id] || 0);
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${tab === t.id ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-800 border border-slate-200 text-slate-700"}`}>
              {t.label} {count > 0 ? <span className="ml-1 opacity-70">({count})</span> : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center text-sm text-slate-500 py-6">Yükleniyor…</div>
      ) : leads.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl">
          <EmptyState
            icon={Inbox}
            title="Henüz müşteri talebi yok"
            description="Vitrinini paylaş → müşterilerin sana sipariş talebi göndersin. Talepler buradan onay/dönüşüme çevrilir."
            cta={{ label: "Vitrinime git", href: "/tr/bayi-vitrinim" }}
            secondary={{ label: "Vitrin nasıl çalışır?", href: "/tr/bayi-vitrinim" }}
            accent="indigo"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map(l => (
            <article key={l.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{l.customer_name}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {l.customer_phone && <span>📞 {l.customer_phone}</span>}
                    {l.customer_phone && l.customer_email && " · "}
                    {l.customer_email && <span>✉ {l.customer_email}</span>}
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>

              {l.customer_message && (
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 italic">"{l.customer_message}"</p>
              )}

              {l.items && l.items.length > 0 && (
                <ul className="text-xs text-slate-600 dark:text-slate-400 mb-3 space-y-0.5">
                  {l.items.map((it, i) => (
                    <li key={i}>• {it.quantity}× {it.product_name} {it.unit_price ? `(₺${Number(it.unit_price).toLocaleString("tr-TR")})` : ""}</li>
                  ))}
                </ul>
              )}

              {l.est_total && (
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
                  Tahmini: ₺{Number(l.est_total).toLocaleString("tr-TR")}
                </div>
              )}

              {l.status === "new" || l.status === "contacted" ? (
                <div className="flex gap-1.5 flex-wrap">
                  {l.status === "new" && (
                    <button onClick={() => void act(l.id, "contact")} disabled={acting === l.id}
                      className="text-xs px-3 py-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium disabled:opacity-50">
                      İletişim kurdum
                    </button>
                  )}
                  <button onClick={() => void act(l.id, "convert")} disabled={acting === l.id}
                    className="text-xs px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50">
                    Siparişe dönüştür
                  </button>
                  <button onClick={() => void act(l.id, "reject")} disabled={acting === l.id}
                    className="text-xs px-3 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium disabled:opacity-50">
                    Reddet
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Durum: <span className="font-medium">{l.status}</span>
                  {l.converted_order_id && (
                    <a href={`/tr/bayi-siparislerim${token ? `?t=${encodeURIComponent(token)}` : ""}`}
                      className="ml-2 text-indigo-600 hover:underline">→ siparişi gör</a>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
