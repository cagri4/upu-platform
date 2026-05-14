"use client";

/**
 * /tr/panel-verilerim — Faz 7.1b.
 *
 * GDPR Article 15 / KVKK Madde 11 kapsamında kullanıcının kişisel verileri
 * üzerindeki erişim ve silme haklarını kullanabileceği panel sayfası.
 *
 *   1) Tutulan veriler özeti (bilgilendirme listesi)
 *   2) "Verilerimi indir" — /api/profile/data-export JSON dump
 *   3) "Hesap silme talebi" — mailto:info@upudev.nl (admin 90 gün içinde işler)
 *
 * Hard delete YOK; KVKK aydınlatma metnine paralel olarak silme talebi
 * yazılı e-posta üzerinden alınır.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Database,
  Download,
  Mail,
  Trash2,
  ShieldCheck,
  FileText,
  Users,
  Home,
  Receipt,
} from "lucide-react";
import { BackButton } from "@/components/banking";

export default function PanelVerilerimPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";
  const exportHref = token
    ? `/api/profile/data-export?t=${encodeURIComponent(token)}`
    : "/api/profile/data-export";

  const [me, setMe] = useState<{ displayName?: string; email?: string } | null>(null);

  useEffect(() => {
    fetch("/api/panel/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) {
          setMe({ displayName: d.displayName ?? undefined, email: d.email ?? undefined });
        }
      })
      .catch(() => {
        /* silent */
      });
  }, []);

  const handleDeleteRequest = () => {
    const today = new Date().toISOString().slice(0, 10);
    const subject = `Hesap Silme Talebi - ${me?.email || me?.displayName || ""}`.trim();
    const lines = [
      "Merhaba UPU Dev,",
      "",
      "UPU Emlak hesabımın KVKK Madde 7 / GDPR Article 17 kapsamında silinmesini talep ediyorum.",
      "",
      `Ad / Görünen ad: ${me?.displayName || "(otomatik doldurulamadı)"}`,
      `E-posta: ${me?.email || "(otomatik doldurulamadı)"}`,
      `Talep tarihi: ${today}`,
      "",
      "Talebimin KVKK aydınlatma metninde belirtildiği üzere en geç 90 gün içinde işlenmesini rica ederim.",
      "",
      "Saygılarımla,",
    ];
    const body = lines.join("\n");
    window.location.href = `mailto:info@upudev.nl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      <header className="px-4 py-4">
        <BackButton />
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
            Verilerim
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kişisel verileriniz üzerindeki haklarınız ve aksiyonlar.
          </p>
        </div>

        {/* A) Tutulan veriler */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Tutulan veriler
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Hesabınızda işlenen kişisel veri kategorileri:
          </p>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <DataRow icon={<ShieldCheck className="w-4 h-4" />} title="Profil bilgileri">
              Ad, telefon, e-posta, rol, KVKK onay sürümü ve tarihi, Google bağlantısı (varsa).
            </DataRow>
            <DataRow icon={<Home className="w-4 h-4" />} title="Mülk portföyü">
              Yüklediğiniz mülk ilanları, fotoğraflar, adres ve fiyat bilgileri.
            </DataRow>
            <DataRow icon={<Users className="w-4 h-4" />} title="Müşteri kayıtları">
              Tarafınızca girilen müşteri iletişim ve takip verileri.
            </DataRow>
            <DataRow icon={<FileText className="w-4 h-4" />} title="Sunum ve sözleşmeler">
              Sunum başlıkları, magic link tokenları ve üretilen sözleşme metadata&apos;sı.
            </DataRow>
            <DataRow icon={<Receipt className="w-4 h-4" />} title="Abonelik ve fatura">
              Plan, durum, ödeme dönemleri ve Mollie&apos;den alınan fatura adresi (varsa).
            </DataRow>
          </ul>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
            Şifre, OAuth token veya benzeri gizli kimlik bilgileri saklanmaz; oturum doğrulama
            kısa ömürlü HttpOnly cookie&apos;ler üzerinden yapılır.
          </p>
        </section>

        {/* B) Verilerimi indir */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Verilerimi indir
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Yukarıda listelenen tüm verilerinizi tek bir JSON dosyası olarak indirin.
            KVKK Madde 11 ve GDPR Article 15 (Right of access) kapsamındaki erişim hakkınızı
            kullanırsınız.
          </p>
          <a
            href={exportHref}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold active:scale-[0.98] transition"
          >
            <Download className="w-4 h-4" strokeWidth={2.4} />
            JSON olarak indir
          </a>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Dosya tarayıcınızda yeni bir indirme olarak görünür. Şifre veya gizli token içermez.
          </p>
        </section>

        {/* C) Hesap silme talebi */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" strokeWidth={2.2} />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Hesap silme talebi
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Hesabınızı kalıcı olarak silmek isterseniz info@upudev.nl adresine yazılı talep
            iletmeniz gerekmektedir. Talebiniz en geç{" "}
            <strong className="text-slate-900 dark:text-white">90 gün</strong> içinde işlenir
            (KVKK aydınlatma metnimizle uyumlu).
          </p>
          <button
            type="button"
            onClick={handleDeleteRequest}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold active:scale-[0.98] transition"
          >
            <Mail className="w-4 h-4" strokeWidth={2.4} />
            Silme talebi gönder (e-posta)
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            E-posta uygulamanız önceden doldurulmuş bir taslakla açılır; göndermeden önce
            mesajı kontrol edebilirsiniz.
          </p>
        </section>

        <p className="text-xs text-slate-500 dark:text-slate-400 text-center px-2 leading-relaxed">
          Sorularınız için{" "}
          <a
            href="mailto:info@upudev.nl"
            className="text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            info@upudev.nl
          </a>{" "}
          adresinden bize ulaşabilirsiniz.
        </p>
      </main>
    </div>
  );
}

function DataRow({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
      <span className="mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0">{icon}</span>
      <span className="space-y-0.5">
        <p className="font-medium text-slate-900 dark:text-white">{title}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{children}</p>
      </span>
    </li>
  );
}
