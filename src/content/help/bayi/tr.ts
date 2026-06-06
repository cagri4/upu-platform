const TR_MARKDOWN = `# Bayi Yönetimi Kullanım Kılavuzu

## Panel Ne İşe Yarar?

Bayi paneli **distribütör işinin merkezi**. Bayilerinizi, ürünlerinizi, siparişlerinizi ve faturalarınızı tek ekrandan yönetir; rutin işleri WhatsApp asistanına devreder.

Asıl amaç: telefonla sipariş alıp Excel'e işlemekten kurtulmak. Bayiler kendi vitrininden sipariş veriyor, panel her şeyi takip ediyor.

## Bayilerimi Yönetmek

**Bayi davetiyesi** sidebar'dan "Bayilerim" üstündeki davet butonuyla üretilir. Link WhatsApp'tan bayinin telefonuna gider; bayi tek tıkla katılır.

- **Kredi limiti** her bayi kartından ayarlanır. Limit aşılırsa sipariş otomatik bloklanır.
- **Vade gün sayısı** (örn. 30/45/60) profil ekranında belirlenir.
- Bayiyi pasifleştirmek: kart > "Aktif" toggle.

## Ürünleri Eklemek ve Güncellemek

"Ürünlerim" sayfasından **tek tek ekle** veya **Excel toplu içeri al**. Her ürün için:

- Stok adedi, birim, KDV
- Bayi grubu bazında fiyat (opsiyonel)
- Görsel + açıklama

Stok 0'a düştüğünde panel kırmızı uyarı verir; vitrinde otomatik "Stokta yok" işaretlenir.

## Stok ve Görünürlük

Bazı ürünleri sadece belirli bayilere açabilirsiniz: ürün kartı > "Bayi Görünürlüğü" > seçili bayiler. Diğer bayiler o ürünü vitrinde görmez.

**Stok rezervasyonu**: bayi sepete ekleyince stok geçici olarak düşer (15 dk). Sipariş onaylanmazsa stok geri açılır. Aynı anda 2 bayi aynı ürünü çekemez.

## Siparişleri İşlemek

"Siparişlerim" akış sırası: **Yeni → Onaylandı → Kargoda → Teslim**.

- Yeni siparişe basınca: bayi, ürün listesi, tutar, kredi limit kalan görünür.
- "Onayla" → stok kalıcı düşer + WA bayiye bildirim gider.
- "Kargoya ver" → kargo takip no girilir, WA paylaşılır.
- "Teslim" → fatura otomatik üretilir.

## Faturalama ve Ödemeler

Sipariş "Teslim" olduğunda **fatura otomatik** çıkar. Manuel fatura: "Fatura Aç" butonu.

Bayi ödeme yapınca "Ödeme Kaydet" ile düş; vade tablosu güncellenir. Mollie entegrasyonu ile bayi kart/iDEAL ile online ödeyebilir — ödeme otomatik düşer, fatura kapanır.

## WhatsApp Bildirimleri

Her olay için bayi otomatik WA mesajı alır:

- Sipariş onayı / kargo / teslim
- Fatura kesimi
- Vade hatırlatması (D-3, D-1, D-0)
- Stok dolum bildirimi

"Bildirimler" sayfasından şablon seç, açık/kapalı tut. Tüm Meta UTILITY template'leri Felemenkçe/Türkçe/İngilizce hazır.

## Kredi Limiti ve Vade Takibi

Her bayi için **kredi limiti** + **vade gün sayısı** tanımlanır. Sipariş anında:

- Açık fatura toplamı + yeni sipariş < kredi limiti olmalı
- Aşarsa sipariş **otomatik bloklanır** + bayiye WA uyarısı

Vade hatırlatma cron'u **her gün 09:00 (TR)** çalışır; D-3/D-1/D-0 hatırlatması WA'dan otomatik gider.

## Raporlar

"Raporlar" sayfasında:

- Ciro (günlük/haftalık/aylık)
- En çok satan ürün
- En aktif bayi
- Tahsil edilemeyen ödemeler
- Stok dönüş hızı

Hepsi PDF olarak indirilebilir, e-postaya gönderilebilir.

## SSS

**Bayim parolasını unuttu?** Bayi telefonundan WA'ya "giriş" yazar; tek-kullanımlık link gelir.

**Yeni bayi hangi koşullarda sipariş veremez?** Kredi limit aşıldıysa, profil onaylanmadıysa veya pasifse.

**Fatura yanlış kesildi?** Fatura kartından "İptal" → yenisi üretilir. Mollie ödeme alınmışsa iade ayrıca işlenir.

**Mobilde de çalışıyor mu?** Evet, panel responsive. WhatsApp'tan da temel işlemler (sipariş onayı, ödeme kaydı) yapılabilir.

**Eksik veya hatalı bir konu mu var?** WA'dan "destek" yazın, ulaşırız.
`;

export default TR_MARKDOWN;
