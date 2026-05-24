"use client";

/**
 * Bayi panel — Sık Sorulan Sorular (V1.5).
 * 8 başlangıç sorusu. Sonradan markdown/CMS'e taşınabilir.
 */
import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";

const FAQ = [
  {
    q: "Bayi nasıl davet ederim?",
    a: "Sol menüden 'Bayi Davet' → telefon numarası gir → davet linkini bayi WhatsApp'a paylaş. Bayi tıklar, kayıt tamamlanır, sisteme bağlanır.",
  },
  {
    q: "Online vitrin nedir, nasıl çalışır?",
    a: "Bayi panelinden vitrin oluşturursun (örn 'manolya-boya'). Müşterilerin retailai.upudev.nl/tr/v/<slug> linkinden ürünlerini görür, sepet oluşturur, talep gönderir. Talep WhatsApp'tan size düşer; siz onayladığınızda sipariş olur.",
  },
  {
    q: "Bayi performans skoru nasıl hesaplanır?",
    a: "Her bayi için 4 alt-skor (hacim, düzen, tahsilat, trend) hesaplanır ve 0-100 toplam skora dönüşür. Haftalık cron çalışır. En az 3 ay sipariş verisi gereklidir.",
  },
  {
    q: "Drip kampanya nedir?",
    a: "Zamana yayılmış mesaj dizisi. Hedef kitle (örn 30 gün sipariş vermeyenler) belirler, 5-7 adımlı mesaj kurarsın, sistem otomatik gönderir. /tr/bayi-marketing menüsünden.",
  },
  {
    q: "Otomatik kampanya kuralı nasıl yazılır?",
    a: "/tr/bayi-kampanya-otomatik → 'Yeni Kural' → tetik (örn sipariş yok N gün) + aksiyon (WA mesaj/admin uyarısı). Cooldown ile spam'i önleriz.",
  },
  {
    q: "Çalışan davet ederken WA mesajı otomatik gider mi?",
    a: "Hayır. WhatsApp Cloud API 24-saat kuralı gereği bot otomatik mesaj gönderemez. Davet linkini kopyalayıp kendi WA'nızdan paylaşırsınız.",
  },
  {
    q: "Sistem Turu'nu nasıl tekrar açarım?",
    a: "Sol menü alt kısmındaki '📘 Sistem Turu' linkine tıkla — 5 adımlı wizard tekrar başlar. Profil bilgilerini etkilemez.",
  },
  {
    q: "Faturalama nasıl çalışır?",
    a: "Ay sonu Mollie üzerinden otomatik tahsil edilir (Free / Pro / Pro+ / Enterprise plan). /tr/bayi-billing sayfasından plan değiştirebilir, iptal edebilirsin.",
  },
];

export default function BayiSSSPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">❓ Sık Sorulan Sorular</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Yanıtını bulamadığın bir soru varsa WhatsApp destek hattımıza yaz.
        </p>
      </header>

      <div className="space-y-2">
        {FAQ.map((item, idx) => {
          const isOpen = open === idx;
          return (
            <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : idx)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.q}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <a href="https://wa.me/31644967207" target="_blank" rel="noopener noreferrer"
        className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 text-sm font-semibold">
        <MessageCircle className="w-4 h-4" />
        WhatsApp Destek Hattı
      </a>
    </div>
  );
}
