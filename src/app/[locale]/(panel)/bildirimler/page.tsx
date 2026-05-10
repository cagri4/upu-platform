"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  NOTIFICATION_TYPES,
  CATEGORY_META,
  PRESETS,
  type NotificationCategory,
  type PresetName,
} from "@/platform/notifications/types";

interface Pref {
  type: string;
  enabled: boolean;
}

interface Dnd {
  enabled?: boolean;
  start?: string;
  end?: string;
  timezone?: string;
}

type Status = "loading" | "ready" | "saving" | "error";

export default function BildirimlerPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [tier, setTier] = useState<"free" | "pro">("free");
  const [prefs, setPrefs] = useState<Map<string, boolean>>(new Map());
  const [preset, setPreset] = useState<PresetName>("ozel");
  const [dnd, setDnd] = useState<Dnd>({ enabled: false, start: "23:00", end: "08:00" });
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const tokenQs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/bildirimler/init${tokenQs}`, { credentials: "same-origin" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Yüklenemedi."); return; }
        const m = new Map<string, boolean>();
        for (const p of d.preferences || []) m.set(p.type, !!p.enabled);
        setPrefs(m);
        setTier(d.tier || "free");
        setPreset(d.preset || "ozel");
        if (d.dnd) setDnd(d.dnd);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  const grouped = useMemo(() => {
    const map = new Map<NotificationCategory, typeof NOTIFICATION_TYPES>();
    for (const t of NOTIFICATION_TYPES) {
      const list = map.get(t.category) || [];
      list.push(t);
      map.set(t.category, list);
    }
    return map;
  }, []);

  function toggle(type: string, enabled: boolean) {
    setPrefs(prev => {
      const m = new Map(prev);
      m.set(type, enabled);
      return m;
    });
    setPreset("ozel"); // herhangi bir manual değişim → preset "özel"e düşer
  }

  function applyPreset(name: PresetName) {
    setPreset(name);
    if (name === "ozel") return;
    const enabledSet = new Set<string>(PRESETS[name]);
    const m = new Map<string, boolean>();
    for (const t of NOTIFICATION_TYPES) {
      // Free user pro türleri açamaz — preset Pro tipini açıyorsa Free user için kapalı tut
      const wantsEnable = enabledSet.has(t.type);
      const allowed = tier === "pro" || t.tier === "free";
      m.set(t.type, wantsEnable && allowed);
    }
    setPrefs(m);
  }

  async function save() {
    setStatus("saving");
    setError("");
    try {
      const body = {
        token: token || undefined,
        preferences: Array.from(prefs.entries()).map(([type, enabled]) => ({ type, enabled })),
        dnd,
        preset,
      };
      const res = await fetch("/api/bildirimler/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("ready"); setError(d.error || "Kaydedilemedi."); return; }
      setStatus("ready");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      setStatus("ready");
      setError("Bağlantı hatası.");
    }
  }

  if (status === "loading") return <Center>⏳ Yükleniyor...</Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <p className="text-slate-600 text-sm">{error}</p>
  </Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <div className="max-w-md mx-auto p-4 space-y-5">
        {/* Hero */}
        <div className="bg-gradient-to-br from-yellow-500 to-amber-600 text-white rounded-2xl p-5">
          <div className="text-3xl mb-1">🔔</div>
          <h1 className="text-xl font-bold">Bildirimler</h1>
          <p className="text-amber-100 text-sm mt-1">Hangi bildirimleri WhatsApp&apos;tan almak istediğini seç.</p>
          {tier === "free" && (
            <p className="text-xs text-amber-200 mt-2">
              Pro üyelik ile 19 ek bildirim açılabilir.
            </p>
          )}
        </div>

        {/* Preset selector */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Hızlı Seçim</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(["yogun", "kritik", "sessiz", "ozel"] as PresetName[]).map(name => (
              <button
                key={name}
                type="button"
                onClick={() => applyPreset(name)}
                className={`py-2.5 rounded-lg text-sm font-medium border-2 ${preset === name ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-700 border-slate-300"}`}
              >
                {PRESET_LABELS[name]}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">{PRESET_DESCRIPTIONS[preset]}</p>
        </section>

        {/* Toggle list grouped by category */}
        {Array.from(grouped.entries()).map(([cat, items]) => (
          <section key={cat} className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span>{CATEGORY_META[cat].icon}</span>
              {CATEGORY_META[cat].label}
            </p>
            <div className="space-y-3">
              {items.map(t => {
                const isProLocked = t.tier === "pro" && tier === "free";
                const enabled = prefs.get(t.type) ?? false;
                return (
                  <div key={t.type} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${isProLocked ? "text-slate-400" : "text-slate-900"}`}>
                          {t.label}
                        </span>
                        {t.tier === "pro" && (
                          <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${isProLocked ? "bg-slate-200 text-slate-500" : "bg-violet-100 text-violet-700"}`}>
                            {isProLocked ? "Pro" : "Pro"}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${isProLocked ? "text-slate-400" : "text-slate-500"}`}>
                        {t.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => !isProLocked && toggle(t.type, !enabled)}
                      disabled={isProLocked}
                      role="switch"
                      aria-checked={enabled}
                      aria-label={t.label}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        isProLocked
                          ? "bg-slate-200 cursor-not-allowed"
                          : enabled
                          ? "bg-amber-600"
                          : "bg-slate-300"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled && !isProLocked ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* DND */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>🌙</span> Sessiz saat
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Belirlediğin saatlerde bildirim alma.</p>
            </div>
            <button
              type="button"
              onClick={() => setDnd(d => ({ ...d, enabled: !d.enabled }))}
              role="switch"
              aria-checked={!!dnd.enabled}
              aria-label="Sessiz saat aktif"
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${dnd.enabled ? "bg-amber-600" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${dnd.enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          {dnd.enabled && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Başlangıç</label>
                <input
                  type="time"
                  value={dnd.start || "23:00"}
                  onChange={e => setDnd(d => ({ ...d, start: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-base"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bitiş</label>
                <input
                  type="time"
                  value={dnd.end || "08:00"}
                  onChange={e => setDnd(d => ({ ...d, end: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-base"
                />
              </div>
            </div>
          )}
        </section>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3 shadow-lg z-30">
        <div className="max-w-md mx-auto flex items-center gap-2">
          {savedFlash && (
            <span className="text-sm text-emerald-700 font-medium flex-1">✅ Kaydedildi</span>
          )}
          {!savedFlash && <div className="flex-1" />}
          <button
            type="button"
            onClick={() => void save()}
            disabled={status === "saving"}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-semibold text-sm shadow"
          >
            {status === "saving" ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

const PRESET_LABELS: Record<PresetName, string> = {
  yogun: "Yoğun",
  kritik: "Kritik",
  sessiz: "Sessiz",
  ozel: "Özel",
};

const PRESET_DESCRIPTIONS: Record<PresetName, string> = {
  yogun: "Tüm bildirimler açık (Pro türleri dahil).",
  kritik: "Sadece önemli olaylar — sıcak müşteri, sözleşme bitiyor, AI önerileri.",
  sessiz: "Sadece sabah brifingi ve randevu hatırlatması.",
  ozel: "Toggle'ları tek tek istediğin gibi ayarla.",
};

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
