"use client";

/**
 * Bayi Yazılım Bağlantısı — DEMO AKIŞI (mock backend, gerçek UI).
 *
 * Müşteri demosunda "vay bağlandı bile" hissi vermek için tasarlandı.
 * Hiçbir ekranda gerçek OAuth / API çağrısı YOK. Production'da
 * NEXT_PUBLIC_DEMO_MODE=true → fake; false olunca CTA "Kurulum ekibimiz
 * 24 saat içinde döner" mesajına dönüşür (concierge fallback).
 *
 * Akış (3 ekran):
 *   1. Seçim — "CSV/Excel yükle" vs "Muhasebe yazılımına bağlan"
 *   2. Yazılım seçimi — TR (Logo Tiger/GO/İşbaşı/Mikro/Paraşüt) +
 *      NL (Exact/Yuki/SnelStart/Twinfield) listesi + "Bilmiyorum"
 *   3. Fake bağlanıyor (2.5s spinner) → success ✅ "X bayi + Y ürün
 *      senkronlandı" + ilerleme barı
 *
 * Onboarding chain'e bağlama: bu sayfa magic_link_tokens token'ı
 * okur (mevcut pattern), success sonrası advanceDiscovery tetiklenir
 * (TODO: yeni discovery step ekleme — ayrı commit).
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Step = "loading" | "select_method" | "select_software" | "connect_form" | "connecting" | "success" | "error";
type Method = "csv" | "accounting" | "concierge";

interface SoftwareOption {
  id: string;
  name: string;
  country: "TR" | "NL" | "BE";
  type: "cloud" | "onprem";        // cloud = OAuth one-click (mock); onprem = form
  flag: string;
}

const SOFTWARE_OPTIONS: SoftwareOption[] = [
  // Türkiye
  { id: "logo_tiger",   name: "Logo Tiger",       country: "TR", type: "onprem", flag: "🇹🇷" },
  { id: "logo_go",      name: "Logo GO",          country: "TR", type: "onprem", flag: "🇹🇷" },
  { id: "logo_isbasi",  name: "Logo İşbaşı",      country: "TR", type: "cloud",  flag: "🇹🇷" },
  { id: "mikro",        name: "Mikro",            country: "TR", type: "onprem", flag: "🇹🇷" },
  { id: "parasut",      name: "Paraşüt",          country: "TR", type: "cloud",  flag: "🇹🇷" },
  // Hollanda
  { id: "exact",        name: "Exact Online",     country: "NL", type: "cloud",  flag: "🇳🇱" },
  { id: "yuki",         name: "Yuki",             country: "NL", type: "cloud",  flag: "🇳🇱" },
  { id: "snelstart",    name: "SnelStart",        country: "NL", type: "cloud",  flag: "🇳🇱" },
  { id: "twinfield",    name: "Twinfield",        country: "NL", type: "cloud",  flag: "🇳🇱" },
];

export default function BayiBaglantiPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState("");
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareOption | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [counts, setCounts] = useState({ dealers: 0, products: 0 });

  // On-prem form state
  const [serverUrl, setServerUrl] = useState("");
  const [customerCode, setCustomerCode] = useState("");

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  useEffect(() => {
    if (!token) { setStep("error"); setError("Link geçersiz."); return; }
    // Token doğrulama backend'e gerek yok — magic link önceki adımda doğrulandı.
    // Sadece varlığını kontrol et, kullanıcıyı seçim ekranına götür.
    setStep("select_method");
  }, [token]);

  // Fake bağlantı animasyonu — 4 fazlı sahte ilerleme
  useEffect(() => {
    if (step !== "connecting") return;

    const phases = [
      { ms: 600,  label: "Sisteminize bağlanılıyor...",     progress: 25 },
      { ms: 700,  label: "Yetki kontrolleri yapılıyor...",  progress: 50 },
      { ms: 800,  label: "Bayiler senkronlanıyor...",       progress: 78 },
      { ms: 600,  label: "Ürünler senkronlanıyor...",       progress: 95 },
    ];

    let cancelled = false;
    let total = 0;
    for (const phase of phases) {
      total += phase.ms;
      const t = total;
      const phaseLabel = phase.label;
      const phaseProgress = phase.progress;
      setTimeout(() => {
        if (cancelled) return;
        setProgressLabel(phaseLabel);
        setProgress(phaseProgress);
      }, t - phase.ms);
    }

    setTimeout(() => {
      if (cancelled) return;
      // Random ama makul sayılar — kullanıcının firması ölçeğine göre değişebilir
      const dealers = 8 + Math.floor(Math.random() * 12);
      const products = 80 + Math.floor(Math.random() * 200);
      setCounts({ dealers, products });
      setProgress(100);
      setStep("success");
    }, total + 300);

    return () => { cancelled = true; };
  }, [step]);

  function pickMethod(m: Method) {
    if (m === "csv") {
      // CSV import sayfasına yönlendir (gerçek implementasyon ileride)
      window.location.href = `/tr/bayi-urun-import?t=${token}`;
    } else if (m === "accounting") {
      setStep("select_software");
    } else {
      setStep("error");
      setError("Listede yoksa kurulum ekibimiz size 24 saat içinde döner.");
    }
  }

  function pickSoftware(sw: SoftwareOption) {
    setSelectedSoftware(sw);
    if (sw.type === "cloud") {
      // Cloud = OAuth one-click. Demo'da direkt bağlanıyor animasyonu.
      if (isDemoMode) {
        setStep("connecting");
      } else {
        setStep("error");
        setError(`${sw.name} entegrasyonu için kurulum ekibimiz 24 saat içinde döner.`);
      }
    } else {
      // On-prem (Logo Tiger/GO, Mikro) → form
      setStep("connect_form");
    }
  }

  function submitOnPremForm() {
    if (!serverUrl.trim() || !customerCode.trim()) {
      setError("Server URL ve Customer Code gerekli.");
      return;
    }
    setError("");
    if (isDemoMode) {
      setStep("connecting");
    } else {
      setStep("error");
      setError(`${selectedSoftware?.name} on-prem entegrasyonu için kurulum ekibimiz 24 saat içinde döner.`);
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────

  if (step === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;

  if (step === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <h1 className="text-xl font-bold mb-2">Yardıma ihtiyacınız var</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg">WhatsApp ile destek al</a>
  </Center>;

  // 1. Seçim
  if (step === "select_method") {
    return (
      <Page>
        <Header icon="🔌" title="Bayi ve ürünleri nasıl yükleyelim?"
          subtitle="İki yoldan birini seçin — sonra istediğiniz zaman değiştirebilirsiniz." />
        <div className="space-y-3">
          <Card onClick={() => pickMethod("accounting")}
            badge="🟢 Önerilen"
            icon="🔄" title="Muhasebe yazılımıma bağlan"
            desc="Yuki / Exact / SnelStart / Logo / Mikro / Paraşüt — bayilerinizi ve ürünlerinizi otomatik çekelim. 2 dakika sürer." />
          <Card onClick={() => pickMethod("csv")}
            icon="📁" title="CSV / Excel ile yükle"
            desc="Şablonu indirin, doldurun, yükleyin. Manuel ekleme yerine toplu yükleme." />
        </div>
        <Footnote>
          Yardım gerekirse <strong>kurulum ekibimiz 24 saat içinde</strong> size döner —
          istediğiniz zaman <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="text-emerald-700 underline">WhatsApp&apos;tan</a> yazın.
        </Footnote>
      </Page>
    );
  }

  // 2. Yazılım seçimi
  if (step === "select_software") {
    const trList = SOFTWARE_OPTIONS.filter(s => s.country === "TR");
    const nlList = SOFTWARE_OPTIONS.filter(s => s.country === "NL");
    return (
      <Page>
        <Header icon="🔄" title="Hangi muhasebe yazılımını kullanıyorsunuz?"
          subtitle="Listeden birini seçin. Bağlantı kurulup bayiler + ürünler otomatik senkronlanacak." />

        <Section label="🇹🇷 Türkiye">
          {trList.map(sw => (
            <SoftwareCard key={sw.id} sw={sw} onClick={() => pickSoftware(sw)} />
          ))}
        </Section>

        <Section label="🇳🇱 Hollanda">
          {nlList.map(sw => (
            <SoftwareCard key={sw.id} sw={sw} onClick={() => pickSoftware(sw)} />
          ))}
        </Section>

        <button onClick={() => pickMethod("concierge")}
          className="w-full text-sm text-slate-500 hover:text-slate-700 mt-4 py-3">
          Listede yok — kurulum ekibinize danışayım
        </button>

        <button onClick={() => setStep("select_method")}
          className="w-full text-xs text-slate-400 hover:text-slate-600 mt-1">
          ← Geri dön
        </button>
      </Page>
    );
  }

  // 2b. On-prem form (Logo Tiger/GO/Mikro)
  if (step === "connect_form" && selectedSoftware) {
    return (
      <Page>
        <Header icon="🔧" title={`${selectedSoftware.name} bağlantısı`}
          subtitle="Sunucu erişim bilgilerinizi girin. Veriler şifreli iletilir, bizim sistemde saklanmaz." />

        <div className="bg-white rounded-2xl p-5 space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Server URL</label>
            <input value={serverUrl} onChange={e => setServerUrl(e.target.value)}
              placeholder="http://192.168.1.100:8080"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Customer Code</label>
            <input value={customerCode} onChange={e => setCustomerCode(e.target.value)}
              placeholder="001"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <button onClick={submitOnPremForm}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold active:scale-95">
          Bağlan →
        </button>

        <button onClick={() => setStep("select_software")}
          className="w-full text-xs text-slate-400 hover:text-slate-600 mt-3">
          ← Yazılım listesine dön
        </button>

        <Footnote>
          🔒 Bağlantı bilgileriniz sadece senkron işleminde kullanılır, panellerimizde gösterilmez.
        </Footnote>
      </Page>
    );
  }

  // 3. Bağlanıyor — fake loading
  if (step === "connecting") {
    return (
      <Page>
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4 animate-pulse">🔄</div>
          <h2 className="text-xl font-bold mb-2">{selectedSoftware?.name}</h2>
          <p className="text-sm text-slate-600 mb-6 min-h-[1.5em]">{progressLabel}</p>

          <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-slate-400">{progress}%</p>
        </div>
      </Page>
    );
  }

  // 4. Success
  if (step === "success") {
    return (
      <Page>
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-emerald-700 mb-2">Bağlandı!</h2>
          <p className="text-sm text-slate-600 mb-6">
            <strong>{selectedSoftware?.name}</strong> sisteminizden bayiler ve ürünler senkronlandı.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-emerald-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-emerald-700">{counts.dealers}</div>
              <div className="text-xs text-slate-600 mt-1">bayi</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-emerald-700">{counts.products}</div>
              <div className="text-xs text-slate-600 mt-1">ürün</div>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-6">
            Senkronizasyon her gece otomatik tekrarlanır. İstediğiniz zaman elle tetikleyebilirsiniz.
          </p>

          <a href={`https://wa.me/${BOT_WA_NUMBER}`}
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-semibold">
            WhatsApp&apos;a dön
          </a>
        </div>

        {!isDemoMode && (
          <Footnote>
            🛠️ Bu demo görünümüdür. Gerçek bağlantı için kurulum ekibimiz size 24 saat içinde döner.
          </Footnote>
        )}
      </Page>
    );
  }

  return null;
}

// ── Yardımcı bileşenler ─────────────────────────────────────────────────

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-md mx-auto">{children}</div>
    </div>
  );
}

function Header({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-2xl p-5 mb-5">
      <div className="text-3xl mb-1">{icon}</div>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-emerald-100 text-sm mt-1">{subtitle}</p>
    </div>
  );
}

function Card({ icon, title, desc, onClick, badge }: { icon: string; title: string; desc: string; onClick: () => void; badge?: string }) {
  return (
    <button onClick={onClick}
      className="w-full text-left bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 transition group">
      <div className="flex items-start gap-3">
        <div className="text-3xl">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            {badge && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">{badge}</span>}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
        </div>
        <div className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition">→</div>
      </div>
    </button>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">{label}</p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function SoftwareCard({ sw, onClick }: { sw: SoftwareOption; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl p-3 text-left transition">
      <div className="text-lg">{sw.flag}</div>
      <div className="font-semibold text-sm text-slate-900 mt-1">{sw.name}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">
        {sw.type === "cloud" ? "☁️ Cloud — tek tıkla" : "🖥️ On-prem — sunucu bilgisi"}
      </div>
    </button>
  );
}

function Footnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-slate-500 text-center mt-6 px-4 leading-relaxed">{children}</p>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
