"use client";

import { useSearchParams } from "next/navigation";
import { ReturnButtons } from "@/components/return-buttons";

const BOT_WA_NUMBER = "31644967207";

export default function SozlesmelerimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-amber-700 to-orange-900 text-white rounded-2xl p-5">
        <div className="text-3xl mb-1">📋</div>
        <h1 className="text-xl font-bold">Sözleşmelerim</h1>
        <p className="text-amber-200 text-sm mt-1">Aktif sözleşmeleriniz, imza durumları ve PDF dokümanları</p>
      </div>

      {/* Primary action — sozlesme komutu wa.me'ye redirect (mevcut WA akışı) */}
      <a
        href={`/api/panel/start?cmd=sozlesme&t=${encodeURIComponent(token)}`}
        className="block bg-gradient-to-r from-amber-600 to-orange-600 text-white text-center font-semibold py-4 rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition"
      >
        ➕ Sözleşme Yap
      </a>

      <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
        <div className="text-5xl mb-3">📋</div>
        <p className="font-semibold text-slate-900 mb-1">Henüz sözleşme eklemediniz</p>
        <p className="text-slate-500 text-sm">
          Yeni sözleşme oluşturmak için yukarıdaki butonu kullanın.
        </p>
      </div>

      <ReturnButtons token={token || null} botPhone={BOT_WA_NUMBER} />
    </div>
  );
}
