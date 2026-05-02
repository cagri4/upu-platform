import { headers } from "next/headers";
import { getTenantByKey, getAllTenants } from "@/tenants/config";
import type { TenantConfig } from "@/tenants/config";
import Link from "next/link";
import { Check, UserPlus, MessageSquare, Rocket } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageDropdown } from "./language-dropdown";
import { RevisionBadge } from "@/tenants/bayi/components/RevisionBadge";
import { TIER_FEATURES } from "@/tenants/bayi/billing/tier-features";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const headersList = await headers();
  const isAdmin = headersList.get("x-is-admin") === "true";
  const tenantKey = headersList.get("x-tenant-key");
  const tenant = tenantKey ? getTenantByKey(tenantKey) : null;

  if (isAdmin || !tenant) {
    return <PlatformOverview locale={locale} />;
  }

  return <TenantLanding tenant={tenant} locale={locale} />;
}

// ─── Platform Overview (admin domain) ────────────────────────────────────────

async function PlatformOverview({ locale }: { locale: string }) {
  const t = await getTranslations("platform");
  const tenants = getAllTenants();
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
      <nav className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <span className="text-xl font-bold">UPU Platform</span>
        <Link href={`/${locale}/admin`} className="text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition">
          {t("admin_panel")}
        </Link>
      </nav>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold text-center mb-4">{t("title")}</h1>
        <p className="text-xl text-center text-indigo-200 mb-16">{t("subtitle")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tn) => (
            <Link
              key={tn.key}
              href={`https://${tn.slug}.upudev.nl`}
              className="bg-white/10 backdrop-blur rounded-2xl p-6 hover:bg-white/20 transition block"
            >
              <div className="text-4xl mb-3">{tn.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{tn.name}</h3>
              <p className="text-indigo-200 text-sm">{tn.description}</p>
              {tn.employees.length > 0 && (
                <p className="text-xs text-indigo-300 mt-3">{t("employees_count", { count: tn.employees.length })}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Landing Page ─────────────────────────────────────────────────────
// TenantConfig already imported via @/tenants/config types in this module.

async function TenantLanding({ tenant, locale }: { tenant: TenantConfig; locale: string }) {
  const t = await getTranslations("landing");
  const tt = await getTranslations(`tenants.${tenant.key}` as "tenants");
  const tr = await getTranslations("revisions");

  // RevisionBadge bayi-only şu an; locale parse + i18n labels client'a paslı.
  const localeShort = (locale === "nl" || locale === "en") ? locale : "tr";
  const revisionLabels = {
    badge: tr("badge"),
    title: tr("title"),
    no_revisions: tr("no_revisions"),
    older_count: tr("older_count"),
    aria_open: tr("aria_open"),
  };

  return (
    <div className="min-h-screen">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{tenant.icon}</span>
            <span className="text-white font-semibold">{tt("name")}</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="text-sm text-slate-300 hover:text-white hidden md:block">{t("nav_features")}</a>
            <a href="#pricing" className="text-sm text-slate-300 hover:text-white hidden md:block">{t("nav_pricing")}</a>
            <LanguageDropdown locale={locale} />
            <Link href={`/${locale}/login`} className="text-sm text-slate-300 hover:text-white">{t("nav_login")}</Link>
            <Link href={`/${locale}/register`} className="text-sm bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-lg transition">
              {t("nav_free_trial")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          {tenant.employees.length > 0 && (
            <div className="inline-block bg-indigo-500/20 text-indigo-300 text-sm px-4 py-1 rounded-full mb-6">
              {t("hero_badge", { count: tenant.employees.length })}
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">{tt("description")}</h1>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            {t("hero_subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/register`}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-8 py-3 rounded-xl transition text-lg"
            >
              {t("hero_cta_trial")}
            </Link>
            <a
              href="#features"
              className="border border-white/20 hover:bg-white/10 text-white font-semibold px-8 py-3 rounded-xl transition text-lg"
            >
              {t("hero_cta_how")}
            </a>
          </div>
          <p className="text-sm text-slate-500 mt-4">{t("hero_no_cc")}</p>
        </div>
        {tenant.key === "bayi" && (
          <div className="absolute bottom-3 left-4">
            <RevisionBadge componentKey="hero" locale={localeShort} theme="dark" labels={revisionLabels} />
          </div>
        )}
      </section>

      {/* ── Features: bayi tenant'ı için 5 değer önerisi, diğer tenant'lar için sanal eleman gridi ── */}
      {tenant.key === "bayi" ? (
        <section id="features" className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">{tt("value_title")}</h2>
            <p className="text-center text-slate-500 mb-12 max-w-2xl mx-auto">
              {tt("value_subtitle")}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="bg-slate-50 rounded-2xl p-6 hover:shadow-lg transition border border-slate-100">
                  <div className="text-3xl mb-3">{["💬", "💰", "🚛", "📢", "🔌"][n - 1]}</div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{tt(`value_${n}_title` as "name")}</h3>
                  <p className="text-slate-600 text-sm">{tt(`value_${n}_desc` as "name")}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section id="features" className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">{t("team_title")}</h2>
            <p className="text-center text-slate-500 mb-12 max-w-xl mx-auto">
              {t("team_subtitle")}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenant.employees.map((emp) => (
                <div key={emp.key} className="bg-slate-50 rounded-2xl p-6 hover:shadow-lg transition border border-slate-100">
                  <div className="text-3xl mb-3">{emp.icon}</div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">{tt(`employees.${emp.key}.name` as "name")}</h3>
                  <p className="text-slate-500 text-sm mb-4">{tt(`employees.${emp.key}.description` as "name")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {emp.commands.slice(0, 5).map((cmd) => (
                      <span key={cmd} className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-2.5 py-0.5 font-medium">{cmd}</span>
                    ))}
                    {emp.commands.length > 5 && (
                      <span className="text-xs text-slate-400">{t("team_more", { count: emp.commands.length - 5 })}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── How It Works ── */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">{t("how_title")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: UserPlus, title: t("how_step1_title"), desc: t("how_step1_desc") },
              { icon: MessageSquare, title: t("how_step2_title"), desc: t("how_step2_desc") },
              { icon: Rocket, title: t("how_step3_title"), desc: t("how_step3_desc") },
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
      {tenant.key === "bayi" && tenant.pricing.growth ? (
        <BayiPricing tenant={tenant} locale={locale} t={t} tt={tt}
          revisionLocale={localeShort} revisionLabels={revisionLabels} />
      ) : (
        <section id="pricing" className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">{t("pricing_title")}</h2>
            <p className="text-center text-slate-500 mb-12">{t("pricing_subtitle")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Starter */}
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{t("pricing_starter")}</h3>
                <p className="text-sm text-slate-500 mb-4">{t("pricing_starter_desc")}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">€{tenant.pricing.starter.price}</span>
                  <span className="text-slate-500">{t("pricing_per_month")}</span>
                </div>
                <ul className="space-y-2 mb-8">
                  {[t("pricing_starter_f1"), t("pricing_starter_f2"), t("pricing_starter_f3"), t("pricing_starter_f4")].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-green-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href={`/${locale}/register`} className="block text-center bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl transition font-medium">
                  {t("pricing_starter_cta")}
                </Link>
              </div>
              {/* Pro */}
              <div className="bg-indigo-50 rounded-2xl p-8 border-2 border-indigo-500 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                  {t("pricing_pro_badge")}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{t("pricing_pro")}</h3>
                <p className="text-sm text-slate-500 mb-4">{t("pricing_pro_desc")}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">€{tenant.pricing.pro.price}</span>
                  <span className="text-slate-500">{t("pricing_per_month")}</span>
                </div>
                <ul className="space-y-2 mb-8">
                  {[t("pricing_pro_f1"), t("pricing_pro_f2"), t("pricing_pro_f3"), t("pricing_pro_f4"), t("pricing_pro_f5")].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-indigo-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href={`/${locale}/register`} className="block text-center bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl transition font-medium">
                  {t("pricing_pro_cta")}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="py-20 bg-gradient-to-r from-slate-900 to-indigo-900 text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">{t("cta_title")}</h2>
          <p className="text-slate-300 mb-8">{t("cta_subtitle")}</p>
          <Link href={`/${locale}/register`} className="inline-block bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-10 py-3.5 rounded-xl transition text-lg">
            {t("cta_button")}
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
                <span className="text-white font-semibold">{tt("name")}</span>
              </div>
              <p className="text-sm">{t("footer_tagline")}</p>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">{t("footer_product")}</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition">{t("nav_features")}</a></li>
                <li><a href="#pricing" className="hover:text-white transition">{t("nav_pricing")}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">{t("footer_company")}</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://upudev.nl" className="hover:text-white transition">UPU Dev</a></li>
                <li><a href="mailto:info@upudev.nl" className="hover:text-white transition">{t("footer_contact")}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">{t("footer_legal")}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href={`/${locale}/terms`} className="hover:text-white transition">{t("footer_terms")}</Link></li>
                <li><Link href={`/${locale}/privacy`} className="hover:text-white transition">{t("footer_privacy")}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-sm text-center">
            &copy; {new Date().getFullYear()} UPU Dev. {t("footer_rights")}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Bayi-specific 3-tier pricing + setup fee + referral promo ───────────

type TFn = Awaited<ReturnType<typeof getTranslations>>;

function BayiPricing({
  tenant, locale, t, tt, revisionLocale, revisionLabels,
}: {
  tenant: TenantConfig;
  locale: string;
  t: TFn;
  tt: TFn;
  revisionLocale: "tr" | "nl" | "en";
  revisionLabels: {
    badge: string;
    title: string;
    no_revisions: string;
    older_count: string;
    aria_open: string;
  };
}) {
  const setup = tenant.pricing.setup;
  const referral = tenant.pricing.referral;
  const refund = tenant.pricing.refund;
  const growth = tenant.pricing.growth!;

  return (
    <section id="pricing" className="relative py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">{t("pricing_title")}</h2>
        <p className="text-center text-slate-500 mb-8">{t("pricing_subtitle")}</p>

        {referral && (
          <div className="max-w-2xl mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-amber-900 text-sm font-medium">
            {tt("referral_banner", { count: referral.firstN })}
          </div>
        )}
        {refund && (
          <div className="max-w-2xl mx-auto mb-10 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center text-emerald-900 text-sm font-medium">
            {tt("refund_banner", { days: refund.firstNDays })}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Starter */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{t("pricing_starter")}</h3>
            <p className="text-xs text-slate-500 mb-3">{tt("pricing_starter_desc")}</p>
            <div className="mb-4">
              <span className="text-3xl font-bold text-slate-900">€{tenant.pricing.starter.price}</span>
              <span className="text-slate-500 text-sm">{t("pricing_per_month")}</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1 mb-5">
              <li>👥 {TIER_FEATURES.starter.employees} çalışan</li>
              <li>🏪 {TIER_FEATURES.starter.dealersFairUse} bayi (adil kullanım)</li>
              <li>💬 {TIER_FEATURES.starter.waMessagesFairUseMonth!.toLocaleString("tr-NL")} WA mesaj/ay</li>
              <li>📊 1 muhasebe yazılımı entegrasyonu</li>
              <li>📧 E-mail destek (24h)</li>
            </ul>
            <Link href={`/${locale}/register`} className="block text-center bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl transition font-medium text-sm">
              {t("pricing_starter_cta")}
            </Link>
          </div>

          {/* Growth (popüler) */}
          <div className="bg-indigo-50 rounded-2xl p-6 border-2 border-indigo-500 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
              {t("pricing_pro_badge")}
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Growth</h3>
            <p className="text-xs text-slate-500 mb-3">{tt("pricing_growth_desc")}</p>
            <div className="mb-4">
              <span className="text-3xl font-bold text-slate-900">€{growth.price}</span>
              <span className="text-slate-500 text-sm">{t("pricing_per_month")}</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1 mb-5">
              <li>👥 {TIER_FEATURES.growth.employees} çalışan</li>
              <li>🏪 {TIER_FEATURES.growth.dealersFairUse} bayi</li>
              <li>💬 {TIER_FEATURES.growth.waMessagesFairUseMonth!.toLocaleString("tr-NL")} WA mesaj/ay</li>
              <li>✨ Birden çok muhasebe yazılımı paralel</li>
              <li>✨ Pozisyon presetleri + AI tahsilat metni</li>
              <li>🎁 Setup ücretsiz dahil</li>
              <li>⚡ Priority destek (4h) + WA</li>
            </ul>
            <Link href={`/${locale}/register`} className="block text-center bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl transition font-medium text-sm">
              {t("pricing_pro_cta")}
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{t("pricing_pro")}</h3>
            <p className="text-xs text-slate-500 mb-3">{tt("pricing_pro_desc")}</p>
            <div className="mb-4">
              <span className="text-3xl font-bold text-slate-900">€{tenant.pricing.pro.price}</span>
              <span className="text-slate-500 text-sm">{t("pricing_per_month")}</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1 mb-5">
              <li>👥 Sınırsız çalışan</li>
              <li>🏪 Sınırsız bayi</li>
              <li>💬 Sınırsız WA mesaj</li>
              <li>✨ Growth&apos;taki her şey</li>
              <li>🌐 Multi-territory hiyerarşi</li>
              <li>🔌 REST API + müşteriye özel entegrasyonlar</li>
              <li>📋 Audit log + compliance</li>
              <li>🎁 Setup ücretsiz dahil</li>
              <li>👤 Dedicated AM (1h) + Slack</li>
            </ul>
            <Link href={`/${locale}/register`} className="block text-center bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl transition font-medium text-sm">
              {t("pricing_pro_cta")}
            </Link>
          </div>
        </div>

        {setup && (
          <div className="mt-8 max-w-2xl mx-auto bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{tt("setup_label")}: </span>
              <span className="text-slate-900 font-bold">€{setup.price}</span>
              {setup.installments > 1 && (
                <span className="text-slate-500 text-xs ml-2">({tt("setup_installments", { count: setup.installments })})</span>
              )}
            </p>
          </div>
        )}
      </div>
      <div className="absolute bottom-3 left-4">
        <RevisionBadge componentKey="pricing" locale={revisionLocale} theme="light" labels={revisionLabels} />
      </div>
    </section>
  );
}
