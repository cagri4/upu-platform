"use client";

/**
 * Profilim — bayi profil özet sayfası (group içi, bayi sidebar yüklü).
 *
 * Bölümler:
 *   1) Hesap (Ad Soyad, WhatsApp)
 *   2) Firma Bilgileri (Ticari ünvan, sektör, adres, vb.)
 *   3) Hesap Bağlantıları — Google bağla/kaldır (Faz 6.2 — port panel-ayarlari)
 *   4) Gizlilik ve Veriler — KVKK linkleri + JSON export + hesap silme
 *
 * "Profili Düzenle" CTA mevcut /tr/bayi-profil full-form sayfasına gider
 * (group dışı, WA WebView full-screen pattern korunuyor — değişmedi).
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  AlertTriangle,
  FileText,
  Mail,
  ExternalLink,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { StepUpModal } from "@/components/banking";

interface Firma {
  ticari_unvan: string | null;
  yetkili_adi: string | null;
  ofis_telefon: string | null;
  ofis_adresi: string | null;
  sektor: string | null;
  email_kurumsal: string | null;
  web_sitesi: string | null;
}

interface ProfileResp {
  displayName: string | null;
  phone: string | null;
  firma: Firma;
}

const SEKTOR_LABEL: Record<string, string> = {
  boya: "Boya & Kimyasal",
  gida: "Gıda & İçecek",
  hirdavat: "Hırdavat & Yapı Market",
  tekstil: "Tekstil & Konfeksiyon",
  temizlik: "Temizlik & Hijyen",
  diger: "Diğer",
};

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-900 dark:text-slate-100 text-right break-words">{value || "—"}</span>
    </div>
  );
}

export default function ProfilimPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";

  // Profil özet
  const [data, setData] = useState<ProfileResp | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Google bağlantı state — Faz 6.2 port
  const [google, setGoogle] = useState<{ linked: boolean; email: string | null } | null>(null);
  const [googleUnlinking, setGoogleUnlinking] = useState(false);
  const [showStepUp, setShowStepUp] = useState(false);
  const [linkedToast, setLinkedToast] = useState(false);

  // Veri export — Faz 7.1c port
  const [dataExporting, setDataExporting] = useState(false);

  // URL'den toast / error mesajı
  const linked = params.get("linked");
  const linkError = params.get("error") || "";

  // Profil özet yükle
  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/bayi-panel/profile${qs}`, { credentials: "same-origin" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Profil yüklenemedi");
        setData(d);
        setError("");
      })
      .catch(e => setError(e.message || "Bağlantı hatası"))
      .finally(() => setLoading(false));
  }, [token]);

  // Google bağlama durumu
  useEffect(() => {
    fetch("/api/panel/google-link/status", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : { linked: false, email: null })
      .then(d => setGoogle({ linked: !!d.linked, email: d.email || null }))
      .catch(() => setGoogle({ linked: false, email: null }));
  }, []);

  // ?linked=1 → toast 4sn göster
  useEffect(() => {
    if (linked === "1") {
      setLinkedToast(true);
      const t = setTimeout(() => setLinkedToast(false), 4000);
      return () => clearTimeout(t);
    }
  }, [linked]);

  function googleLink() {
    window.location.href = "/api/auth/google/start?mode=link&next=/tr/bayi-profilim";
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
      a.download = `upu-bayi-veri-export-${today}.json`;
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
    const email = google?.email || data?.firma?.email_kurumsal || "";
    const name = data?.displayName || "(otomatik doldurulamadı)";
    const subject = email ? `Hesap Silme Talebi - ${email}` : "Hesap Silme Talebi";
    const body = [
      "Merhaba,",
      "",
      "UPU Bayi hesabımı silmek istiyorum. Bilgilerim:",
      `İsim: ${name}`,
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
        : linkError === "google_link_failed" || linkError === "exchange_failed"
          ? "Google ile bağlama sırasında hata oluştu."
          : "";

  return (
    <div className="space-y-4 max-w-2xl mx-auto px-4 py-4">
      {/* Üst başlık + Düzenle CTA */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">👤 Profilim</h1>
          <a
            href={token ? `/tr/bayi-profil?t=${encodeURIComponent(token)}` : "/tr/bayi-profil"}
            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition"
          >
            ✏️ Profili Düzenle
          </a>
        </div>
      </div>

      {/* Profil özet */}
      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-300">{error}</div>
      ) : loading ? (
        <div className="text-center text-sm text-slate-500 py-8">Yükleniyor…</div>
      ) : data ? (
        <>
          <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Hesap</h2>
            <Row label="Ad Soyad" value={data.displayName} />
            <Row label="WhatsApp" value={data.phone} />
          </section>

          <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Firma Bilgileri</h2>
            <Row label="Ticari Ünvan" value={data.firma.ticari_unvan} />
            <Row label="Yetkili" value={data.firma.yetkili_adi} />
            <Row label="Sektör" value={data.firma.sektor ? (SEKTOR_LABEL[data.firma.sektor] || data.firma.sektor) : null} />
            <Row label="Ofis Telefon" value={data.firma.ofis_telefon} />
            <Row label="E-posta" value={data.firma.email_kurumsal} />
            <Row label="Web Sitesi" value={data.firma.web_sitesi} />
            <Row label="Adres" value={data.firma.ofis_adresi} />
          </section>
        </>
      ) : null}

      {/* Hesap Bağlantıları — Google bağla/kaldır */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Hesap Bağlantıları</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
          Google hesabını bağlarsan WhatsApp kullanmadığın cihazlarda hızlıca giriş yapabilirsin.
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

      {/* Gizlilik ve Veriler — KVKK + export + silme */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Gizlilik ve Veriler</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Kişisel verilerinizin nasıl işlendiği ve haklarınız hakkında bilgi alın.
        </p>
        <div className="space-y-2">
          <a
            href="/tr/aydinlatma-metni"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-500 active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" strokeWidth={2.2} />
              KVKK Aydınlatma Metni
            </span>
            <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500" strokeWidth={2.2} />
          </a>
          <a
            href="/tr/hizmet-sartlari"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-500 active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" strokeWidth={2.2} />
              Hizmet Şartları
            </span>
            <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500" strokeWidth={2.2} />
          </a>
          <a
            href="/tr/iade-iptal"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-500 active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" strokeWidth={2.2} />
              İade ve İptal Politikası
            </span>
            <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500" strokeWidth={2.2} />
          </a>
          <a
            href="mailto:info@upudev.nl?subject=KVKK%20Veri%20Talebi"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-500 active:scale-[0.99] transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
              <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" strokeWidth={2.2} />
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
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm active:scale-[0.98] transition"
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
          Hesabını silmek istersen info@upudev.nl adresinden iletişime geç. Talebin 90 gün içinde işlenir.
        </p>
      </section>

      {/* Step-up WA OTP modal'ı — Google unlink başarılı doğrulamadan sonra
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
