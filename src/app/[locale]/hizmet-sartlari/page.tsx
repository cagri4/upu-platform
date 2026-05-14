/**
 * /tr/hizmet-sartlari — Hizmet Şartları (ToS) v1 (Faz 7.1a + Sprint A tenant-aware).
 *
 * Tenant resolution: ?tenant=<key> > middleware x-tenant-key header > "emlak" default.
 */
import { headers } from "next/headers";
import { BackButton } from "@/components/banking/BackButton";
import { resolveLegalTenantContext } from "@/platform/legal/tenant-context";

export const metadata = {
  title: "Hizmet Şartları · UPU Platform",
  description: "Hizmet kullanım koşulları — üyelik, ücret, fesih ve sorumluluk düzenlemeleri.",
};

export default async function HizmetSartlariPage({
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

  // ToS section 3 "İçerik doğruluğu" maddesi tenant'a göre dilini değiştirir.
  const contentAccuracy =
    ctx.key === "bayi"
      ? "Sisteme girdiğiniz bayi, sipariş, fatura ve tahsilat kayıtlarının doğru, güncel ve yasal olduğundan emin olmak."
      : "Yüklediğiniz ilan, müşteri ve fotoğraf bilgilerinin doğru, güncel ve yasal olduğundan emin olmak.";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      <header className="px-4 py-4">
        <BackButton />
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
            Hizmet Şartları
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

          <Section number={1} title="Hizmet Tanımı">
            <p>{ctx.serviceDescription}</p>
            <p>
              Hizmet; profesyonel kullanıcılar ve ticari işletmeler için tasarlanmıştır.
              Tüketicilere doğrudan satış veya hizmet sunumu yapmamaktadır; yalnızca yetkili
              profesyonellerin iş süreçlerini dijitalleştiren bir araçtır.
            </p>
          </Section>

          <Section number={2} title="Hesap Oluşturma ve Üyelik">
            <p>
              Platform&apos;u kullanabilmek için WhatsApp veya Google ile hesap oluşturmanız
              gerekmektedir. Hesap oluşturarak:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>18 yaşından büyük olduğunuzu beyan edersiniz.</li>
              <li>{ctx.audienceClaim}</li>
              <li>Verdiğiniz bilgilerin doğru ve güncel olduğunu kabul edersiniz.</li>
              <li>Hesabınızın güvenliğinden bizzat sorumlu olduğunuzu kabul edersiniz.</li>
            </ul>
            <p>
              Hesabınızı başkasıyla paylaşmanız, sahte bilgi vermeniz veya kötüye kullanmanız
              halinde, herhangi bir bildirimde bulunmaksızın hesabınızı askıya alma veya
              kapatma hakkımızı saklı tutarız.
            </p>
          </Section>

          <Section number={3} title="Üye Sorumlulukları">
            <p>Platform&apos;u kullanırken aşağıdaki yükümlülüklerinizi kabul edersiniz:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-slate-900 dark:text-white">İçerik doğruluğu:</strong>{" "}
                {contentAccuracy}
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">KVKK / GDPR uyumu:</strong>{" "}
                Üçüncü kişilere ait kişisel verileri Platform&apos;a girerken ilgili kişilerden
                gerekli açık rızayı aldığınızı garanti etmek. Yetkisiz veri girişinin sorumluluğu
                tarafınıza aittir.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Telif hakkı:</strong> Yalnızca
                kullanım hakkına sahip olduğunuz fotoğraf, metin ve marka içeriklerini yüklemek.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Yasal kullanım:</strong>{" "}
                Platform&apos;u yasa dışı, yanıltıcı, dolandırıcılık veya spam amaçlı
                kullanmamak.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Sistem bütünlüğü:</strong>{" "}
                Otomatik araç, bot, kazıma (scraping) veya tersine mühendislik yöntemleriyle
                Platform&apos;a erişmeye çalışmamak.
              </li>
            </ul>
          </Section>

          <Section number={4} title="Ücretler ve Ödeme">
            <p>
              Platform&apos;un belirli özellikleri ücretsiz, belirli özellikleri ise abonelik
              karşılığında sunulmaktadır. Güncel paketler ve fiyatlar panel içinde
              gösterilmektedir.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-slate-900 dark:text-white">Ödeme sağlayıcı:</strong>{" "}
                Tüm ödemeler Mollie B.V. üzerinden işlenir. UPU Dev kart bilgilerinizi saklamaz.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Fatura:</strong> Hollanda BV
                usulüne göre KDV dahil/hariç fatura düzenlenir. Faturalar panel içinden
                indirilebilir.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Otomatik yenileme:</strong>{" "}
                Aboneliğiniz iptal etmediğiniz sürece her dönem sonunda otomatik yenilenir.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Fiyat değişiklikleri:</strong>{" "}
                Fiyat güncellemeleri en az 30 gün önceden e-posta ile bildirilir; yeni fiyat
                bir sonraki dönemden itibaren geçerlidir.
              </li>
            </ul>
          </Section>

          <Section number={5} title="Abonelik İptali ve Fesih">
            <p>
              Aboneliğinizi istediğiniz zaman panel → Ayarlar bölümünden iptal edebilirsiniz.
              İptal sonrası mevcut dönem sonuna kadar hizmete erişiminiz devam eder.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Dönem ortası iptallerde iade koşulları{" "}
                <a href={`/tr/iade-iptal?tenant=${ctx.key}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">
                  İade ve İptal Politikası
                </a>{" "}
                dokümanında belirtilmiştir.
              </li>
              <li>
                Hesabınızı kalıcı olarak silmek isterseniz info@upudev.nl adresinden talep
                edebilirsiniz; talep en geç 90 gün içinde işlenir.
              </li>
              <li>
                UPU Dev, bu sözleşmenin ihlali halinde aboneliği derhal feshetme ve yasal yollara
                başvurma hakkını saklı tutar.
              </li>
            </ul>
          </Section>

          <Section number={6} title="Fikri Mülkiyet">
            <p>
              Platform&apos;un yazılım kodu, arayüzü, marka ve logoları UPU Dev&apos;e aittir.
              Üyelik, size yalnızca hizmeti kullanma hakkı tanır; herhangi bir lisans veya
              mülkiyet devri içermez.
            </p>
            <p>
              Platform&apos;a yüklediğiniz içerikler size aittir. UPU Dev, yalnızca hizmeti
              sunmak için gereken ölçüde bu içerikleri işleme yetkisine sahiptir; içeriği üçüncü
              taraflarla ticari amaçla paylaşmaz.
            </p>
          </Section>

          <Section number={7} title="Hizmet Sınırlamaları">
            <p>
              Platform, &ldquo;olduğu gibi&rdquo; (as-is) sunulmaktadır. Hizmetin kesintisiz,
              hatasız veya her durumda erişilebilir olacağına dair açık veya zımni bir garanti
              verilmemektedir.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Planlı bakımlar mümkün olduğunca önceden duyurulur.</li>
              <li>Üçüncü taraf servis sağlayıcılardan (Supabase, Vercel, Mollie, Meta) kaynaklanan kesintiler için sorumluluk taşımayız.</li>
              <li>Acil güvenlik durumlarında hizmet bildirimsiz olarak kısıtlanabilir.</li>
            </ul>
          </Section>

          <Section number={8} title="Sorumluluk Sınırları">
            <p>
              Yasaların izin verdiği azami ölçüde, UPU Dev&apos;in toplam sorumluluğu, ihlal
              tarihinden önceki 12 aylık dönemde tarafınızca ödenen abonelik ücretleri tutarı ile
              sınırlıdır.
            </p>
            <p>
              UPU Dev hiçbir koşulda aşağıdakilerden sorumlu tutulamaz:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dolaylı, arızi veya sonuç olarak doğan zararlar</li>
              <li>Kâr, müşteri veya iş kaybı</li>
              <li>Veri kaybı (yasal olarak yedek alma yükümlülüğümüz olmadıkça)</li>
              <li>Üçüncü taraf hizmetlerinden kaynaklanan zararlar</li>
            </ul>
            <p>
              Bu sınırlamalar, Hollanda&apos;daki tüketici koruma haklarınızı veya kasıt ya da
              ağır kusur içeren durumlarda doğan haklarınızı etkilemez.
            </p>
          </Section>

          <Section number={9} title="Sözleşme Değişiklikleri">
            <p>
              Hizmet Şartları gerektiğinde güncellenebilir. Önemli değişiklikler en az 30 gün
              önceden e-posta veya panel içi bildirim ile duyurulur. Yeni şartları kabul
              etmediğiniz durumda aboneliğinizi iptal etme hakkınız bulunmaktadır; değişiklik
              yürürlüğe girdikten sonra hizmetin kullanımına devam etmeniz yeni şartların
              kabulü anlamına gelir.
            </p>
          </Section>

          <Section number={10} title="Uyuşmazlık Çözümü">
            <p>
              Bu sözleşme Hollanda hukukuna tabidir. Taraflar arasında doğacak uyuşmazlıkların
              çözümünde Utrecht (Hollanda) mahkemeleri münhasıran yetkilidir.
            </p>
            <p>
              Tüketici sıfatıyla hareket eden üyelerin, ikamet ettikleri ülkenin tüketici
              koruma kanunlarından doğan dava açma hakları saklıdır. Uyuşmazlıkları dostane
              yollarla çözmeyi tercih ederiz; lütfen mahkemeye başvurmadan önce
              info@upudev.nl adresinden bizimle iletişime geçin.
            </p>
          </Section>

          <footer className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              Bu metin avukat onayı bekleyen ilk versiyondur (v1). Hukuki inceleme tamamlandığında
              v2&apos;ye güncellenecektir.
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
