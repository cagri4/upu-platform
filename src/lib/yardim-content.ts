/**
 * Emlak yardım merkezi — komut başına tutorial içerikleri.
 *
 * /tr/yardim ve /tr/yardim/[command] sayfaları bu dosyayı okur.
 * Yeni komut yardım sayfası eklemek için bu listeye yeni entry ekle.
 */

export interface YardimEntry {
  /** Komut adı — alias değil, kanonik (örn. "mulkekle"). URL slug'ı bu. */
  command: string;
  /** Menüde gösterilecek başlık (emoji + Türkçe). */
  title: string;
  /** Tek-cümlelik özet, listede gözükür. */
  summary: string;
  /** Detay sayfasının başında 1-2 cümle. */
  what: string;
  /** Nasıl kullanılır — sıralı adımlar. */
  how: string[];
  /** Somut örnek senaryo. */
  example: string;
  /** Sık sorulan sorular. */
  faq: Array<{ q: string; a: string }>;
  /** WA'da hangi komutu yazıyor (alias dahil olabilir). */
  waCommand: string;
  /**
   * Yönetim paneli (?) modal için pazarlama dili (5-7 cümle).
   * Hangi sorunu çözer, sahip için ne kazandırır odağında.
   */
  marketing?: string;
  /**
   * Panelde "Başlat" linki için yönlendirme. type=web → /tr/<path>?t=<token>;
   * type=wa → wa.me deeplink + text=command. Tutarsızlıkları engellemek için
   * her komut "nereden başlanır" bilgisini taşır.
   */
  startAction?: { type: "web"; path: string } | { type: "wa"; text: string };
  /** Panelde gösterilecek section başlığı. */
  panelSection?: string;
}

export const YARDIM_ENTRIES: YardimEntry[] = [
  {
    command: "mulkekle",
    title: "🏠 Mülk Ekle",
    summary: "Portföyüne yeni bir mülk ekle — form veya hızlı giriş.",
    panelSection: "🏠 Mülk Yönetimi",
    startAction: { type: "web", path: "/tr/mulkekle-form" },
    marketing:
      "Portföyünüzü dakikalar içinde dolup taşırın. Sahibinden saatlerce form doldurmaya gerek yok — bilgileri tek seferde girin, fotoğrafları yükleyin, sistem AI ile saniyeler içinde profesyonel sunum hazırlasın. " +
      "Yeni gelen müşterilere göstermeye hazır mülklerle iş yapma süreci 10× hızlanır. " +
      "*Sorunu çözer*: Portföyü hep güncel tutma stresi. *Kazandırır*: Müşteriye anında sunabileceğiniz, AI metinli, foto-zenginleştirilmiş ilan yapısı.",
    waCommand: "mulkekle",
    what: "Portföyüne yeni bir mülk (satılık veya kiralık) eklemek için kullanılır. Eklenen mülk, sunum oluştururken ve müşteri eşleştirirken hazır olur.",
    how: [
      "WhatsApp'ta *mulkekle* yaz veya menüden Mülk Ekle'yi seç.",
      "Sistem 2 yöntem sunar: 📝 *Form* (web, fotoğraf yüklemeli) veya ⚡ *Hızlı* (WhatsApp içi adım-adım).",
      "Form'u seçersen mekik link gelir — formu doldur, kaydet, WhatsApp'a dön.",
      "Hızlı'yı seçersen WhatsApp'tan başlık → fiyat → m² → oda → konum sırayla sorulur.",
      "İşlem bitince mülk *Mülklerim* listesinde görünür ve sunum/sözleşme akışlarında kullanılabilir.",
    ],
    example: "Yalıkavak'ta yeni satılık 3+1 daire kazandın. *mulkekle* yaz → Form aç → bilgileri ve 4-5 fotoğrafı yükle → kaydet. 2 dakika sonra sunum hazır.",
    faq: [
      { q: "Sahibinden linkini yapıştırabilir miyim?", a: "Şu an URL paste yöntemi kaldırıldı (5 Mayıs 2026). Form'da bilgileri elle gir veya Hızlı yöntem kullan — fotoğrafları formdan yükleyebilirsin." },
      { q: "Eksik bilgi yazarsam?", a: "Sorun değil; sonradan *mulklerim* → mülk seç → Düzenle ile tamamlayabilirsin." },
    ],
  },
  {
    command: "musteriEkle",
    title: "👥 Müşteri Ekle",
    summary: "Alıcı / kiracı / mülk sahibi kaydı — multi-select kriterlerle.",
    panelSection: "👥 Müşteri Yönetimi",
    startAction: { type: "web", path: "/tr/musteri-ekle-form" },
    marketing:
      "Telefon defterindeki müşteriyi sisteme tek seferde aktarın. Aradığı kriterler (satılık + kiralık, bütçe, lokasyon, oda) işaretlensin — bir sonraki gün portföyünüze yeni mülk girince sistem otomatik eşleştirir, *fırsatı kaçırma riski sıfır*. " +
      "Müşteri segmentasyonu, kampanya hedefi ve sonradan iletişim planlaması artık bir Excel kaosu değil — tek panelde yönetilen yapısal müşteri tabanı. " +
      "*Sorunu çözer*: Hangi müşteri ne istiyordu? *Kazandırır*: Her müşteriye doğru mülkü zamanında gösterme refleksi.",
    waCommand: "musteriEkle",
    what: "Müşterinin (alıcı, kiracı veya satıcı) bilgilerini ve aradığı kriterleri sisteme kaydeder. Sonradan eşleştirme, sözleşme ve sunum için kullanılır.",
    how: [
      "*musteriekle* yaz — sana bir form linki gönderilir.",
      "Form'da: ad, telefon, e-posta, *aradığı ilan tipi* (Satılık / Kiralık — birden fazla seçilebilir), mülk tipi, oda, bütçe, bölge, not.",
      "Kaydet butonuna bas → WhatsApp'a dön.",
      "Sonra: müşteri için sözleşme hazırla, eşleştirme yap veya sunum gönder.",
    ],
    example: "Telefonla aramış bir müşteri var: hem satılık hem kiralık daire arıyor, bütçe 5-8M. Form'da *Satılık + Kiralık*'ı işaretle, bütçe gir, kaydet. Müşteri kart'ında 🏷🔑 ikonu çıkar.",
    faq: [
      { q: "İki ilan tipini de seçemiyor muyum?", a: "Seçebilirsin. 5 Mayıs 2026'dan beri multi-select var; en az 1 seçim zorunlu." },
      { q: "Müşteriyi sonra silebilir miyim?", a: "Evet. *musterilerim* → Detaylı Liste → kart'ta 🗑️ butonuyla sil (geri alınamaz; istisnai durumda destekle iletişime geç)." },
    ],
  },
  {
    command: "sunumolustur",
    title: "🎯 Sunum Oluştur",
    summary: "AI ile müşteri sunumu — link halinde paylaş.",
    panelSection: "🎯 Müşteriye Sunum",
    startAction: { type: "wa", text: "sunumolustur" },
    marketing:
      "AI ile saniyeler içinde profesyonel sunum hazırlayın. Mülklerinizi seçin — sistem başlık, açıklama, öne çıkan özellikleri satış diline çevirir, müşteri-bazlı kişisel selamlama metni ekler. " +
      "Tek link halinde WhatsApp'tan paylaşın — müşteri mobilde galeri formatında görsün, beğenirse direkt iletişim butonu. " +
      "*Sorunu çözer*: PDF/PowerPoint zaman israfı. *Kazandırır*: Görüşmeden çıktıktan 90 saniye sonra müşteri elinde size özel sunumla buluşur.",
    waCommand: "sunumolustur",
    what: "Portföyündeki bir veya birkaç mülk için hazır şablon + AI metinli, satış-odaklı bir sunum hazırlar. Sunum bir magic link halinde — WhatsApp'tan müşteriye gönderebilirsin.",
    how: [
      "*sunumolustur* yaz veya menüden Sunum Oluştur'u seç.",
      "Sunuma dahil edilecek mülkleri seç (1 veya birkaç).",
      "Müşteri seç (opsiyonel — sunum başında müşteri adı görünür).",
      "AI başlık + açıklama + öne çıkan özellikler oluşturur. Düzenleyebilirsin.",
      "Bitince sana magic link döner. Kopyala, müşteriye WhatsApp'tan gönder.",
    ],
    example: "Müşterine 3 farklı daire sunmak istiyorsun. *sunumolustur* → 3 daireyi seç → müşteri ismini gir → AI metnine göz at → linki paylaş. Müşteri linke tıkladığında mobil-uyumlu galeri açılır.",
    faq: [
      { q: "Eski sunumumu nasıl bulurum?", a: "*sunumlarim* yaz — son sunumların listesi." },
      { q: "Sunum içeriğini sonra düzenleyebilir miyim?", a: "Evet. Sunumlarım → sunum seç → Slide düzenle." },
    ],
  },
  {
    command: "sozlesme",
    title: "📋 Sözleşme Yap",
    summary: "Yetkilendirme sözleşmesi oluştur + mülk sahibine imza linki gönder.",
    panelSection: "🎯 Müşteriye Sunum",
    startAction: { type: "wa", text: "sozlesme" },
    marketing:
      "Yetkilendirme sözleşmenizi e-imza ile saniyede tamamlayın. Mülk seç, sahibinin TC + telefon, münhasırlık + komisyon — sistem PDF üretir + sahibe magic imza linki yollar. " +
      "Sahibi tek tıkla telefonundan imzalar; siz bekleme süresi olmadan sürece devam edersiniz. Eski \"şehre git, kağıt imzalat\" döngüsü tarihte kaldı. " +
      "*Sorunu çözer*: Sözleşme alma stresi + zaman kaybı. *Kazandırır*: Yasal-bağlayıcı evrak, anlık imzalama, dijital arşiv.",
    waCommand: "sozlesme",
    what: "Mülk sahibi ile yetkilendirme sözleşmesini WhatsApp üzerinden hazırlar. Bilgiler tamamlandığında PDF + magic imza linki üretilir; sahibi linke tıklayıp imzalar.",
    how: [
      "*sozlesme* yaz veya menüden Sözleşme Yap'ı seç.",
      "Mülk seç — portföyünden var olan biri veya \"manuel adres\".",
      "Sahibinin ad, TC, telefon bilgilerini gir.",
      "Münhasır mı? Komisyon? Süre? — sırayla buton/yazı ile yanıtla.",
      "Önizleme görüp Onayla'ya bas. PDF + imza linki üretilir.",
      "Linki sahibine WhatsApp'tan gönder. İmza tamamlanınca otomatik bilgi gelir.",
    ],
    example: "Dün gezdirdiğin mülkün sahibi sözleşmeye razı oldu. *sozlesme* → mülk seç → bilgileri gir → Onayla → linki sahibine gönder. 5 dakika sonra imzalı PDF elinde.",
    faq: [
      { q: "Sahibi linki açmadıysa?", a: "Link 7 gün geçerli. Hatırlatma için sahibe direkt ara veya tekrar paylaş." },
      { q: "Komisyon oranını sonra değiştirebilir miyim?", a: "Hayır, imzalanmış sözleşme değişmez. Yeni bir tane oluştur, eskisini iptal et." },
    ],
  },
  {
    command: "portfoyara",
    title: "🔍 Portföy Ara",
    summary: "Sahibinden'in dünkü sahibi ilanlarını kriterine göre filtrele.",
    panelSection: "📡 Pazar Tarama",
    startAction: { type: "web", path: "/tr/ara" },
    marketing:
      "Sahibinden bölgesindeki son 24 saatlik sahibi ilanları AI filtresinden geçirin — sahibinden müşterilerinin ilan attığı dakika size anında ulaştırın. " +
      "Müşteri kriterinize uyan tek tek değil, *demet halinde* fırsat — tek tıkla iletişim kurun. Rakipleriniz sabah saat 9'da ilanı bulurken siz akşam saat 6'dan beri görüşüyorsunuz. " +
      "*Sorunu çözer*: Bölgedeki yeni ilanları sürekli izlemek. *Kazandırır*: Pazar üstünlüğü + portföy büyütme.",
    waCommand: "portfoyara",
    what: "Bölgendeki son 24 saatteki yeni sahibi (emlakçısız) ilanları filtrelemek için. Her sabah otomatik brifing dışında istediğin zaman manuel arama yapabilirsin.",
    how: [
      "*portfoyara* yaz veya menüden Portföy Ara'yı seç.",
      "Sana web arama formu linki gelir — formu aç.",
      "İlan tipi (Satılık/Kiralık), mülk tipi, fiyat aralığı seç.",
      "Sonuçlar formun altında dökülür — Sahibinden linkleri tıklanabilir.",
      "Linke tıkla → kendi Sahibinden hesabınla telefonu reveal et → ara.",
    ],
    example: "Bir müşterin 10M altı satılık villa istiyor. *portfoyara* → form'da Satılık + Villa + max 10M → uyan ilanlar listede. Müşteriye link gönder veya kendin ara.",
    faq: [
      { q: "Bodrum dışı şehir görmüyorum", a: "Şu an sahibi-lead pipeline sadece Bodrum üzerinden çalışıyor. Multi-city desteği yol haritasında." },
      { q: "İlan sahibinin telefonu sistemde yok", a: "Doğru — biz reveal yapmıyoruz. Linke tıkla, kendi hesabından telefon görüntüle." },
    ],
  },
  {
    command: "musterilerim",
    title: "👥 Müşterilerim",
    summary: "Tüm müşteri tabanın — kartlı liste, edit/sil, kriter takibi.",
    panelSection: "👥 Müşteri Yönetimi",
    startAction: { type: "web", path: "/tr/musterilerim" },
    marketing:
      "Tüm müşteri verilerinizi tek panelde yönetin. Düzenle, sil, etiketle, kriterlerine uyan yeni mülk geldiğinde otomatik bildirim — hiçbir müşteri unutulmaz, hiçbir fırsat kaçırılmaz. " +
      "Müşteri kart layout'unda: aradığı tip (satılık + kiralık ayrı), bütçe, oda, lokasyon, son iletişim notu — her şey net. " +
      "*Sorunu çözer*: Müşteriyi aradığında Excel'de aramak. *Kazandırır*: Kim ne istiyor, nereden iletişim sürdürdün — anlık görünür CRM kokpiti.",
    waCommand: "musterilerim",
    what: "Portföyündeki tüm müşterilerini listeler. Web kart layout'unda her müşteri için aradığı kriterler, bütçe, son iletişim, edit/sil aksiyonları.",
    how: [
      "WhatsApp'ta *musterilerim* yaz veya menüden Müşterilerim'i seç.",
      "Sana web sayfası magic link gelir — aç.",
      "Her müşteri kartında: ad, telefon, aradığı tipler (🏷🔑), bütçe, lokasyon, not.",
      "Düzenle: form açılır, alanları güncelle.",
      "Sil: onay sonrası soft-delete (geri alma için destek).",
    ],
    example: "Hafta sonu yeni daire eklediğinde, önceki müşterilerinin hangisinin uygun olduğunu görmek istersin. *musterilerim* → web aç → kriterleri tara → eşleşeni ara, AI sunum gönder.",
    faq: [
      { q: "Müşteri kartına yeni alan eklenebilir mi?", a: "Şu an sabit alan. Etiket/tag özelliği yol haritasında." },
      { q: "Toplu kampanya gönderebilir miyim?", a: "Şu an manuel — her müşteriye sırayla mesaj. Kampanya özelliği planda." },
    ],
  },
  {
    command: "ilantakip",
    title: "📡 İlan Takip",
    summary: "Müşterine uygun yeni ilan çıkınca otomatik haber ver.",
    panelSection: "📡 Pazar Tarama",
    startAction: { type: "wa", text: "ilantakip" },
    marketing:
      "Müşterinize uygun çıkan yeni ilanları sabah brifingi olarak otomatik bildirelim. Bir kez kriter girin (lokasyon, oda, bütçe) — sistem her gece sahibinden bölgesini tarar, sabah 06:45'te uyan ilanları WhatsApp'a düşürür. " +
      "Sahibinden müşterilerine sabah saat 9'a kadar ulaşmak rakipsiz avantaj — *fırsat kaçmaz, biz ulaşırız*. " +
      "*Sorunu çözer*: Pazarı sürekli izlemenin imkânsızlığı. *Kazandırır*: Otomatik takip + ilk hareket avantajı.",
    waCommand: "ilantakip",
    what: "Sabah brifingi için sürekli kriter kaydı oluşturur. Sahibinden bölgenizi her gece tarayan sistem, sizin tanımladığınız tip/lokasyon/bütçe filtresine uyan yeni ilanları WhatsApp'a iletir.",
    how: [
      "WhatsApp'ta *ilantakip* yaz.",
      "Web form açılır — kriterleri seç (mülk tipi, lokasyon, bütçe aralığı).",
      "Kaydet → ertesi sabah 06:45'te kriter eşleşen ilanlar mesaj olarak gelir.",
      "Mesajdaki linke tıkla → sahibinden ilan detayı açılır → telefon görüntüle.",
      "Kriteri sonra değiştirmek için tekrar *ilantakip*.",
    ],
    example: "3 ay önce bir müşterin Yalıkavak'ta 5-8M arası villa istedi. *ilantakip* → kriter kaydı → her sabah eşleşen ilan listesi WA'na düşer → linke tıkla → telefonu reveal et → müşteri için iletişime geç.",
    faq: [
      { q: "Bodrum dışı şehir destekli mi?", a: "Şu an scrape pipeline Bodrum-only. İstanbul/Ankara desteği yol haritasında." },
      { q: "Birden fazla kriter girebilir miyim?", a: "Şu an tek aktif kriter. Multi-criteria yol haritasında." },
    ],
  },
  {
    command: "mulklerim",
    title: "📁 Mülklerim",
    summary: "Tüm portföyün — düzenle, sil, sunum gönder.",
    panelSection: "🏠 Mülk Yönetimi",
    startAction: { type: "web", path: "/tr/mulklerim" },
    marketing:
      "Tüm portföyünüz tek panelde — kart layout'unda fotoğraf, fiyat, oda + tek tıkla düzenle/sil. Hangi mülklerin sunumu hazır, hangileri eksik kalmış, hangilerine müşteri ilgisi var — net bir tabloda görün. " +
      "Müşteri görüşmesinde panel açık — müşteriye uyan mülkleri kartlarda gösterin, anında sunum gönderin. " +
      "*Sorunu çözer*: Excel'deki dağınık mülk listesi. *Kazandırır*: Profesyonel hissi yansıyan, üzerinde çalıştığınız aksiyonlu kokpit.",
    waCommand: "mulklerim",
    what: "Portföyündeki tüm mülklerin listesi. Web sayfasında her kartın altında Düzenle, Sil ve (varsa) Sunum'a Git butonları var.",
    how: [
      "*mulklerim* yaz — sana web sayfa linki gelir.",
      "Linke tıkla — kart layout'ta tüm mülklerin gösterilir (cover foto, başlık, fiyat, oda, m²).",
      "Düzenle: form açılır, alanları güncelle.",
      "Sil: onaylarsan kart kaldırılır (status='deleted', geri alınamaz).",
      "Sunum: o mülkün son sunumu varsa direkt galeri açılır.",
    ],
    example: "Sattığın mülkün hâlâ listede görünüyor. *mulklerim* → kart bul → 🗑️ Sil → onayla. Liste yenilenir.",
    faq: [
      { q: "Sildim ama vazgeçtim", a: "Soft-delete; destek ile iletişime geç, geri yükleyebiliriz." },
      { q: "Bir mülke fotoğraf eklemek?", a: "Düzenle → fotoğraf alanını kullan veya WA'da *fotograf* komutuyla mülk seç + foto gönder." },
    ],
  },
  {
    command: "websayfam",
    title: "🌐 Web Sayfam",
    summary: "Müşterilerine paylaştığın kişisel landing sayfası.",
    panelSection: "🪪 Profil",
    startAction: { type: "wa", text: "websayfam" },
    marketing:
      "Müşterilerinize WhatsApp'tan paylaşacağınız kişisel landing sayfası — fotoğraf, ofis bilgisi, hizmetlerin, referanslar ve aktif portföy listesi tek URL'de. " +
      "Yeni tanıştığınız müşteri linki açtığında profesyonel görünür, güven çağrıştırır, doğrudan iletişim butonuyla seninle bağlantı kurar. " +
      "*Sorunu çözer*: \"Kartınız var mı, kim olduğunuzu nereden bileyim\". *Kazandırır*: Kişisel marka + 7/24 çalışan dijital görünüm.",
    waCommand: "websayfam",
    what: "Kişisel landing sayfanızı düzenleme akışı. Foto, hizmetler, referanslar, aktif mülk listesi public URL'de gösterilir (/u/<slug>).",
    how: [
      "WhatsApp'ta *websayfam* yaz veya menüden Web Sayfam'ı seç.",
      "Düzenleme magic linki gelir — aç.",
      "Hero foto, başlık, alt başlık, hizmetler, referans bölümlerini doldur.",
      "Kaydet → public URL anında güncellenir.",
      "Public URL'yi (örn. estateai.upudev.nl/u/ahmet-yilmaz) müşterilerine paylaşabilirsin.",
    ],
    example: "Müşterin seninle yeni tanıştı, \"Kartını verir misin?\" diye sordu. Web sayfamı yolla — fotoğraf, ofis, son 5 mülk, referanslar tek tıkla. Ertesi gün senin adın aklında.",
    faq: [
      { q: "Slug'ı nasıl değiştiririm?", a: "Şu an slug otomatik (display_name'den). Manuel değişim için destek." },
      { q: "Hangi mülkler gösterilir?", a: "Status='aktif' olan tüm mülkler otomatik. Gizlemek için mülk kartında \"gizle\" yapılabilir (yol haritasında)." },
    ],
  },
  {
    command: "profilduzenle",
    title: "🪪 Profilim",
    summary: "Adın, ofis adın, foto, iletişim bilgilerin — web sayfanı besler.",
    panelSection: "🪪 Profil",
    startAction: { type: "web", path: "/tr/profil-duzenle" },
    marketing:
      "Firma kimliğinizi ve tercihlerinizi tek noktada yönetin. Profil fotoğrafı, ofis bilgileri, sektör tecrübesi, kısa bio — sunumlarınızdaki bilgiler, müşteriye gönderilen web sayfanız, sözleşme şablonu hepsi buradan beslenir. " +
      "Bir kez güncelleyin, her dokunduğunuz yerde tutarlı görünüm — markalaşma efektif, hatasız, otomatik. " +
      "*Sorunu çözer*: Her sunumda bilgilerinizi tekrar yazmanız gerekmez. *Kazandırır*: Tutarlı profesyonel kimlik + web sayfası.",
    waCommand: "profilduzenle",
    what: "Web sayfanızı ve sunumlardaki bilgilerinizi besleyen profil verileriniz. Foto, ofis adı, lokasyon, deneyim yılı buradan güncellenir.",
    how: [
      "Menüden *Profilim* > Başlat butonuna tıkla.",
      "Web form açılır.",
      "Profil fotoğrafı yükle, ofis adı, telefon, lokasyon, deneyim yılı, kısa bio gir.",
      "Kaydet → web sayfanız (`upudev.nl/u/<sayfa-adı>`) güncellenir.",
    ],
    example: "Müşteriye sunum gönderdin; sunum altında \"Hakkında\" bölümünde profil bilgilerin görünüyor. Foto eksikti — *Profilim* → Başlat → foto yükle → kaydet. Sunum yenilenmesi gerekmez, otomatik yansır.",
    faq: [
      { q: "Web sayfası adımı değiştirebilir miyim?", a: "Şu an web sayfası adı otomatik (display_name'den). Manuel değişim için destek." },
      { q: "Web sayfamda farklı şeyler göstermek istiyorum", a: "*websayfam* komutuyla web sayfanızı ayrı düzenleyebilirsin — referanslar, mülkler, hakkında bölümü." },
    ],
  },
];

export function getYardimEntry(command: string): YardimEntry | null {
  return YARDIM_ENTRIES.find((e) => e.command === command) || null;
}
