"use client";

/**
 * /tr/panel-ayarlari — Emlak panel kişiselleştirme.
 *
 * Şu an: bottom tab bar 4 sekme özelleştirmesi.
 *   - Sidebar'daki 10 sektörel item arasından max 4 seç
 *   - localStorage `upu-bottom-tabs:emlak` → seçilen item id'leri
 *   - Kaydet → AdminLayout (panel)/layout.tsx mount'ta okur
 *   - Reset → varsayılan ilk 4 (panelim/mulkler/musteriler/sozlesme)
 *
 * Geleceğe açık: tema, font size, bildirim tercihleri burada toplanır.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "upu-bottom-tabs:emlak";
const MAX_TABS = 4;

type ItemDef = {
  id: string;
  label: string;
  icon: string;
};

// (panel)/layout.tsx'teki EMLAK_BOTTOM_TABS ve DEFAULT_SIDEBAR_ITEMS'le aynı set
const ALL_ITEMS: ItemDef[] = [
  { id: "panelim",    label: "Panelim",       icon: "🏠" },
  { id: "mulkler",    label: "Mülklerim",     icon: "🏢" },
  { id: "musteriler", label: "Müşterilerim",  icon: "👥" },
  { id: "sozlesme",   label: "Sözleşmelerim", icon: "📋" },
  { id: "sunumlar",   label: "Sunumlarım",    icon: "📊" },
  { id: "takip",      label: "Takiplerim",    icon: "🎯" },
  { id: "ara",        label: "Portföy Tara",  icon: "🔍" },
  { id: "takvim",     label: "Takvim",        icon: "📅" },
  { id: "profil",     label: "Profilim",      icon: "👤" },
  { id: "websitem",   label: "Web Sitem",     icon: "🌐" },
];

const DEFAULT_SELECTION = ["panelim", "mulkler", "musteriler", "sozlesme"];

export default function PanelAyarlariPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";

  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTION);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) {
          setSelected(arr.slice(0, MAX_TABS));
        }
      }
    } catch { /* sessizce yut */ }
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_TABS) return prev; // limit
      return [...prev, id];
    });
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
      setSavedAt(Date.now());
    } catch {
      // quota / private mode
    }
  }

  function reset() {
    setSelected(DEFAULT_SELECTION);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* yut */ }
    setSavedAt(Date.now());
  }

  const isFull = selected.length >= MAX_TABS;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-700 via-teal-700 to-stone-900 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">⚙️ Panel Ayarları</h1>
        <p className="text-emerald-100 text-sm mt-2 leading-relaxed">
          Panelinizi kendi günlük akışınıza göre özelleştirin.
        </p>
      </div>

      <section className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
          <h2 className="text-lg font-bold text-slate-900">Alt Sekme Çubuğu</h2>
          <span className="text-xs text-slate-500">{selected.length} / {MAX_TABS} sekme seçili</span>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          Mobil ekranınızın altındaki hızlı erişim sekmelerini seçin. En sık kullandığınız 4 sayfayı belirleyin —
          ayarladıktan sonra alt çubukta görünür olacak. Seçtiğiniz sıraya göre soldan sağa dizilir.
        </p>

        <div className="space-y-2">
          {ALL_ITEMS.map((item) => {
            const idx = selected.indexOf(item.id);
            const isSel = idx >= 0;
            const order = isSel ? idx + 1 : null;
            const disabled = !isSel && isFull;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                disabled={disabled}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                  isSel
                    ? "border-emerald-500 bg-emerald-50"
                    : disabled
                    ? "border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed"
                    : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50"
                }`}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="flex-1 font-medium text-slate-900">{item.label}</span>
                {isSel ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold">
                    {order}
                  </span>
                ) : (
                  <span className="text-slate-300 text-sm">○</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-5">
          <button
            type="button"
            onClick={save}
            disabled={selected.length === 0}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition"
          >
            💾 Kaydet
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-lg font-medium transition"
          >
            ↺ Varsayılana Dön
          </button>
        </div>

        {savedAt && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg px-3 py-2">
            ✅ Kaydedildi. Değişikliği görmek için panel sayfasını yenileyin.
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400 text-center px-4 leading-relaxed">
        Tercihleriniz bu cihazda kayıtlıdır (localStorage). Farklı bir cihazda tekrar ayarlamanız gerekir.
      </p>

      {token && (
        <a
          href={`/tr/panel?t=${encodeURIComponent(token)}`}
          className="block bg-slate-900 hover:bg-slate-800 text-white text-center py-3 rounded-xl font-medium transition"
        >
          ← Panele Dön
        </a>
      )}
    </div>
  );
}
