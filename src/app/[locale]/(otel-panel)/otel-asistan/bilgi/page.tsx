"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, Plus, X, Loader2, Trash2, Pencil, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface Item {
  id: string;
  category: string;
  title: string;
  content: string;
  sort_order: number;
  is_active: boolean;
}

const CATEGORY_LABEL: Record<string, string> = {
  general:   "Genel",
  rules:     "Kurallar",
  amenities: "Olanaklar",
  location:  "Konum / Çevre",
  faq:       "Sık Sorulan",
  rooms:     "Oda Detayları",
};

export default function BilgiBankasiPage() {
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token");
  const [items, setItems] = useState<Item[] | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/agent-knowledge${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .catch(() => setItems([]));
  };

  useEffect(reload, [token]);

  const remove = async (id: string) => {
    if (!confirm("Bu bilgi kaydı silinsin mi?")) return;
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    await fetch(`/api/otel-panel/agent-knowledge/${id}${qs}`, { method: "DELETE", credentials: "same-origin" });
    reload();
  };

  const toggleActive = async (item: Item) => {
    const body: any = { is_active: !item.is_active };
    if (token) body.token = token;
    await fetch(`/api/otel-panel/agent-knowledge/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      credentials: "same-origin", body: JSON.stringify(body),
    });
    reload();
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/tr/otel-asistan${token ? `?t=${encodeURIComponent(token)}` : ""}`}
          className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-emerald-600">
          <ChevronLeft className="w-3 h-3" /> AI Asistan
        </Link>
      </div>

      <HeroBanner
        title="Bilgi Bankası"
        subtitle="Otelinizi AI'a tanıtın. Eklediğiniz başlıklar her chat sorusunda AI'ın prompt'una eklenir. Misafire/yoruma yanıt yazarken bu bilgileri kullanır."
        Icon={BookOpen}
      />

      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm">
          <Plus className="w-4 h-4" /> Yeni Bilgi
        </button>
      </div>

      {error && <div className="bg-rose-50 dark:bg-rose-950/30 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{error}</div>}

      {items === null && (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-20" />)}</div>
      )}

      {items?.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-8 text-center shadow-sm">
          <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" strokeWidth={1.8} />
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Henüz bilgi eklenmedi.</p>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            "Check-in saati", "Kahvaltı saatleri", "Evcil hayvan politikası" gibi başlıklarla başlayın.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3 shadow-sm ${!item.is_active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {CATEGORY_LABEL[item.category] || item.category}
                    </span>
                    {!item.is_active && <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">Pasif</span>}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-3">{item.content}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => setEditing(item)}
                    className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => toggleActive(item)}
                    className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                    title={item.is_active ? "Pasifleştir" : "Aktifleştir"}>
                    {item.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                  <button onClick={() => remove(item.id)}
                    className="p-1.5 rounded bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAdd || editing) && (
        <ItemModal token={token} item={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { setShowAdd(false); setEditing(null); reload(); }} />
      )}
    </div>
  );
}

function ItemModal({ token, item, onClose, onSaved }: {
  token: string | null;
  item: Item | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(item?.category || "general");
  const [title, setTitle] = useState(item?.title || "");
  const [content, setContent] = useState(item?.content || "");
  const [sortOrder, setSortOrder] = useState(item?.sort_order ?? 100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: any = { category, title: title.trim(), content: content.trim(), sort_order: sortOrder };
      if (token) body.token = token;
      const url = item ? `/api/otel-panel/agent-knowledge/${item.id}` : `/api/otel-panel/agent-knowledge`;
      const r = await fetch(url, {
        method: item ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{item ? "Bilgi Düzenle" : "Yeni Bilgi"}</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Kategori</span>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Sıra</span>
            <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Başlık *</span>
          <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Örn: Kahvaltı saatleri" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">İçerik *</span>
          <textarea required value={content} onChange={e => setContent(e.target.value)} rows={6}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="07:30 — 10:30 arası açık büfe, vejetaryen ve glütensiz seçenekler hazırdır..." />
        </label>
        {error && <div className="bg-rose-50 dark:bg-rose-950/30 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{error}</div>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200">İptal</button>
          <button type="submit" disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}
