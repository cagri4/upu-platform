import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("legal");

  const sections: Array<[string, string, boolean?]> = [
    ["terms_service_h", "terms_service_b"],
    ["terms_account_h", "terms_account_b"],
    ["terms_payment_h", "terms_payment_b"],
    ["terms_refund_h", "terms_refund_b", true],   // highlighted refund block
    ["terms_fairuse_h", "terms_fairuse_b"],
    ["terms_termination_h", "terms_termination_b"],
    ["terms_liability_h", "terms_liability_b"],
    ["terms_jurisdiction_h", "terms_jurisdiction_b"],
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/50 p-8">
        <Link href={`/${locale}`} className="text-sm text-slate-500 hover:text-slate-800 mb-6 inline-block">
          {t("back")}
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t("terms_title")}</h1>
        <p className="text-xs text-slate-400 mb-6">{t("last_updated")}</p>
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-8">{t("terms_intro")}</p>

        <div className="space-y-6">
          {sections.map(([h, b, highlight]) => (
            <section
              key={h}
              className={highlight ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-5" : ""}
            >
              <h2 className={`text-lg font-semibold mb-2 ${highlight ? "text-emerald-900" : "text-slate-900 dark:text-slate-100"}`}>
                {highlight ? "🔒 " : ""}{t(h as "terms_service_h")}
              </h2>
              <p className={`leading-relaxed ${highlight ? "text-emerald-900" : "text-slate-700 dark:text-slate-300"}`}>
                {t(b as "terms_service_b")}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800/50">
          <p className="text-sm text-slate-600 dark:text-slate-400">{t("terms_contact")}</p>
        </div>
      </div>
    </div>
  );
}
