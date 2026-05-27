"use client";

/**
 * /tr/otel-profil — Otel Profilim (banking style + hesap bağlantıları + KVKK).
 *
 * Pattern: emlak panel-ayarlari/page.tsx Hesap Bağlantıları + Gizlilik ve
 * Veriler bloklarının otel'e port hali. (otel-panel) route group içinde
 * olduğu için otel sidebar layout otomatik yüklenir.
 *
 * Bölümler:
 *   1) Hero + Sahip / Otel bilgi kartları (init endpoint'inden)
 *   2) Hesap Bağlantıları — Google bağla / unlink + step-up modal
 *   3) Gizlilik ve Veriler — KVKK, hizmet şartları, veri talebi, export,
 *      silme talebi (mailto, 90 gün KVKK çerçevesi)
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  User,
  Building2,
  Check,
  AlertTriangle,
  FileText,
  Mail,
  ExternalLink,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { HeroBanner, Skeleton, StepUpModal } from "@/components/banking";

interface InitData {
  displayName: string | null;
  officeName: string | null;
}

export default function OtelProfilPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const [data, setData] = useState<InitData | null>(null);
  const [loading, setLoading] = useState(true);

  // Google bağlantı state
  const [google, setGoogle] = useState<{ linked: boolean; email: string | null } | null>(null);
  const [googleUnlinking, setGoogleUnlinking] = useState(false);
  const [showStepUp, setShowStepUp] = useState(false);

  // Verilerimi indir
  const [dataExporting, setDataExporting] = useState(false);

  const linkedToast = searchParams.get("linked") === "1";
  const linkError = searchParams.get("error") || "";

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`/api/otel-panel/init?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (!d?.error) setData({ displayName: d.displayName, officeName: d.officeName }); })
      .catch(() => { /* layout zaten error gösterdi */ })
      .finally(() => setLoading(false));
  }, [token]);

  // Google bağlantı durumu
  useEffect(() => {
    fetch("/api/panel/google-link/status", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { linked: false, email: null }))
      .then((d) => setGoogle({ linked: !!d.linked, email: d.email || null }))
      .catch(() => setGoogle({ linked: false, email: null }));
  }, []);

  function googleLink() {
    window.location.href = "/api/auth/google/start?mode=link&next=/tr/otel-profil";
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
        const d = await res.json().catch(() => ({}));
        if (d.error === "step_up_required" || d.error === "step_up_invalid") {
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
      a.download = `upu-otel-veri-export-${today}.json`;
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
    const name = data?.displayName || "(otomatik doldurulamadı)";
    const hotel = data?.officeName || "(otomatik doldurulamadı)";
    const subjectBase = "UPU Otel — Hesap Silme Talebi";
    const subject = email ? `${subjectBase} - ${email}` : subjectBase;
    const body = [
      "Merhaba,",
      "",
      "UPU Otel hesabımı silmek istiyorum. Bilgilerim:",
      `İsim: ${name}`,
      `Otel: ${hotel}`,
      `E-posta: ${email || "(otomatik doldurulamadı)"}`,
      `Tarih: ${today}`,
      "",
      "KVKK metninizde belirtildiği üzere 90 gün içinde işlenmesini rica ederim.",
      "",
      "İyi çalışmalar.",
    ].join("\n");
    window.location.href = `mailto:info@upudev.nl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Profilim"
        subtitle="Otel ve kişisel bilgilerinizi, hesap bağlantılarını ve gizlilik ayarlarınızı buradan yönetin."
        Icon={Settings}
      />

      {/* Kimlik bilgileri */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton height="h-20" />
          <Skeleton height="h-20" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Sahip</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{data?.displayName || "—"}</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Otel</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{data?.officeName || "—"}</div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Gizlilik ve Veriler */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Gizlilik ve Veriler</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Kişisel verilerinizin nasıl işlendiği ve haklarınız hakkında bilgi alın.
        </p>
        <div className="space-y-2">
          <a
            href="/tr/aydinlatma-metni?tenant=otel"
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
            href="mailto:info@upudev.nl?subject=UPU%20Otel%20-%20KVKK%20Veri%20Talebi"
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

      {/* Yakında — düzenleme */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-sm text-slate-600 dark:text-slate-400 shadow-sm">
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Otel bilgileri düzenleme — yakında</p>
        <p>
          Otel adı, lokasyon, kontak bilgileri, çek-in/çek-out saatleri, Wi-Fi tercihleri buradan düzenlenebilecek. Şimdilik WhatsApp&apos;tan size yardımcı olabilirim.
        </p>
      </div>

      {/* Step-up WA OTP modal'ı */}
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
