"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { whatsappDeeplink } from "@/lib/whatsapp-deeplink";

const BOT_WA_NUMBER = "31644967207";

interface CustomerItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  looking_for: string[];
  property_type: string[] | null;
  rooms: string | null;
  budget_min: number | null;
  budget_max: number | null;
  location: string | null;
  notes: string | null;
  status: string | null;
  pipeline_stage: string | null;
  created_at: string;
}

type Status = "loading" | "ready" | "error";

const PT_LABELS: Record<string, string> = {
  daire: "Daire", villa: "Villa", arsa: "Arsa", mustakil: "Müstakil",
  rezidans: "Rezidans", yazlik: "Yazlık", dukkan: "Dükkan", buro_ofis: "Büro/Ofis",
};

function fmtBudget(min: number | null, max: number | null): string {
  if (!min && !max) return "";
  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)} ₺`;
  if (max) return `≤ ${fmt(max)} ₺`;
  return `≥ ${fmt(min!)} ₺`;
}

function lookingForLabel(arr: string[]): string {
  const labels = arr.map(t => t === "satilik" ? "Satılık" : t === "kiralik" ? "Kiralık" : t);
  return labels.join(" + ") || "—";
}

export default function MusterilerimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<CustomerItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/musterilerim/init?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setItems(d.customers || []);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" adlı müşteriyi silmek istediğinize emin misiniz? Geri almak için destek ile iletişime geçmeniz gerekir.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch("/api/musterilerim/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, customer_id: id }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "Silinemedi.");
      } else {
        setItems((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      alert("Bağlantı hatası.");
    } finally {
      setDeletingId(null);
    }
  }

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-emerald-700 to-teal-900 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">👥</div>
          <h1 className="text-xl font-bold">Müşterilerim</h1>
          <p className="text-emerald-200 text-sm mt-1">{items.length} müşteri</p>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm shadow-sm">
            Henüz müşteri eklemediniz. WhatsApp&apos;tan &quot;Müşteri Ekle&quot; komutunu kullanın.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((c) => {
              const lf = lookingForLabel(c.looking_for);
              const pt = (c.property_type || []).map(t => PT_LABELS[t] || t).join(", ");
              const budget = fmtBudget(c.budget_min, c.budget_max);
              return (
                <div key={c.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-semibold text-slate-900 leading-tight flex-1">{c.name}</h3>
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full whitespace-nowrap">{lf}</span>
                    </div>
                    {c.phone && <div className="text-sm text-slate-600">📱 {c.phone}</div>}
                    {(pt || c.rooms) && (
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-2">
                        {pt && <span>🏠 {pt}</span>}
                        {c.rooms && <span>🛏 {c.rooms}</span>}
                      </div>
                    )}
                    {budget && <div className="text-sm font-semibold text-stone-900 mt-1">💰 {budget}</div>}
                    {c.location && <div className="text-xs text-slate-500 mt-0.5">📍 {c.location}</div>}
                    {c.notes && <div className="text-xs text-slate-400 mt-1.5 italic line-clamp-2">{c.notes}</div>}
                  </div>
                  <div className="border-t border-slate-100 grid grid-cols-2">
                    <a
                      href={`/tr/musteri-ekle-form?id=${c.id}&t=${token || ""}`}
                      className="flex items-center justify-center gap-1 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 transition"
                    >
                      ✏️ Düzenle
                    </a>
                    <button
                      onClick={() => void handleDelete(c.id, c.name)}
                      disabled={deletingId === c.id}
                      className="flex items-center justify-center gap-1 py-3 text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition border-l border-slate-100 disabled:opacity-50"
                    >
                      🗑️ {deletingId === c.id ? "Siliniyor..." : "Sil"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <a
          href={whatsappDeeplink(BOT_WA_NUMBER)}
          className="block w-full mt-6 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-semibold text-base shadow-lg text-center active:scale-95"
        >
          💬 WhatsApp&apos;a Dön
        </a>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
