"use client";

/**
 * Bayi İlk Karşılama — 6 saf-pasif tanıtım slaytı.
 *
 * Brief 2026-05-29: Input YOK, kullanıcıdan veri istemiyor — sadece
 * parlak özellikleri gösterir. Son slaytta "Hadi başlayalım" →
 * onCompleted callback layout tarafından yakalanır:
 *   - profiles.onboarding_completed = true (state API'sı)
 *   - Kurucu AI Eleman widget'ı otomatik açılır (Faz 1C)
 *
 * Eski input adımları (Step2Profile, Step3InviteDealer, Step4Vitrine)
 * artık burada KULLANILMIYOR. Profil/davet/vitrin işlemleri Kurucu
 * sohbet akışı tarafından üstlenilir (Faz 2 — Kurucu agent).
 */

import type { OnboardingStepContext } from "@/platform/onboarding/engine";

export function SlideWelcome(ctx: OnboardingStepContext) {
  const displayName = (ctx.state.displayName as string) || "";
  const first = displayName.split(" ")[0] || "Hoş geldin";
  return (
    <SlideShell ctx={ctx}>
      <div className="text-6xl mb-4">🎯</div>
      <Headline>Hoşgeldin {first}!</Headline>
      <Lead>
        UPU Bayi ile satış destek ekibin yanında. Bayi yönetimi, otomatik
        kampanya ve online vitrin — hepsi tek panelde.
      </Lead>
      <NavRow ctx={ctx} primary="İleri →" />
    </SlideShell>
  );
}

export function SlideDealerManagement(ctx: OnboardingStepContext) {
  return (
    <SlideShell ctx={ctx}>
      <div className="text-5xl mb-4">📊</div>
      <Headline>Bayilerini tek panelden yönet</Headline>
      <Lead>
        Her bayinin <b>performans skoru</b>, churn riski ve sipariş trendini
        anında gör. Skor 30 altına düşen bayiye sistem otomatik uyarı verir.
      </Lead>
      <Bullets items={[
        { i: "👥", t: "Bayi liste + filtre" },
        { i: "📉", t: "Churn risk erken uyarı" },
        { i: "⭐", t: "Performans skoru (0-100)" },
      ]} />
      <NavRow ctx={ctx} primary="İleri →" />
    </SlideShell>
  );
}

export function SlideVitrineLead(ctx: OnboardingStepContext) {
  return (
    <SlideShell ctx={ctx}>
      <div className="text-5xl mb-4">🏪</div>
      <Headline>Online vitrin + Lead form</Headline>
      <Lead>
        Her bayinin kendi mini-mağazası — son müşteri katalogu görür, sipariş
        talebi gönderir. Talep WA'dan size düşer, onaylayınca siparişe döner.
      </Lead>
      <Bullets items={[
        { i: "🔗", t: "Paylaşılabilir slug: /v/&lt;mağaza&gt;" },
        { i: "📩", t: "Lead → bayiye anlık WA push" },
        { i: "✅", t: "Tek tıkla siparişe dönüştür" },
      ]} />
      <NavRow ctx={ctx} primary="İleri →" />
    </SlideShell>
  );
}

export function SlideAutomation(ctx: OnboardingStepContext) {
  return (
    <SlideShell ctx={ctx}>
      <div className="text-5xl mb-4">⚡</div>
      <Headline>Otomatik kampanya & drip</Headline>
      <Lead>
        Bir kez kural yaz, sistem yıl boyu çalıştırsın. 30 gün sipariş
        vermeyen bayiye otomatik kupon, vade gecikenine WA hatırlatma,
        yeni bayiye 5-mesajlık onboarding dripi.
      </Lead>
      <Bullets items={[
        { i: "⚡", t: "Otomatik kural (trigger)" },
        { i: "📨", t: "Drip 5-mesajlık diziler" },
        { i: "🎁", t: "Referans programı + kredi ledger" },
      ]} />
      <NavRow ctx={ctx} primary="İleri →" />
    </SlideShell>
  );
}

export function SlideAITeam(ctx: OnboardingStepContext) {
  return (
    <SlideShell ctx={ctx}>
      <div className="text-5xl mb-4">🤖</div>
      <Headline>UPU AI Eleman Ekibin</Headline>
      <Lead>
        Sağ-alt köşeden istediğin role bağlan: <b>Kurucu</b> sistemi seninle
        kurar, <b>Yönetici Asistanı</b> veriyi getirir, <b>Panel Eğitmeni</b>
        her özelliği anlatır.
      </Lead>
      <Bullets items={[
        { i: "🛠️", t: "Kurucu — ilk kurulumu devralır" },
        { i: "📊", t: "Yönetici Asistanı — raporlama, soru-cevap" },
        { i: "🎓", t: "Panel Eğitmeni — özellik turu, ipuçları" },
      ]} />
      <NavRow ctx={ctx} primary="İleri →" />
    </SlideShell>
  );
}

export function SlideStart(ctx: OnboardingStepContext) {
  return (
    <SlideShell ctx={ctx}>
      <div className="text-6xl mb-4">🚀</div>
      <Headline>Hadi başlayalım!</Headline>
      <Lead>
        Devam ettiğinde <b>Kurucu AI Eleman</b> seninle konuşmaya başlayacak.
        Bayi listeni, ürünlerini ve ayarlarını adım adım kuracaksınız.
      </Lead>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 max-w-md mx-auto leading-relaxed">
        Excel/CSV yükle, fotoğraf gönder, kopyala-yapıştır veya tek tek ekle —
        sen yöntemi seç, Kurucu yapsın. Takılırsan WhatsApp'tan da yardım
        isteyebilirsin.
      </p>
      <button
        onClick={() => void ctx.complete()}
        className="w-full sm:w-auto rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 text-base font-semibold shadow-sm"
      >
        Kurucu ile Başla →
      </button>
    </SlideShell>
  );
}

// ─── Shared primitives ─────────────────────────────────────────────────

function SlideShell({ ctx: _ctx, children }: { ctx: OnboardingStepContext; children: React.ReactNode }) {
  return (
    <div className="px-4 sm:px-6 py-6 text-center max-w-md mx-auto">
      {children}
    </div>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2 leading-tight">
      {children}
    </h2>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
      {children}
    </p>
  );
}

function Bullets({ items }: { items: Array<{ i: string; t: string }> }) {
  return (
    <ul className="text-left text-sm space-y-2 mb-6">
      {items.map((b, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
          <span className="text-lg shrink-0" aria-hidden>{b.i}</span>
          <span className="text-slate-700 dark:text-slate-200 leading-snug"
            dangerouslySetInnerHTML={{ __html: b.t }} />
        </li>
      ))}
    </ul>
  );
}

function NavRow({ ctx, primary }: { ctx: OnboardingStepContext; primary: string }) {
  return (
    <div className="space-y-3 mt-2">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => ctx.back()}
          disabled={ctx.index === 0}
          className="text-sm text-slate-500 dark:text-slate-400 disabled:opacity-30 px-2 py-2"
        >
          ← Geri
        </button>
        <button
          onClick={() => void ctx.next()}
          className="flex-1 sm:flex-none rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 text-sm font-semibold"
        >
          {primary}
        </button>
      </div>
      {/* "Atla" — eski sürümde footer'daki text-xs ufak link'ti, kullanıcılar
          görmüyordu (Çağrı 2026-06-05 test raporu). Görünür secondary buton
          olarak ayrıldı; tıklayınca tüm wizard complete işaretlenir
          (onCompleted), tekrar açılmaz. */}
      <button
        onClick={() => void ctx.complete()}
        data-testid="onboarding-skip-all"
        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2.5 text-xs font-medium"
      >
        Tanıtımı atla, panele git
      </button>
    </div>
  );
}
