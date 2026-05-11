"use client";

/**
 * Profilim — bayi profil özet sayfası.
 *
 * Üst aksiyon: "Profili Düzenle" → mevcut /tr/bayi-profil form sayfasına gider.
 * Bu sayfa SADECE okuma — düzenleme tam form'da.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-900 dark:text-slate-100 text-right break-words">{value || "—"}</span>
    </div>
  );
}

export default function ProfilimPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";

  const [data, setData] = useState<ProfileResp | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/bayi-panel/profile?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Profil yüklenemedi");
        setData(d);
        setError("");
      })
      .catch(e => setError(e.message || "Bağlantı hatası"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">👤 Profilim</h1>
          <a
            href={`/tr/bayi-profil?t=${encodeURIComponent(token)}`}
            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition"
          >
            ✏️ Profili Düzenle
          </a>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4 text-sm text-rose-700">{error}</div>
      ) : loading ? (
        <div className="text-center text-sm text-slate-500 py-8">Yükleniyor…</div>
      ) : data ? (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Hesap</h2>
            <Row label="Ad Soyad" value={data.displayName} />
            <Row label="WhatsApp" value={data.phone} />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Firma Bilgileri</h2>
            <Row label="Ticari Ünvan" value={data.firma.ticari_unvan} />
            <Row label="Yetkili" value={data.firma.yetkili_adi} />
            <Row label="Sektör" value={data.firma.sektor ? (SEKTOR_LABEL[data.firma.sektor] || data.firma.sektor) : null} />
            <Row label="Ofis Telefon" value={data.firma.ofis_telefon} />
            <Row label="E-posta" value={data.firma.email_kurumsal} />
            <Row label="Web Sitesi" value={data.firma.web_sitesi} />
            <Row label="Adres" value={data.firma.ofis_adresi} />
          </div>
        </>
      ) : null}
    </div>
  );
}
