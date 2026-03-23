import { headers } from "next/headers";
import { getTenantByKey, getAllTenants } from "@/tenants/config";
import Link from "next/link";
import { Check, UserPlus, MessageSquare, Rocket } from "lucide-react";

export default async function HomePage() {
  const headersList = await headers();
  const tenantKey = headersList.get("x-tenant-key") || "emlak";
  const tenant = getTenantByKey(tenantKey);

  if (!tenant) {
    return <PlatformOverview />;
  }

  return <TenantLanding tenant={tenant} />;
}

// ─── Platform Overview (admin domain) ────────────────────────────────────────

function PlatformOverview() {
  const tenants = getAllTenants();
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
      <nav className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <span className="text-xl font-bold">UPU Platform</span>
        <Link href="/tr/admin" className="text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition">
          Admin Panel
        </Link>
      </nav>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold text-center mb-4">Sanal Eleman Platformu</h1>
        <p className="text-xl text-center text-indigo-200 mb-16">Her sektör için AI destekli sanal çalışan ekipleri</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((t) => (
            <Link
              key={t.key}
              href={`https://${t.slug}.upudev.nl`}
              className="bg-white/10 backdrop-blur rounded-2xl p-6 hover:bg-white/20 transition block"
            >
              <div className="text-4xl mb-3">{t.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{t.name}</h3>
              <p className="text-indigo-200 text-sm">{t.description}</p>
              {t.employees.length > 0 && (
                <p className="text-xs text-indigo-300 mt-3">{t.employees.length} sanal eleman</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Landing Page ─────────────────────────────────────────────────────

import type { TenantConfig } from "@/tenants/config";

function TenantLanding({ tenant }: { tenant: TenantConfig }) {
  return (
    <div className="min-h-screen">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{tenant.icon}</span>
            <span className="text-white font-semibold">{tenant.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="text-sm text-slate-300 hover:text-white hidden md:block">Özellikler</a>
            <a href="#pricing" className="text-sm text-slate-300 hover:text-white hidden md:block">Fiyatlar</a>
            <Link href="/tr/login" className="text-sm text-slate-300 hover:text-white">Giriş</Link>
            <Link href="/tr/register" className="text-sm bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-lg transition">
              Ücretsiz Dene
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-block bg-indigo-500/20 text-indigo-300 text-sm px-4 py-1 rounded-full mb-6">
            {tenant.employees.length} Sanal Eleman Hazır
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">{tenant.description}</h1>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            WhatsApp&apos;tan yönetin. Uygulama indirmeye gerek yok. AI destekli ekibiniz 7/24 çalışır.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/tr/register"
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-8 py-3 rounded-xl transition text-lg"
            >
              14 Gün Ücretsiz Dene
            </Link>
            <a
              href="#features"
              className="border border-white/20 hover:bg-white/10 text-white font-semibold px-8 py-3 rounded-xl transition text-lg"
            >
              Nasıl Çalışır?
            </a>
          </div>
          <p className="text-sm text-slate-500 mt-4">Kredi kartı gerekmez</p>
        </div>
      </section>

      {/* ── Employees / Features ── */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">Sanal Ekibiniz</h2>
          <p className="text-center text-slate-500 mb-12 max-w-xl mx-auto">
            Her biri kendi uzmanlık alanında size destek olur. WhatsApp&apos;tan komut verin, anında çalışsınlar.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tenant.employees.map((emp) => (
              <div key={emp.key} className="bg-slate-50 rounded-2xl p-6 hover:shadow-lg transition border border-slate-100">
                <div className="text-3xl mb-3">{emp.icon}</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{emp.name}</h3>
                <p className="text-slate-500 text-sm mb-4">{emp.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {emp.commands.slice(0, 5).map((cmd) => (
                    <span key={cmd} className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-2.5 py-0.5 font-medium">{cmd}</span>
                  ))}
                  {emp.commands.length > 5 && (
                    <span className="text-xs text-slate-400">+{emp.commands.length - 5} daha</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">Nasıl Çalışır?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: UserPlus, title: "Kayıt Olun", desc: "14 günlük ücretsiz deneme başlasın. Kredi kartı gerekmez." },
              { icon: MessageSquare, title: "WhatsApp Bağlayın", desc: "Davet kodunuzu WhatsApp'a gönderin. 30 saniyede hazır." },
              { icon: Rocket, title: "Ekibiniz Çalışsın", desc: "Sanal elemanlarınız 7/24 emrinizde. Komut verin, anında sonuç." },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-7 h-7 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">Fiyatlandırma</h2>
          <p className="text-center text-slate-500 mb-12">14 gün ücretsiz deneyin, sonra size uygun planı seçin</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Starter */}
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Başlangıç</h3>
              <p className="text-sm text-slate-500 mb-4">Bireysel kullanıcılar için</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900">₺399</span>
                <span className="text-slate-500">/ay</span>
              </div>
              <ul className="space-y-2 mb-8">
                {["Tüm sanal elemanlar", "Temel yetenekler", "WhatsApp entegrasyonu", "E-posta destek"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-green-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/tr/register" className="block text-center bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl transition font-medium">
                Başla
              </Link>
            </div>
            {/* Pro */}
            <div className="bg-indigo-50 rounded-2xl p-8 border-2 border-indigo-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                Popüler
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Profesyonel</h3>
              <p className="text-sm text-slate-500 mb-4">Ekipler ve ofisler için</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900">₺1.199</span>
                <span className="text-slate-500">/ay</span>
              </div>
              <ul className="space-y-2 mb-8">
                {["Tüm sanal elemanlar", "Gelişmiş yetenekler", "Sınırsız komut", "Öncelikli destek", "Çoklu kullanıcı"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-indigo-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/tr/register" className="block text-center bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl transition font-medium">
                Başla
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-gradient-to-r from-slate-900 to-indigo-900 text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Hemen Başlayın</h2>
          <p className="text-slate-300 mb-8">14 gün ücretsiz deneyin. Kredi kartı gerekmez. İstediğiniz zaman iptal edin.</p>
          <Link href="/tr/register" className="inline-block bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-10 py-3.5 rounded-xl transition text-lg">
            Ücretsiz Deneyin
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{tenant.icon}</span>
                <span className="text-white font-semibold">{tenant.name}</span>
              </div>
              <p className="text-sm">AI destekli sanal eleman platformu</p>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">Ürün</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition">Özellikler</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Fiyatlar</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">Şirket</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://upudev.nl" className="hover:text-white transition">UPU Dev</a></li>
                <li><a href="mailto:info@upudev.nl" className="hover:text-white transition">İletişim</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">Yasal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/tr/terms" className="hover:text-white transition">Kullanım Koşulları</Link></li>
                <li><Link href="/tr/privacy" className="hover:text-white transition">Gizlilik Politikası</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-sm text-center">
            &copy; {new Date().getFullYear()} UPU Dev. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </div>
  );
}
