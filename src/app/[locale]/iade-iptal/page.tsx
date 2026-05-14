/**
 * /tr/iade-iptal — İade ve İptal Politikası v1 (Faz 7.1a + Sprint A tenant-aware).
 *
 * Tenant resolution: ?tenant=<key> > middleware x-tenant-key header > "emlak" default.
 */
import { headers } from "next/headers";
import { BackButton } from "@/components/banking/BackButton";
import { resolveLegalTenantContext } from "@/platform/legal/tenant-context";

export const metadata = {
  title: "İade ve İptal Politikası · UPU Platform",
  description: "Abonelik iptali, dönem ortası iade ve ödeme iade süreçleri.",
};

export default async function IadeIptalPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const sp = await searchParams;
  const h = await headers();
  const ctx = await resolveLegalTenantContext({
    searchParamTenant: sp.tenant ?? null,
    headerTenant: h.get("x-tenant-key"),
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      <header className="px-4 py-4">
        <BackButton />
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
            İade ve İptal Politikası
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Versiyon v1 · Yürürlük: 14 Mayıs 2026
          </p>
        </div>

        <article className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-6 text-slate-700 dark:text-slate-300 text-[15px] leading-relaxed">
          <header className="pb-4 border-b border-slate-200 dark:border-slate-800 space-y-1 text-sm">
            <p><strong className="text-slate-900 dark:text-white">Hizmet Sağlayıcı:</strong> {ctx.brandFull}</p>
            <p><strong className="text-slate-900 dark:text-white">Adres:</strong> Computerweg 22, 3542 DR, Utrecht, The Netherlands</p>
            <p><strong className="text-slate-900 dark:text-white">İletişim:</strong> info@upudev.nl</p>
          </header>

          <Section number={1} title="Abonelik İptali">
            <p>
              Aboneliğinizi istediğiniz an, hiçbir gerekçe sunmaksızın iptal edebilirsiniz.
              İptal işlemi anında geçerli olur; ek bir ücret veya cezai şart uygulanmaz.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                İptal için: <strong className="text-slate-900 dark:text-white">Panel → Ayarlar → Hesap</strong>{" "}
                bölümünden &ldquo;Üyeliği İptal Et&rdquo; aksiyonunu kullanabilirsiniz.
              </li>
              <li>
                İptalin onaylanması için güvenlik amaçlı WhatsApp doğrulama kodu (OTP) talep
                edilir.
              </li>
              <li>
                İptal sonrası mevcut ödeme döneminin sonuna kadar (örn. ayın son günü) hizmete
                erişiminiz devam eder; ardından otomatik yenileme durdurulur.
              </li>
              <li>
                Hesabınızdaki içerikler silinmez — yeniden abone olduğunuzda kaldığınız yerden
                devam edersiniz.
              </li>
            </ul>
          </Section>

          <Section number={2} title="Dönem Ortası İptal ve İade">
            <p>
              Abonelikler dönemsel (aylık veya yıllık) olarak ücretlendirildiğinden, dönem
              ortasında yapılan iptaller için kural olarak orantılı iade yapılmamaktadır.
              Bu, hizmetin sürekli erişime açık olması ve dönem boyunca sabit kaynak ayrılması
              nedeniyledir.
            </p>
            <p>
              Aşağıdaki istisnai durumlarda orantılı (pro-rata) iade talep edebilirsiniz:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-slate-900 dark:text-white">Teknik arıza:</strong> Bizim
                kaynaklı 72 saatten uzun süreli kesinti yaşanması.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Hizmet eksikliği:</strong>{" "}
                Abonelik paketinde vaat edilen önemli bir özelliğin sunulamaması.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Mükerrer çekim:</strong> Aynı
                dönem için yanlışlıkla birden fazla ödeme tahsil edilmesi.
              </li>
            </ul>
            <p>
              İade talepleri info@upudev.nl adresine yazılı olarak iletilmelidir. Talep en geç
              5 iş günü içinde değerlendirilip yanıtlanır.
            </p>
          </Section>

          <Section number={3} title="Ödeme Kanalı İadesi (Mollie)">
            <p>
              Tüm ödemeler Mollie B.V. üzerinden işlenir. Onaylanan iadeler:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Ödemenin yapıldığı orijinal yönteme (kredi kartı, banka transferi, iDEAL, vb.)
                geri yansıtılır.
              </li>
              <li>
                Mollie&apos;de iade işlemi tamamlandıktan sonra banka/kart sağlayıcısına bağlı
                olarak hesabınıza yansıması <strong className="text-slate-900 dark:text-white">5–10 iş günü</strong> sürebilir.
              </li>
              <li>
                İade tutarı, varsa banka tarafından uygulanan ek işlem ücretlerini kapsamaz.
              </li>
              <li>
                İade durumunu Mollie&apos;den e-posta ile aldığınız işlem referansıyla takip
                edebilirsiniz.
              </li>
            </ul>
          </Section>

          <Section number={4} title="14 Günlük Cayma Hakkı (AB Tüketici Koruma)">
            <p>
              Hollanda ve Avrupa Birliği tüketici koruma mevzuatı (Avrupa Birliği Tüketici
              Hakları Direktifi 2011/83/EU) uyarınca, <strong className="text-slate-900 dark:text-white">tüketici sıfatıyla</strong>{" "}
              abonelik başlatan kullanıcılar, ilk abonelik tarihinden itibaren 14 gün içinde
              herhangi bir gerekçe sunmaksızın cayma hakkına sahiptir.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Bu hak <strong className="text-slate-900 dark:text-white">yalnızca bireysel
                tüketicilere</strong> tanınmıştır. {ctx.brand} profesyonel bir araç olduğundan,
                ticari hesaplar (B2B aboneler) bu haktan yararlanamaz.
              </li>
              <li>
                Hizmeti 14 gün içinde aktif olarak kullanmaya başladığınızda dijital içerik
                istisnası kapsamında cayma hakkınızdan feragat etmiş sayılırsınız. Bu durum
                ödeme öncesi açıkça onaylanır.
              </li>
              <li>
                Cayma hakkını kullanmak için info@upudev.nl adresine yazılı bildirim yeterlidir.
                Talep edilen iade en geç 14 gün içinde başlatılır.
              </li>
            </ul>
          </Section>

          <Section number={5} title="İletişim ve İtiraz">
            <p>
              İade kararına itiraz etmek veya politikayla ilgili sorularınız için:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-slate-900 dark:text-white">E-posta:</strong>{" "}
                <a href="mailto:info@upudev.nl" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                  info@upudev.nl
                </a>
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Posta adresi:</strong> UPU Dev,
                Computerweg 22, 3542 DR, Utrecht, The Netherlands
              </li>
            </ul>
            <p>
              Hollanda&apos;da yerleşik tüketiciler{" "}
              <a
                href="https://www.consuwijzer.nl/"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
                rel="noopener noreferrer"
              >
                ConsuWijzer
              </a>{" "}
              veya Avrupa Birliği genelinde{" "}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
                rel="noopener noreferrer"
              >
                AB ODR platformu
              </a>{" "}
              üzerinden alternatif uyuşmazlık çözümünden faydalanabilir.
            </p>
          </Section>

          <footer className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              Bu metin avukat onayı bekleyen ilk versiyondur (v1). Hukuki inceleme tamamlandığında
              güncellenecektir.
            </p>
          </footer>
        </article>

        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Sorularınız için:{" "}
          <a href="mailto:info@upudev.nl" className="text-emerald-600 dark:text-emerald-400 hover:underline">
            info@upudev.nl
          </a>
        </p>
      </main>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        {number}. {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
