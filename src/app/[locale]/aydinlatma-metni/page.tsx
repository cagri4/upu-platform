/**
 * /tr/aydinlatma-metni — KVKK Aydınlatma Metni (Faz 7.0).
 *
 * Static sayfa, banking style + dark mode. KvkkConsentModal'dan ve
 * /tr/uye-ol checkbox link'inden açılır. İçerik versiyonu v1.
 */
import { BackButton } from "@/components/banking/BackButton";

export const metadata = {
  title: "Aydınlatma Metni · UPU Emlak",
  description: "UPU Emlak KVKK Aydınlatma Metni — kişisel verilerinizin işlenmesi hakkında bilgilendirme.",
};

export default function AydinlatmaMetniPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      <header className="px-4 py-4">
        <BackButton />
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
            Kişisel Verilerin Korunması Aydınlatma Metni
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Versiyon v1 · Yürürlük: 13 Mayıs 2026
          </p>
        </div>

        <article className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-6 text-slate-700 dark:text-slate-300 text-[15px] leading-relaxed">
          <header className="pb-4 border-b border-slate-200 dark:border-slate-800 space-y-1 text-sm">
            <p><strong className="text-slate-900 dark:text-white">Veri Sorumlusu:</strong> UPU Emlak / UPU Dev</p>
            <p><strong className="text-slate-900 dark:text-white">Yürürlük tarihi:</strong> 13.05.2026</p>
            <p><strong className="text-slate-900 dark:text-white">Versiyon:</strong> v1</p>
          </header>

          <Section number={1} title="Giriş">
            <p>
              UPU Emlak (&ldquo;Platform&rdquo;), 6698 sayılı{" "}
              <strong className="text-slate-900 dark:text-white">Kişisel Verilerin Korunması Kanunu</strong>{" "}
              (&ldquo;KVKK&rdquo;) kapsamında veri sorumlusu sıfatıyla hareket etmektedir. Bu metin,
              kişisel verilerinizin tarafımızca nasıl toplandığı, işlendiği ve korunduğu hakkında
              sizi bilgilendirmek amacıyla hazırlanmıştır.
            </p>
          </Section>

          <Section number={2} title="İşlenen Kişisel Verileriniz">
            <p>Platform&apos;umuzu kullanırken aşağıdaki kişisel verileriniz işlenmektedir:</p>

            <SubHeading>Kimlik bilgileri</SubHeading>
            <ul className="list-disc pl-5 space-y-1">
              <li>Ad, soyad</li>
              <li>E-posta adresi</li>
              <li>Telefon numarası (WhatsApp dahil)</li>
            </ul>

            <SubHeading>İletişim verileri</SubHeading>
            <ul className="list-disc pl-5 space-y-1">
              <li>WhatsApp üzerinden gönderdiğiniz mesajlar</li>
              <li>Bot komutları ve etkileşim geçmişiniz</li>
            </ul>

            <SubHeading>Hizmet kullanım verileri</SubHeading>
            <ul className="list-disc pl-5 space-y-1">
              <li>Mülk ilanları (yüklediğiniz fotoğraf ve açıklamalar dahil)</li>
              <li>Müşteri bilgileri (sizin tarafınızdan girilen iletişim ve takip verileri)</li>
              <li>Sözleşme ve sunum içerikleri</li>
              <li>Hesap tercihleri ve ayarlar</li>
            </ul>

            <SubHeading>Teknik veriler</SubHeading>
            <ul className="list-disc pl-5 space-y-1">
              <li>IP adresi (yalnızca güvenlik kayıtları için)</li>
              <li>Tarayıcı bilgileri ve cihaz tipi</li>
              <li>Çerez ve oturum verileri</li>
              <li>Üyelik durumu ve abonelik bilgileri</li>
            </ul>

            <SubHeading>Üçüncü taraf entegrasyon verileri</SubHeading>
            <ul className="list-disc pl-5 space-y-1">
              <li>Google hesap bilgisi (e-posta, ad — yalnızca Google ile giriş tercih ederseniz)</li>
            </ul>
          </Section>

          <Section number={3} title="Kişisel Verilerin İşlenme Amaçları">
            <p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Hesap oluşturma ve kimlik doğrulama</li>
              <li>Hizmet sunumu ve teknik destek</li>
              <li>Mülk yönetimi, müşteri ve sözleşme süreçlerinin yürütülmesi</li>
              <li>WhatsApp üzerinden bildirim, hatırlatma ve etkileşim sağlanması</li>
              <li>Üyelik ve abonelik yönetimi (ödeme dahil)</li>
              <li>İstatistiksel analiz ve hizmet iyileştirme (anonimleştirilmiş)</li>
              <li>Hukuki yükümlülüklerin yerine getirilmesi</li>
              <li>Olası uyuşmazlıkların çözümü</li>
            </ul>
          </Section>

          <Section number={4} title="Veri Aktarımı">
            <p>
              Kişisel verileriniz, aşağıdaki hizmet sağlayıcılara işleme amaçlarıyla sınırlı olarak
              aktarılabilir:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-slate-900 dark:text-white">Supabase</strong> (PostgreSQL ve kimlik altyapısı — Frankfurt/AB, GDPR uyumlu)</li>
              <li><strong className="text-slate-900 dark:text-white">Vercel</strong> (uygulama barındırma — AB sunucuları)</li>
              <li><strong className="text-slate-900 dark:text-white">Mollie</strong> (ödeme işleme — Hollanda, PCI DSS Level 1)</li>
              <li><strong className="text-slate-900 dark:text-white">Meta WhatsApp Business Cloud API</strong> (mesajlaşma — global)</li>
              <li><strong className="text-slate-900 dark:text-white">Google</strong> (yalnızca Google ile giriş tercih ederseniz)</li>
            </ul>
            <p>
              Yurt dışına aktarım, KVKK madde 9 kapsamında veri sahibinin açık rızasıyla ve/veya
              yeterli koruma sağlayan ülkeler/standart sözleşmeler aracılığıyla yapılmaktadır.
            </p>
          </Section>

          <Section number={5} title="Kişisel Verilerin Toplanma Yöntemi">
            <p>Verileriniz:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>WhatsApp bot üzerinden,</li>
              <li>Web panelimiz aracılığıyla,</li>
              <li>Üçüncü taraf kimlik sağlayıcılar (Google) üzerinden</li>
            </ul>
            <p>elektronik ortamda toplanmaktadır.</p>
          </Section>

          <Section number={6} title="Hukuki Sebep">
            <p>Kişisel verileriniz, KVKK madde 5/2 ve 6/2 kapsamında:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Sözleşmenin kurulması ve ifası,</li>
              <li>Hukuki yükümlülüğün yerine getirilmesi,</li>
              <li>Veri sahibinin açık rızası</li>
            </ul>
            <p>hukuki sebeplerine dayalı olarak işlenmektedir.</p>
          </Section>

          <Section number={7} title="Veri Saklama Süresi">
            <ul className="list-disc pl-5 space-y-1">
              <li>Aktif hesap verileri: Üyelik süresi boyunca ve KVKK / VUK madde 253 uyarınca ek 10 yıl</li>
              <li>Hesap silinmesi halinde: Hukuki yükümlülük gerekleri saklı kalmak kaydıyla 90 gün içinde silme</li>
              <li>Bot mesaj geçmişi: 12 ay</li>
              <li>Ödeme kayıtları: Vergi mevzuatı gereği 10 yıl</li>
            </ul>
          </Section>

          <Section number={8} title="Veri Sahibi Hakları (KVKK Madde 11)">
            <p>KVKK madde 11 kapsamında aşağıdaki haklarınız bulunmaktadır:</p>
            <ol className="list-[lower-alpha] pl-5 space-y-1">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme</li>
              <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
              <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
              <li>KVKK madde 7 kapsamında silinmesini veya yok edilmesini isteme</li>
              <li>Bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme</li>
              <li>Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme</li>
              <li>Kanuna aykırı işlemden zarar görmeniz halinde tazminat talep etme</li>
            </ol>
            <p>Bu haklarınızı kullanmak için:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Panel → Ayarlar → &ldquo;Gizlilik ve Veriler&rdquo; bölümünden talep oluşturabilirsiniz</li>
              <li>
                <a href="mailto:info@upudev.nl" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                  info@upudev.nl
                </a>{" "}
                adresine yazılı başvuru yapabilirsiniz
              </li>
            </ul>
            <p>Talebiniz en geç 30 gün içinde sonuçlandırılır.</p>
          </Section>

          <Section number={9} title="Çerez Kullanımı">
            <p>
              Platform, hizmetin sunulabilmesi için zorunlu çerezler ile tercihinizle aktif
              edilebilen analitik çerezler kullanır. Çerez tercihleri ilk girişte sorulmaktadır ve
              istediğiniz zaman panel üzerinden değiştirebilirsiniz.
            </p>
          </Section>

          <Section number={10} title="Güvenlik Önlemleri">
            <ul className="list-disc pl-5 space-y-1">
              <li>TLS 1.3 şifreleme (tüm bağlantılar)</li>
              <li>HttpOnly + Secure cookie ile oturum koruması</li>
              <li>WhatsApp OTP step-up doğrulama (hassas işlemlerde)</li>
              <li>AB merkezli, GDPR uyumlu altyapı sağlayıcıları</li>
              <li>Periyodik güvenlik gözden geçirmeleri</li>
            </ul>
          </Section>

          <Section number={11} title="Güncellemeler">
            <p>
              Bu metin gerektiğinde güncellenebilir. Önemli değişikliklerde sizi bilgilendirir ve
              onayınızı yeniden alırız.
            </p>
          </Section>

          <Section number={12} title="İletişim">
            <p>KVKK kapsamındaki tüm soru ve talepleriniz için:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-slate-900 dark:text-white">E-posta:</strong>{" "}
                <a href="mailto:info@upudev.nl" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                  info@upudev.nl
                </a>
              </li>
              <li><strong className="text-slate-900 dark:text-white">Adres:</strong> UPU Dev, Computerweg 22, 3542 DR, Utrecht, The Netherlands</li>
            </ul>
          </Section>

          <footer className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              Bu metnin son hukuki incelemesi yapıldığında v2&apos;ye güncellenecektir.
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

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-semibold text-slate-900 dark:text-white pt-1">{children}</h3>
  );
}
