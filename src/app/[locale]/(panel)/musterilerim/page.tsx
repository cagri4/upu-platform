"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Phone,
  MapPin,
  Wallet,
  Home,
  AlertTriangle,
} from "lucide-react";
import { ReturnButtons } from "@/components/return-buttons";
import { LoadingState } from "@/components/banking";

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
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<CustomerItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("tr");
    if (!q) return items;
    return items.filter((c) =>
      (c.name || "").toLocaleLowerCase("tr").includes(q) ||
      (c.phone || "").toLocaleLowerCase("tr").includes(q) ||
      (c.location || "").toLocaleLowerCase("tr").includes(q),
    );
  }, [items, searchQuery]);

  useEffect(() => {
    fetch(`/api/musterilerim/init?t=${encodeURIComponent(token)}`, { credentials: "same-origin" })
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

  if (status === "loading") return <LoadingState />;
  if (status === "error") {
    return (
      <Center>
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Hata</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
        <a
          href={`https://wa.me/${BOT_WA_NUMBER}`}
          className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition"
        >
          WhatsApp&apos;a dön
        </a>
      </Center>
    );
  }

  return (
    <div className="pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Müşterilerim</h1>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          {items.length} kayıt
        </span>
      </div>

      {/* Primary action — fresh-mint magic link via /api/panel/start (cookie-aware) */}
      <a
        href={`/api/panel/start?cmd=musteriEkle&t=${encodeURIComponent(token || "")}`}
        className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
        Müşteri Ekle
      </a>

      {items.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Müşteri ara (isim, telefon, bölge)"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 shadow-sm"
            aria-label="Müşteri ara"
          />
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <Users className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" strokeWidth={1.8} />
          <p className="font-semibold text-slate-900 dark:text-white mb-1">Henüz müşteri yok</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">İlk müşterinizi eklemek için yukarıdaki butonu kullanın.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Eşleşen müşteri bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const lf = lookingForLabel(c.looking_for);
            const pt = (c.property_type || []).map(t => PT_LABELS[t] || t).join(", ");
            const budget = fmtBudget(c.budget_min, c.budget_max);
            const initials = (c.name || "?").trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("");
            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 overflow-hidden"
              >
                <div className="p-4 flex gap-3">
                  <div className="w-11 h-11 flex-shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-semibold text-sm">
                    {initials || <Users className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">{c.name}</h3>
                      <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
                        {lf}
                      </span>
                    </div>
                    {c.phone && (
                      <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} /> {c.phone}
                      </div>
                    )}
                    {(pt || c.rooms) && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-2 items-center">
                        {pt && (
                          <span className="flex items-center gap-1">
                            <Home className="w-3 h-3" strokeWidth={2} /> {pt}
                          </span>
                        )}
                        {c.rooms && <span>{c.rooms}</span>}
                      </div>
                    )}
                    {budget && (
                      <div className="font-semibold text-slate-900 dark:text-white mt-1 text-sm flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" strokeWidth={2} />
                        {budget}
                      </div>
                    )}
                    {c.location && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={2} /> {c.location}
                      </div>
                    )}
                    {c.notes && (
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 italic line-clamp-2">{c.notes}</div>
                    )}
                  </div>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 grid grid-cols-2">
                  <a
                    href={`/tr/musteri-ekle-form?id=${c.id}&t=${token || ""}`}
                    className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition"
                  >
                    <Pencil className="w-4 h-4" strokeWidth={2.2} />
                    Düzenle
                  </a>
                  <button
                    onClick={() => void handleDelete(c.id, c.name)}
                    disabled={deletingId === c.id}
                    className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:bg-rose-100 transition border-l border-slate-100 dark:border-slate-800 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={2.2} />
                    {deletingId === c.id ? "..." : "Sil"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ReturnButtons token={token} botPhone={BOT_WA_NUMBER} />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        {children}
      </div>
    </div>
  );
}
