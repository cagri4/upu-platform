"use client";

export default function MarketOneriPage() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-amber-600 to-orange-700 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Öneri / Şikayet</h1>
        <p className="text-amber-100 text-sm mt-2">Görüş ve önerilerinizi bizimle paylaşın.</p>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center shadow-sm">
        <div className="text-4xl mb-3">💬</div>
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Yakında</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Öneri ve şikayet formu yakında burada açılacak. Şimdilik WhatsApp üzerinden bize ulaşabilirsiniz.
        </p>
        <a
          href="https://wa.me/31644967207?text=%C3%96neri%2F%C5%9Eikayet%3A%20"
          className="inline-block bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition"
        >
          💬 WhatsApp&apos;tan Yaz
        </a>
      </div>
    </div>
  );
}
