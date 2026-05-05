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
}

export const YARDIM_ENTRIES: YardimEntry[] = [
  {
    command: "mulkekle",
    title: "🏠 Mülk Ekle",
    summary: "Portföyüne yeni bir mülk ekle — form veya hızlı giriş.",
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
    command: "mulklerim",
    title: "📁 Mülklerim",
    summary: "Tüm portföyün — düzenle, sil, sunum gönder.",
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
    command: "profilduzenle",
    title: "🪪 Profilim",
    summary: "Adın, ofis adın, foto, contact info — public landing'i besler.",
    waCommand: "profilduzenle",
    what: "Public landing sayfanı (web sayfam) ve sunum imzalarını besleyen profil bilgilerin. Foto, ofis adı, lokasyon, deneyim yılı buradan güncellenir.",
    how: [
      "*profilduzenle* yaz veya menüden Profilim'i seç.",
      "Web form linki gelir.",
      "Profil fotoğrafı yükle, ofis adı, telefon, lokasyon, deneyim yılı, kısa bio gir.",
      "Kaydet → public landing (`upudev.nl/u/<slug>`) güncellenir.",
    ],
    example: "Müşteriye sunum gönderdin; sunum altında \"Hakkında\" bölümünde profil bilgilerin görünüyor. Foto eksikti — *profilduzenle* → foto yükle → kaydet. Sunum yenilenmesi gerekmez, otomatik yansır.",
    faq: [
      { q: "Slug'ımı değiştirebilir miyim?", a: "Şu an slug otomatik (display_name'den). Manuel değişim için destek." },
      { q: "Web sayfam'da farklı şeyler göstermek istiyorum", a: "*websayfam* komutuyla landing'i ayrı düzenleyebilirsin — referanslar, mülkler, hakkında bölümü." },
    ],
  },
];

export function getYardimEntry(command: string): YardimEntry | null {
  return YARDIM_ENTRIES.find((e) => e.command === command) || null;
}
