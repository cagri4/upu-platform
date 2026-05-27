"use client";

/**
 * /tr/market-profilim — shell içi profil + hesap + gizlilik (Çağrı 2026-05-27).
 *
 * Önceki konum: src/app/[locale]/market-profilim/ (flat, shell DIŞI). Bu
 * yapıda WA WebView'da full-screen açılıyordu, sidebar yoktu ve Google
 * bağlama bölümü eksikti. (market-panel) route group içine taşındı:
 *
 *   - Market sidebar otomatik render olur (amber accent)
 *   - HeroBanner + banking layout pariteye katıldı
 *   - 3 bölüm: Market Bilgileri (mevcut form) + Hesap Bağlantıları
 *     (Google) + Gizlilik ve Veriler (KVKK/export/silme)
 *
 * Pattern: (panel)/panel-ayarlari + (site)/site-ayarlari birebir port,
 * market sektörüne uyarlanmış metinler.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  User,
  Check,
  AlertTriangle,
  Loader2,
  FileText,
  Mail,
  ExternalLink,
  Download,
  Trash2,
} from "lucide-react";
import { HeroBanner, LoadingState, StepUpModal } from "@/components/banking";

const SEKTOR_OPTIONS = [
  { value: "bakkal", label: "Bakkal / Mini Market" },
  { value: "supermarket", label: "Supermarket" },
  { value: "toptan", label: "Toptan / Grossmarket" },
  { value: "sarkuteri", label: "Şarküteri / Kasap" },
  { value: "manav", label: "Manav" },
];

const URUN_SAYISI_OPTIONS = [
  { value: "1-100", label: "1 — 100 çeşit" },
  { value: "100-500", label: "100 — 500 çeşit" },
  { value: "500+", label: "500+ çeşit" },
];

interface InitData {
  displayName: string | null;
  marketAdi: string | null;
  sektor: string | null;
  urunSayisi: string | null;
  adres: string | null;
  briefingEnabled: boolean;
}

type FormState = "loading" | "ready" | "saving" | "error";

export default function MarketProfilimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  // ── Form state ────────────────────────────────────────────────────
  const [state, setState] = useState<FormState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [marketAdi, setMarketAdi] = useState("");
  const [sektor, setSektor] = useState("");
  const [urunSayisi, setUrunSayisi] = useState("");
  const [adres, setAdres] = useState("");
  const [briefingEnabled, setBriefingEnabled] = useState(true);

  // ── Google bağlantı state ─────────────────────────────────────────
  const [google, setGoogle] = useState<{ linked: boolean; email: string | null } | null>(null);
  const [googleUnlinking, setGoogleUnlinking] = useState(false);
  const [showStepUp, setShowStepUp] = useState(false);

  // ── Veri export state ─────────────────────────────────────────────
  const [dataExporting, setDataExporting] = useState(false);

  const linkedToast = searchParams.get("linked") === "1";
  const linkError = searchParams.get("error") || "";

  // ── Init: profile fetch ───────────────────────────────────────────
  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/market/profil/init${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: InitData & { error?: string }) => {
        if (d.error) { setState("error"); setErrorMsg(d.error); return; }
        setDisplayName(d.displayName || "");
        setMarketAdi(d.marketAdi || "");
        setSektor(d.sektor || "");
        setUrunSayisi(d.urunSayisi || "");
        setAdres(d.adres || "");
        setBriefingEnabled(d.briefingEnabled ?? true);
        setState("ready");
      })
      .catch(() => { setState("error"); setErrorMsg("Bağlantı hatası."); });
  }, [token]);

  // ── Google bağlantı durumu ────────────────────────────────────────
  useEffect(() => {
    fetch("/api/panel/google-link/status", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { linked: false, email: null }))
      .then((d) => setGoogle({ linked: !!d.linked, email: d.email || null }))
      .catch(() => setGoogle({ linked: false, email: null }));
  }, []);

  // ── Form save ─────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!marketAdi.trim()) {
      setErrorMsg("Market adı zorunlu");
      return;
    }
    setState("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/market/profil/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          display_name: displayName,
          market_adi: marketAdi,
          sektor,
          urun_sayisi: urunSayisi,
          adres,
          briefing_enabled: briefingEnabled,
        }),
      });
      const d = await res.json();
      if (d.error) { setState("ready"); setErrorMsg(d.error); return; }
      setState("ready");
      setSavedAt(Date.now());
    } catch {
      setState("ready");
      setErrorMsg("Kayıt hatası");
    }
  }

  // ── Google handlers ───────────────────────────────────────────────
  function googleLink() {
    window.location.href = "/api/auth/google/start?mode=link&next=/tr/market-profilim";
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

  // ── Veri export ───────────────────────────────────────────────────
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
      a.download = `upu-market-veri-export-${today}.json`;
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
    const subjectBase = "Hesap Silme Talebi";
    const subject = email ? `${subjectBase} - ${email}` : subjectBase;
    const body = [
      "Merhaba,",
      "",
      "UPU Market hesabımı silmek istiyorum. Bilgilerim:",
      `İsim: ${displayName || "(otomatik doldurulamadı)"}`,
      `Market: ${marketAdi || "(otomatik doldurulamadı)"}`,
      `E-posta: ${email || "(otomatik doldurulamadı)"}`,
      `Tarih: ${today}`,
      "",
      "KVKK metninizde belirtildiği üzere 90 gün içinde işlenmesini rica ederim.",
      "",
      "İyi çalışmalar.",
    ].join("\n");
    window.location.href = `mailto:info@upudev.nl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // ── Render ────────────────────────────────────────────────────────
  if (state === "loading") return <LoadingState variant="card" label="Profil yükleniyor" />;

  return (
    <div className="space-y-5 sm:space-y-6 pb-12">
      <HeroBanner
        Icon={User}
        title="Profilim"
        subtitle="Hesabınızı, market bilgilerinizi ve gizlilik tercihlerinizi yönetin."
      />

      {/* ── Market Bilgileri ──────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Market Bilgileri</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sizi ve marketinizi tanıyan bilgiler — brifinglerde ve raporlarda kullanılır.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl px-3 py-2 text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
            {errorMsg}
          </div>
        )}

        {savedAt && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-sm rounded-xl px-3 py-2 flex items-center gap-1.5">
            <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
            Kaydedildi.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Adınız</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              placeholder="Mehmet Yılmaz"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Market / Mağaza Adı <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={marketAdi}
              onChange={(e) => setMarketAdi(e.target.value)}
              required
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              placeholder="ABC Market"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Sektör</label>
            <div className="space-y-1.5">
              {SEKTOR_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition">
                  <input
                    type="radio"
                    name="sektor"
                    value={opt.value}
                    checked={sektor === opt.value}
                    onChange={(e) => setSektor(e.target.value)}
                    className="text-emerald-600 focus:ring-emerald-400"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Ürün Sayısı</label>
            <div className="space-y-1.5">
              {URUN_SAYISI_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition">
                  <input
                    type="radio"
                    name="urun_sayisi"
                    value={opt.value}
                    checked={urunSayisi === opt.value}
                    onChange={(e) => setUrunSayisi(e.target.value)}
                    className="text-emerald-600 focus:ring-emerald-400"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Adres (Opsiyonel)</label>
            <textarea
              value={adres}
              onChange={(e) => setAdres(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none resize-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              placeholder="Den Haag, Hollanda"
            />
          </div>

          <label className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition">
            <input
              type="checkbox"
              checked={briefingEnabled}
              onChange={(e) => setBriefingEnabled(e.target.checked)}
              className="mt-0.5 text-emerald-600 focus:ring-emerald-400"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Sabah günlük brifing göndersin (dünkü ciro, kritik stok, vade durumu).
            </span>
          </label>

          <button
            type="submit"
            disabled={state === "saving"}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-2xl text-sm font-semibold transition disabled:opacity-50 active:scale-[0.98] shadow-sm"
          >
            {state === "saving" ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </form>
      </section>

      {/* ── Hesap Bağlantıları ────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5">
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

      {/* ── Gizlilik ve Veriler ──────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Gizlilik ve Veriler</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Kişisel verilerinizin nasıl işlendiği ve haklarınız hakkında bilgi alın.
        </p>
        <div className="space-y-2">
          <a
            href="/tr/aydinlatma-metni?tenant=market"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-500 active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
              KVKK Aydınlatma Metni
            </span>
            <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500" strokeWidth={2.2} />
          </a>
          <a
            href="/tr/hizmet-sartlari"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-500 active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
              Hizmet Şartları
            </span>
            <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500" strokeWidth={2.2} />
          </a>
          <a
            href="/tr/iade-iptal"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-500 active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
              İade ve İptal Politikası
            </span>
            <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500" strokeWidth={2.2} />
          </a>
          <a
            href="mailto:info@upudev.nl?subject=KVKK%20Veri%20Talebi%20(UPU%20Market)"
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
          Hesabınızı silmek isterseniz info@upudev.nl adresinden iletişime geçin. Talebiniz 90 gün içinde işlenir.
        </p>
      </section>

      {/* Step-up WA OTP modal — Google unlink başarılı doğrulamadan sonra
          performGoogleUnlink yeniden çağrılır (cookie 10 dk geçerli). */}
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
