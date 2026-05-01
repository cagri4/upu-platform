import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("legal");

  const sections: Array<[string, string]> = [
    ["privacy_data_h", "privacy_data_b"],
    ["privacy_use_h", "privacy_use_b"],
    ["privacy_share_h", "privacy_share_b"],
    ["privacy_rights_h", "privacy_rights_b"],
    ["privacy_retention_h", "privacy_retention_b"],
    ["privacy_security_h", "privacy_security_b"],
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <Link href={`/${locale}`} className="text-sm text-slate-500 hover:text-slate-800 mb-6 inline-block">
          {t("back")}
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{t("privacy_title")}</h1>
        <p className="text-xs text-slate-400 mb-6">{t("last_updated")}</p>
        <p className="text-slate-700 leading-relaxed mb-8">{t("privacy_intro")}</p>

        <div className="space-y-6">
          {sections.map(([h, b]) => (
            <section key={h}>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">{t(h as "privacy_data_h")}</h2>
              <p className="text-slate-700 leading-relaxed">{t(b as "privacy_data_b")}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-600">{t("privacy_contact")}</p>
        </div>
      </div>
    </div>
  );
}
