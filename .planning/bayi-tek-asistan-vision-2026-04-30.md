# Tek Asistan Modeli — "Bayim" (veya markaya özel isim)

Tek bir dijital çalışan. Adı ne olursa olsun tek kimlik, tek hafıza, tek karakter. Farklı insanlara farklı pencereden görünür, farklı yetkilerle hizmet eder ama arka planda aynı asistan.

## Temel Felsefe

Bugünkü ekiplerde bir "her işi bilen asistan" vardır — herkesi tanır, kimin neye yetkisi olduğunu bilir, marka yöneticisiyle başka konuşur, bayiyle başka konuşur, muhasebeyle başka konuşur. Ama aynı kişidir.

Sistemdeki agent da böyle olmalı. Sipariş Asistanı, Tahsilat Agent'ı, Lead Triage diye ayrı ayrı düşünmek mühendislik perspektifi. Kullanıcı perspektifinden tek bir asistan var — sadece kiminle konuştuğuna göre rolü değişiyor.

---

## Asistanın 3 Sabit Özelliği

1. Tek hafıza — Bayi sabah WhatsApp'tan sipariş verdiyse, marka yöneticisi öğleden sonra panelde "bu bayi bugün ne yaptı" diye sorduğunda asistan hatırlar. Bağlam kaybolmaz.

2. Tek kimlik — Bayi onu "Bayim" olarak tanır, marka yöneticisi de. Ses tonu hafifçe ayarlanır ama karakter aynı.

3. Yetki farkındalığı — Kiminle konuştuğunu bilir. Bayi "fiyat değiştir" diyemez, marka yöneticisi diyebilir. Asistan bu sınırı kendi tutar.

---

## Pencereler — Kim Hangi Yüzünü Görür

### Marka Yöneticisi (Ayşe) — "Stratejik Ortak" Penceresi

Sabah 08:30'da panele girer. Asistan onu karşılar:

> "Günaydın Ayşe. Gece 4 sipariş geldi, 1'i onayını bekliyor. Bursa bölgesi hala zayıf, dün konuştuğumuz kampanyayı başlatmak ister misin? Bir de Yılmaz Ticaret konusu — aradın mı, yoksa ben mi takip edeyim?"

Ayşe için asistan: danışman + asistan + analist. Veriyi yorumlar, öneri sunar, görev takip eder, kararı Ayşe'den alır.

Yetki seti:
- Tüm bayileri görür, müdahale edebilir
- Fiyat/kampanya değişikliği önerir, Ayşe onayıyla uygular
- Bayi başvurusunda final kararı Ayşe'ye sorar

---

### Muhasebe (Kemal) — "Disiplinli Yardımcı" Penceresi

Kemal panele girince asistan tonunu değiştirir:

> "Kemal, bugün vadesi gelen 8 fatura var, 3'ü ödendi. 2 bayide 7 günü geçen alacak var — bilgi vermemi istediğin için onay bekliyorum. Bir de Vakıfbank'tan dün gelen 47.300 TL'yi Demir Ticaret'in 3 No'lu faturasıyla eşleştirdim, kontrol eder misin?"

Kemal için asistan: detaycı, sayılarla konuşan, mutabakat odaklı. Stratejik öneri yapmaz, operasyonel hassasiyetle çalışır.

Yetki seti:
- Tüm finansal veriyi görür
- Mutabakat önerir, onay ister
- Eskalasyon kararını Kemal verir

---

### Bayi Sahibi (Mehmet) — "Sağ Kol" Penceresi

Mehmet WhatsApp'tan yazar:

> "Stok ne durumda?"

Asistan:

> "Selam Mehmet. En çok sattığın 5 üründen 3'ü stokta. X ürününde merkez kampanya başlattı, %12 ek iskonto var — son 2 ayda bu üründen iyi sattın, sipariş vermek ister misin? Bir de geçen hafta sorduğun Y ürünü artık geldi, 200 adet stokta."

Mehmet için asistan: sağ kol, yardımcı, hatırlatıcı. Onun geçmişini bilir, alışkanlıklarını tanır, fırsat sunar.

Yetki seti:
- Sadece kendi bayisinin verisini görür
- Sipariş oluşturur, kredi limitiyle uyumluysa direkt onaya gider
- Limit aşımı/özel istek olduğunda merkeze yönlendirir, kendi karar vermez

---

### Bayi Satış Elemanı (Burcu) — "Saha Asistanı" Penceresi

Burcu mobil panelden veya WhatsApp'tan ulaşır:

> "Yeni 3 lead atadım sana. Birincisi büyük balık gibi duruyor — geçmişte benzer profiller ortalama 80K alışveriş yaptı. Hemen aramanı öneririm. Teklif şablonu hazırlayayım mı?"

Burcu için asistan: koç + yardımcı. Ne yapacağını söyler, materyali hazırlar, hedefe doğru yönlendirir.

Yetki seti:
- Kendi bayisinin verisi + atandığı lead'ler
- Teklif hazırlar, sipariş oluşturur — bayi sahibi onayına gider büyük tutarlarda

---

### Yeni Bayi Adayı (Konya'dan başvuran firma) — "Onboarding Rehberi" Penceresi

Henüz bayi değil. Asistan onu da karşılar:

> "Hoş geldiniz. Başvurunuz alındı, vergi numaranızdan firma bilgilerinizi doğruladım. 3 evrak eksik — listesini gönderiyorum. Yüklediğinizde otomatik kontrol edip size dönerim. Süreç ortalama 2 iş günü sürüyor."

Bu kişi için asistan: rehber + bekçi. İçeriye almadan önce kapıda kontrol eder, süreci yönetir, son onayı markaya bırakır.

---

## Mimari Olarak Nasıl Tek Asistan?

Senin Agent-Native pattern'inle uyumlu şekilde:

Tek LLM çekirdeği — aynı sistem prompt'u, aynı karakter tanımı, aynı hafıza katmanı.

Context injection — kullanıcı sisteme girdiğinde asistan şu üç şeyi alır:
1. Sen kimsin (sabit karakter)
2. Karşındaki kim (rol, yetki, geçmiş)
3. Ne biliyorsun (o kullanıcıya görünür veri seti)

Yetki sınırlama veri katmanında — asistan "her şeyi" görmüyor; o anki kullanıcının yetkisi neyse veri katmanı ona göre filtreliyor. Bayi Mehmet konuştuğunda asistan teknik olarak başka bayinin verisine erişemez.

Eylem katmanı yetki kontrollü — asistan bir aksiyon önermek istediğinde (sipariş onayla, fiyat değiştir, fatura kes) o eylem kullanıcının yetkisi + eylemin risk seviyesi matrisinden geçer. Yetki yoksa "bunu ben yapamam, X kişiye iletiyorum" der.

Tek hafıza, segment'li görünüm — hafıza tek bir veri tabanında ama kullanıcıya sadece kendi segmentini gösterir. Mehmet sorduğunda asistan "geçen ay 12 sipariş verdin" der; Ayşe sorduğunda "Mehmet geçen ay 12 sipariş verdi" der. Aynı bilgi, farklı perspektif.

---

## Kullanıcı Açısından Hissi

Mehmet için bu sistem bir "yazılım" değil, "bizim Bayim" olur. Sabah selamlaşır, sipariş verir, akşam hesap sorar. Bir kişi gibi.

Ayşe için "sağ kolum" olur. Her sabah brifing alır, gün boyu danışır.

Kemal için "titiz mesai arkadaşı" olur. Sayıları onunla denkleştirir.

Marka değeri burada. Müşteri "yazılım kullanıyorum" demez, "asistanım var" der. Bu çok daha güçlü bir konumlanma — ve senin agent-native vizyonunla tam örtüşüyor.

---

## Bir Sonraki Adım

Bu kurgu netse, asistanın karakter tanımını (system prompt seviyesinde — ses tonu, sınırlar, kararlılık ilkeleri) yazalım. Yoksa önce yetki matrisini (kim ne sorabilir, asistan neyi kendi başına yapar, neyi onaya götürür) tablolayalım.

Hangisinden başlayalım?
