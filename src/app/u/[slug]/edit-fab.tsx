"use client";

import { useState } from "react";

/**
 * Sayfa sahibi için sağ üstte yüzen ✏️ Düzenle butonu.
 * Tıklayınca /tr/profil-duzenle'e magic link ile (yeni token)
 * yönlenir. Token üretimi server-side gerek olduğu için
 * burada sadece /api/websayfam/edit-link endpoint'ini çağırıp
 * yönlendirme yapıyoruz.
 *
 * Sayfa sahibi kontrolü yok (public landing) — herkes düzenle butonu
 * görür ama tıklayınca token alamaz, /api/websayfam/edit-link
 * ?slug= ile çağrılır, slug sahibi profile WA bağlı değilse 403 döner.
 */
export function EditFAB({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/websayfam/edit-link?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (d?.url) {
        window.location.href = d.url as string;
      } else {
        alert(d?.error || "Düzenleme linki oluşturulamadı.");
      }
    } catch {
      alert("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={() => void handle()}
      disabled={loading}
      className="fixed top-5 right-5 z-30 bg-white/95 hover:bg-white shadow-lg rounded-full px-4 py-2 text-sm font-medium text-stone-700 hover:text-indigo-600 active:scale-95 border border-stone-200 print:hidden flex items-center gap-1.5"
      title="Sayfanı düzenle"
    >
      {loading ? "⏳" : "✏️"} Düzenle
    </button>
  );
}
