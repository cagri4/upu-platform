"use client";

/**
 * /tr/site-ayarlari — Site SaaS panel kişiselleştirme.
 *
 * (panel)/panel-ayarlari'nın site-spesifik karşılığı: aynı bölümler
 * (Alt Sekme + Hızlı İşlemler + Google Bağlantı + KVKK), Site SaaS
 * sidebar layout'unu (cyan accent) otomatik yükler — `(site)` route
 * group içinde.
 *
 * Çağrı 2026-05-27 onayı: emlak-spesifik içerik (mülkler/sözleşmeler/
 * sunumlar) yerine site-spesifik tab + quick-action katalogu.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  ArrowLeft,
  RotateCcw,
  Save,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertTriangle,
  FileText,
  Mail,
  ExternalLink,
  Download,
  Trash2,
} from "lucide-react";
import { SITE_QUICK_ACTIONS } from "@/platform/quick-actions/site-catalog";
import {
  ALL_SITE_QUICK_ACTION_KEYS,
  DEFAULT_SITE_QUICK_ACTIONS,
  type SiteQuickActionKey,
} from "@/platform/quick-actions/site-keys";
import { StepUpModal } from "@/components/banking";

// ── Alt sekme çubuğu (localStorage, Site SaaS sayfaları) ─────────────
const TAB_STORAGE_KEY = "upu-bottom-tabs:siteyonetim";
const MAX_TABS = 4;

type TabItem = { id: string; label: string; icon: string };

const ALL_TAB_ITEMS: TabItem[] = [
  { id: "dashboard",  label: "Dashboard",   icon: "🏠" },
  { id: "sakinler",   label: "Sakinler",    icon: "👥" },
  { id: "aidat",      label: "Aidat",       icon: "💰" },
  { id: "tahsilat",   label: "Tahsilat",    icon: "💳" },
  { id: "butce",      label: "Bütçe",       icon: "📊" },
  { id: "talepler",   label: "Talepler",    icon: "🔧" },
  { id: "bakim",      label: "Bakım",       icon: "🛠" },
  { id: "duyurular",  label: "Duyurular",   icon: "📣" },
  { id: "toplantilar", label: "Toplantılar", icon: "📅" },
  { id: "personel",   label: "Personel",    icon: "🛠" },
  { id: "tedarikci",  label: "Tedarikçi",   icon: "🤝" },
];

const DEFAULT_TAB_SELECTION = ["dashboard", "aidat", "talepler", "duyurular"];

export default function SiteAyarlariPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";

  // Alt sekme state
  const [tabSelected, setTabSelected] = useState<string[]>(DEFAULT_TAB_SELECTION);
  const [tabSavedAt, setTabSavedAt] = useState<number | null>(null);

  // Hızlı işlemler state — site-spesifik
  const [qaSelected, setQaSelected] = useState<SiteQuickActionKey[]>(DEFAULT_SITE_QUICK_ACTIONS);
  const [qaLoading, setQaLoading] = useState(true);
  const [qaSaving, setQaSaving] = useState(false);
  const [qaError, setQaError] = useState("");
  const [qaSavedAt, setQaSavedAt] = useState<number | null>(null);

  // Google bağlantı state
  const [google, setGoogle] = useState<{ linked: boolean; email: string | null } | null>(null);
  const [googleUnlinking, setGoogleUnlinking] = useState(false);
  const [showStepUp, setShowStepUp] = useState(false);

  // Veri export + me bilgisi
  const [dataExporting, setDataExporting] = useState(false);
  const [meDisplayName, setMeDisplayName] = useState<string | null>(null);

  const linkedToast = params.get("linked") === "1";
  const linkError = params.get("error") || "";

  // Alt sekme yükleme (localStorage)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) {
          setTabSelected(arr.slice(0, MAX_TABS));
        }
      }
    } catch { /* yut */ }
  }, []);

  // Hızlı işlem yükleme — /api/site/layout (Sprint 1 endpoint)
  useEffect(() => {
    fetch("/api/site/layout", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.quick_actions) && d.quick_actions.length > 0) {
          setQaSelected(d.quick_actions as SiteQuickActionKey[]);
        }
      })
      .catch(() => { /* default kalır */ })
      .finally(() => setQaLoading(false));
  }, []);

  // Google bağlantı durumu
  useEffect(() => {
    fetch("/api/panel/google-link/status", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { linked: false, email: null }))
      .then((d) => setGoogle({ linked: !!d.linked, email: d.email || null }))
      .catch(() => setGoogle({ linked: false, email: null }));
  }, []);

  // me bilgisi (silme talebi mailto için)
  useEffect(() => {
    fetch("/api/site-panel/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setMeDisplayName(d.displayName || null);
      })
      .catch(() => { /* silent */ });
  }, []);

  async function handleDataExport() {
    setDataExporting(true);
    try {
      const url = token
        ? `/api/profile/data-export?t=${encodeURIComponent(token)}`
        : "/api/profile/data-export";
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) {
        window.alert("Veri indirilemedi. Lütfen tekrar deneyin.");
        return;
      }
      const blob = await res.blob();
      const today = new Date().toISOString().slice(0, 10);
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `upu-site-veri-export-${today}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(dlUrl);
    } catch {
      window.alert("Bağlantı hatası.");
    } finally {
      setDataExporting(false);
    }
  }

  function handleDeleteRequest() {
    const today = new Date().toISOString().slice(0, 10);
    const email = google?.email || "";
    const subjectBase = "Hesap Silme Talebi (UPU Site)";
    const subject = email ? `${subjectBase} - ${email}` : subjectBase;
    const body = [
      "Merhaba,",
      "",
      "UPU Site hesabımı silmek istiyorum. Bilgilerim:",
      `İsim: ${meDisplayName || "(otomatik doldurulamadı)"}`,
      `E-posta: ${email || "(otomatik doldurulamadı)"}`,
      `Tarih: ${today}`,
      "",
      "KVKK metninizde belirtildiği üzere 90 gün içinde işlenmesini rica ederim.",
      "",
      "İyi çalışmalar.",
    ].join("\n");
    window.location.href = `mailto:info@upudev.nl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function googleLink() {
    window.location.href = "/api/auth/google/start?mode=link&next=/tr/site-ayarlari";
  }

  async function googleUnlink() {
    if (!window.confirm("Google hesabı bağlantısı kaldırılsın mı?")) return;
    await performGoogleUnlink();
  }

  async function performGoogleUnlink() {
    setGoogleUnlinking(true);
    try {
      const res = await fetch("/api/auth/google/unlink", {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "step_up_required" || data.error === "step_up_invalid") {
          setShowStepUp(true);
          return;
        }
      }
      if (res.ok) {
        setGoogle({ linked: false, email: null });
      } else {
        window.alert("Bağlantı kaldırılamadı.");
      }
    } finally {
      setGoogleUnlinking(false);
    }
  }

  const linkErrorMessage =
    linkError === "google_already_linked"
      ? "Bu Google hesabı başka bir kullanıcıya bağlı."
      : linkError === "missing_pid" || linkError === "link_unauthorized"
        ? "Oturum bilgisi eksik. Tekrar deneyin."
        : linkError === "login_required"
          ? "Önce panele giriş yapın."
          : linkError.startsWith("oauth_")
            ? "Google ile bağlama sırasında hata oluştu."
            : null;

  // Alt sekme handlers
  function tabToggle(id: string) {
    setTabSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_TABS) return prev;
      return [...prev, id];
    });
  }
  function tabSave() {
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(tabSelected));
      setTabSavedAt(Date.now());
    } catch { /* quota / private mode */ }
  }
  function tabReset() {
    setTabSelected(DEFAULT_TAB_SELECTION);
    try { window.localStorage.removeItem(TAB_STORAGE_KEY); } catch { /* yut */ }
    setTabSavedAt(Date.now());
  }

  // Hızlı işlem handlers
  function qaToggle(key: SiteQuickActionKey) {
    setQaSelected((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
    setQaSavedAt(null);
    setQaError("");
  }
  function qaMove(key: SiteQuickActionKey, delta: number) {
    setQaSelected((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const next = idx + delta;
      if (next < 0 || next >= prev.length) return prev;
      const out = [...prev];
      [out[idx], out[next]] = [out[next], out[idx]];
      return out;
    });
    setQaSavedAt(null);
  }
  function qaReset() {
    setQaSelected(DEFAULT_SITE_QUICK_ACTIONS);
    setQaSavedAt(null);
    setQaError("");
  }
  async function qaSave() {
    setQaSaving(true);
    setQaError("");
    try {
      const res = await fetch("/api/site/layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ quick_actions: qaSelected }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQaError(d.error || "Kaydedilemedi.");
        return;
      }
      setQaSavedAt(Date.now());
    } catch {
      setQaError("Bağlantı hatası.");
    } finally {
      setQaSaving(false);
    }
  }

  const isTabFull = tabSelected.length >= MAX_TABS;

  return (
    <div className="space-y-5 pb-12">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profil & Ayarlar</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
        Site yönetim panelinizi günlük akışınıza göre özelleştirin.
      </p>

      {/* Alt sekme çubuğu */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Alt Sekme Çubuğu</h2>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {tabSelected.length} / {MAX_TABS} seçili
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
          Mobil ekranın altında hızlı erişim için en sık kullandığınız 4 sayfayı seçin.
          Tercihiniz bu cihazda saklanır.
        </p>

        <div className="space-y-2">
          {ALL_TAB_ITEMS.map((item) => {
            const idx = tabSelected.indexOf(item.id);
            const isSel = idx >= 0;
            const order = isSel ? idx + 1 : null;
            const disabled = !isSel && isTabFull;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => tabToggle(item.id)}
                disabled={disabled}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                  isSel
                    ? "border-emerald-500 dark:border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30"
                    : disabled
                      ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 opacity-50 cursor-not-allowed"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-500"
                }`}
              >
                <span className="text-2xl" aria-hidden="true">{item.icon}</span>
                <span className="flex-1 font-medium text-slate-900 dark:text-white">{item.label}</span>
                {isSel ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold">
                    {order}
                  </span>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600 text-sm">○</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-5">
          <button
            type="button"
            onClick={tabSave}
            disabled={tabSelected.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-2xl font-semibold text-sm shadow-sm active:scale-[0.98] transition"
          >
            <Save className="w-4 h-4" strokeWidth={2.2} /> Kaydet
          </button>
          <button
            type="button"
            onClick={tabReset}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-sm font-medium active:scale-[0.98] transition"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={2.2} /> Varsayılana Dön
          </button>
        </div>

        {tabSavedAt && (
          <div className="mt-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-sm rounded-xl px-3 py-2 flex items-center gap-1.5">
            <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
            Kaydedildi.
          </div>
        )}
      </section>

      {/* Hızlı işlemler — site-spesifik catalog */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Hızlı İşlemler</h2>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {qaSelected.length} / {ALL_SITE_QUICK_ACTION_KEYS.length} aktif
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
          Site Dashboard üstündeki yatay scroll satırını özelleştir. Aç/kapat ve sırasını değiştir —
          aktif olanlar seçtiğiniz sırada görünür.
        </p>

        {qaLoading ? (
          <div className="space-y-2">
            <div className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-2">
            {[...qaSelected, ...ALL_SITE_QUICK_ACTION_KEYS.filter((k) => !qaSelected.includes(k))].map((key) => {
              const def = SITE_QUICK_ACTIONS[key];
              if (!def) return null;
              const idx = qaSelected.indexOf(key);
              const isSel = idx >= 0;
              const isFirst = isSel && idx === 0;
              const isLast = isSel && idx === qaSelected.length - 1;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition ${
                    isSel
                      ? "border-emerald-500 dark:border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div
                    className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center ${
                      isSel
                        ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <def.Icon className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <span className={`flex-1 font-medium text-sm ${isSel ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
                    {def.label}
                  </span>
                  {isSel && (
                    <div className="flex items-center gap-0.5 mr-1">
                      <button
                        type="button"
                        onClick={() => qaMove(key, -1)}
                        disabled={isFirst}
                        aria-label="Yukarı taşı"
                        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <ChevronUp className="w-4 h-4" strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => qaMove(key, 1)}
                        disabled={isLast}
                        aria-label="Aşağı taşı"
                        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => qaToggle(key)}
                    role="switch"
                    aria-checked={isSel}
                    aria-label={def.label}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                      isSel ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isSel ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {qaError && (
          <div className="mt-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {qaError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mt-5">
          <button
            type="button"
            onClick={() => void qaSave()}
            disabled={qaSaving || qaLoading}
            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-2xl font-semibold text-sm shadow-sm active:scale-[0.98] transition"
          >
            {qaSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor</>
            ) : (
              <><Save className="w-4 h-4" strokeWidth={2.2} /> Kaydet</>
            )}
          </button>
          <button
            type="button"
            onClick={qaReset}
            disabled={qaSaving}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-sm font-medium active:scale-[0.98] disabled:opacity-60 transition"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={2.2} /> Varsayılana Dön
          </button>
        </div>

        {qaSavedAt && (
          <div className="mt-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-sm rounded-xl px-3 py-2 flex items-center gap-1.5">
            <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
            Kaydedildi. Site Dashboard'u yenileyince güncel sıra görünür.
          </div>
        )}
      </section>

      {/* Hesap Bağlantıları — Google */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Hesap Bağlantıları</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
          Google hesabınızı bağlarsanız WhatsApp kullanmadığınız cihazlarda hızlıca giriş yapabilirsiniz.
        </p>

        {linkedToast && (
          <div className="mb-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-sm rounded-xl px-3 py-2 flex items-center gap-1.5">
            <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
            Google hesabı bağlandı.
          </div>
        )}
        {linkErrorMessage && (
          <div className="mb-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-3 py-2 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {linkErrorMessage}
          </div>
        )}

        {google === null ? (
          <div className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ) : google.linked ? (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/40 dark:border-emerald-600/40 bg-emerald-50/60 dark:bg-emerald-950/30">
            <GoogleGlyph className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 dark:text-slate-400">Bağlı Google hesabı</div>
              <div className="font-medium text-sm text-slate-900 dark:text-white truncate">
                {google.email || "—"}
              </div>
            </div>
            <button
              type="button"
              onClick={googleUnlink}
              disabled={googleUnlinking}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleUnlinking ? "Kaldırılıyor" : "Bağlantıyı Kaldır"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={googleLink}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 text-slate-900 dark:text-white font-medium text-sm shadow-sm active:scale-[0.98] transition"
          >
            <GoogleGlyph className="w-4 h-4" />
            Google ile Bağla
          </button>
        )}
      </section>

      {/* Gizlilik ve Veriler — KVKK */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Gizlilik ve Veriler</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Kişisel verilerinizin nasıl işlendiği ve haklarınız hakkında bilgi alın.
        </p>
        <div className="space-y-2">
          <a
            href="/tr/aydinlatma-metni?tenant=siteyonetim"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-500 active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
              KVKK Aydınlatma Metni
            </span>
            <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500" strokeWidth={2.2} />
          </a>
          <a
            href="/tr/hizmet-sartlari?tenant=siteyonetim"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-500 active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
              Hizmet Şartları
            </span>
            <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500" strokeWidth={2.2} />
          </a>
          <a
            href="mailto:info@upudev.nl?subject=KVKK%20Veri%20Talebi%20-%20UPU%20Site"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-500 active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
              Veri talebi gönder
            </span>
            <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500" strokeWidth={2.2} />
          </a>
        </div>

        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleDataExport}
            disabled={dataExporting}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm active:scale-[0.98] transition"
          >
            {dataExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.4} />
            ) : (
              <Download className="w-4 h-4" strokeWidth={2.4} />
            )}
            {dataExporting ? "Hazırlanıyor…" : "Verilerimi indir (JSON)"}
          </button>
          <button
            type="button"
            onClick={handleDeleteRequest}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-sm font-semibold active:scale-[0.98] transition"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2.4} />
            Hesap silme talebi gönder
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Hesabınızı silmek isterseniz info@upudev.nl adresinden iletişime geçin.
          Talebiniz 90 gün içinde işlenir.
        </p>
      </section>

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center px-4 leading-relaxed">
        Alt sekme tercihi bu cihazda saklanır (localStorage). Hızlı işlemler ve hesap bağlantıları
        hesabınızda saklanır — başka cihazda da gelir.
      </p>

      {token && (
        <a
          href={`/tr/site?t=${encodeURIComponent(token)}`}
          className="flex items-center justify-center gap-1.5 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2.2} /> Dashboard'a Dön
        </a>
      )}

      {showStepUp && (
        <StepUpModal
          onCancel={() => setShowStepUp(false)}
          onVerified={() => {
            setShowStepUp(false);
            void performGoogleUnlink();
          }}
        />
      )}
    </div>
  );
}

/** Google G logo (4 renk official) — Hesap Bağlantıları için. */
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
