# UPU Emlak — Tam Kullanıcı Akış Senaryosu

**Tarih:** 2026-04-17
**Model:** HubSpot setup + Duolingo retention hibrit
**Kanal:** WhatsApp Business API (butonlar, listeler, metin)

---

## FAZ 0 — İLK TEMAS (Dakika 0-2)

### Senaryo: Kullanıcı davet linkine tıkladı, WhatsApp'a "Davet kodum: XXXX" yazdı.

**Mesaj 0.1 — Anlık değer (bilgi sormadan ÖNCE):**
```
👋 Merhaba! Ben UPU, senin kişisel AI asistanın.

Sana hemen bir şey göstereyim — hangi bölgede çalışıyorsun?

[Bodrum] [Antalya] [İstanbul] [Başka]
```

> NOT: 3 buton + "Başka" = 4 seçenek. WhatsApp max 3 buton destekliyor.
> Çözüm: List message ile 8-10 şehir göster, ya da top 3 buton + "Başka" yazabilirsin formatı.
> Alternatif: Serbest metin — "Çalıştığın bölgeyi yaz" (daha esnek).

**Mesaj 0.2 — Değer teslimi (kullanıcı "Bodrum" seçti):**
```
📊 Bodrum'da son 24 saatte:

• 47 yeni ilan (sahibinden: 32, emlakçı: 15)
• En çok: Yalıkavak (12), Bitez (8), Gümbet (6)
• Ortalama fiyat: Villa 18.5M ₺, Daire 4.2M ₺

İşte bunu her sabah sana hazırlayacağım.

Tanışalım mı?

[🚀 Başlayalım]
```

> AMAÇ: Kullanıcı henüz adını bile söylemedi ama değer gördü.
> "Vay, bu bilgiyi her sabah alacam ha" hissi oluştu.

---

## FAZ 1 — KAYIT + TANIŞMA (Dakika 2-5)

### Senaryo: Kullanıcı "Başlayalım" butonuna tıkladı.

**Mesaj 1.1:**
```
🚀 Kurulum (1/5)

Adın ve soyadın?

💡 Örnek: Ahmet Yılmaz
```

**Mesaj 1.2:**
```
🚀 Kurulum (2/5)

Ofisin veya şirketin adı?

💡 Örnek: ABC Emlak
```

**Mesaj 1.3:**
```
🚀 Kurulum (3/5)

E-posta adresin?

💡 Örnek: ahmet@canemlak.com
```

**Mesaj 1.4:**
```
🚀 Kurulum (4/5)

Kaç yıldır emlakçılık yapıyorsun?

💡 Örnek: 5
```

**Mesaj 1.5:**
```
🚀 Kurulum (5/5)

Her sabah sana genel durum raporu göndereyim mi?

Raporda: eklediğin mülk sayısı, fotoğraf/açıklama gibi eksikler, 
müşteri sayın, piyasa tarama sonuçların, randevu ve hatırlatmalar.

[Evet, gönder] [Hayır, gerek yok]
```

> NOT: Bölge sorusu Faz 0'da zaten soruldu.
> Kurulum 5 adım, daha kısa. Her adım 1 bilgi.

---

## FAZ 2 — KURULUM TAMAMLANDI + DISCOVERY CHAIN (Dakika 5-15)

### Senaryo: Tüm kurulum soruları cevaplandı.

**Mesaj 2.1 — Kurulum kartı:**
```
✅ Kurulum tamamlandı!

🏢 Can Emlak
📍 Bodrum
📧 can@canemlak.com
📅 8 yıl tecrübe
📱 +90 506 680 6262

━━━━━━━━━━━━━━━━━━━

Hadi müşterine gönderebileceğin etkileyici bir sunum hazırlayalım!
Bunun için önce bir mülk ekleyelim.

[🏠 Mülk Ekle]
```

### Senaryo: Kullanıcı "Mülk Ekle" tıkladı → mülk ekleme akışı çalışır → mülk eklendi.

**Mesaj 2.2 — Mülk eklendi, sunum önerisi:**
```
🎉 İlk mülkün eklendi!

Şimdi bu mülk için müşterine gönderebileceğin 
etkileyici bir satış sunumu hazırlayalım.

Sunum hazır olduğunda sana özel bir link vereceğim — 
müşterine direkt gönder.

[🎯 Sunum Hazırla]
```

> DALLANMA: Kullanıcı sunum yerine menüye gidebilir. Sorun yok.
> Discovery chain bekler, sunum komutu tamamlandığında devam eder.

### Senaryo: Kullanıcı sunum hazırladı → magic link aldı.

**Mesaj 2.3 — Sunum hazır, tarama önerisi:**
```
✨ Sunumun hazır!

Magic linki müşterine gönderebilirsin.

Şimdi piyasa taraması kuralım — senin vereceğin kriterlere göre 
her sabah bölgendeki yeni ilanları sana raporlayacağım. 
Bir fırsat kaçırma!

[📡 Tarama Kur]
```

### Senaryo: Kullanıcı tarama kurdu.

**Mesaj 2.4 — Zincir tamamlandı:**
```
🚀 Harikasın!

İlk mülkünü ekledin, sunum hazırladın ve piyasa taramanı kurdun.

Artık her sabah sana yeni fırsatlar gelecek. 
İstediğin zaman "menü" yazarak tüm komutlara ulaşabilirsin.

💡 Yeni ipuçları için "ipucu" yaz.
```

---

## FAZ 3 — GÜNLÜK DÖNGÜ (Gün 2+)

### Senaryo: Ertesi sabah, saat 09:00.

**Mesaj 3.1 — Sabah raporu (otomatik, cron):**
```
☀️ Günaydın Çağrı!

📊 *Bodrum Piyasa Özeti*
• Dün 12 yeni ilan eklendi
• Kriterlerine uyan 3 ilan var

🏠 *Portföyün*
• 2 aktif mülk
• 1 mülkte fotoğraf eksik

🤝 *Müşterilerin*
• 1 aktif müşteri
• Ali Bey ile son temas: 3 gün önce

⏰ *Bugün*
• 14:00 — Gösterim hatırlatması (Villa Yalıkavak)

[İlanları Gör] [Müşteri Takip] [Menü]
```

> NOT: Bu mesaj kişiselleştirilmiş. Mülkü yoksa "mülk" kısmı yok.
> Müşterisi yoksa "müşteri" kısmı yok. Sadece OLAN şeyler gösterilir.
> Boş kullanıcıya: "Henüz mülk eklemedin. İlk mülkünü ekle!" ile başlar.

### Senaryo: Gün içi — sadece gerçek olay varsa.

**Mesaj 3.2 — Olay bazlı bildirim (tetiklenmiş, cron değil):**
```
🔔 Kriterine uyan yeni ilan!

Bitez'de 3+1 villa, 6.2M ₺, 180m²
Sahibinden ilanı, dün eklendi.

Müşterin Ali Bey'in bütçesine uygun.

[Detayı Gör] [Ali Bey'e Gönder]
```

> Bu mesaj yalnızca gerçek eşleşme olduğunda gönderilir.
> Yoksa sessizlik. Gürültü = kanal kaybı.

### Senaryo: Akşam — YALNIZCA kritik uyarı.

**Mesaj 3.3 — Streak saver (opsiyonel, akşam 20:00):**
```
💡 Bugün henüz giriş yapmadın.

Bu arada Bodrum'da 5 yeni ilan eklendi. 
Hızlıca bakmak ister misin?

[Göz At] [Yarın Bakarım]
```

> Bu mesaj yalnızca kullanıcı gün içinde HİÇ etkileşimde bulunmadıysa gönderilir.
> "Yarın Bakarım" seçerse sessizce not alınır, ısrar edilmez.

---

## FAZ 4 — DAVRANIS BAZLI ÖZELLİK AÇMA (Hafta 2+)

### Senaryo: Kullanıcı 5. kez fiyat analizi yaptı.

**Mesaj 4.1:**
```
💡 Fiyat analizini çok kullanıyorsun — güzel!

Bu bölgeyi otomatik takibe almamı ister misin? 
Fiyat değişikliği olduğunda direkt haber veririm.

[Takibe Al] [Şimdi Değil]
```

### Senaryo: Kullanıcı 3. müşterisini ekledi.

**Mesaj 4.2:**
```
💡 3 müşterin oldu — portföyün büyüyor!

Tüm müşterilerini ve mülk eşleşmelerini büyük ekranda 
görmek ister misin? Web panelini aç.

[🖥 Web Panel]
```

### Senaryo: Kullanıcı 10+ gündür aktif, hiç sözleşme yapmamış.

**Mesaj 4.3:**
```
💡 Henüz yetkilendirme sözleşmen yok.

İlan paylaşırken sahibi ile aranda yazılı anlaşma olması 
hem seni korur hem profesyonel görünür.

3 dakikada hazırlayalım?

[📄 Sözleşme Hazırla] [Şimdi Değil]
```

> Bu mesajlar TIPS'in yerini alıyor — ama rastgele değil, davranış tetiklemeli.
> Aynı mesaj 14 gün içinde tekrar gösterilmez.

---

## MENÜ (Her zaman erişilebilir)

### Senaryo: Kullanıcı "menü" yazdı.

**Menü mesajı (list message):**
```
🏠 UPU Emlak Asistan

"menü" yazarak buraya dönebilirsin.

[Komutlar] → açılır liste:
  🏠 Mülk ekle
  📊 Fiyat belirle
  🤝 Müşteri ekle
  🎯 Sunum hazırla
  🔗 Eşleştir
  ⏰ Hatırlatma kur
  💡 İpuçları
  🖥 Web panel
```

**Sistem komutları (ayrı mesaj):**
```
⚙️ Sistem

[👤 Profilim] [📖 Kılavuz] [ℹ️ Hakkımızda]
```

---

## KILAVUZ (İstek üzerine)

### Senaryo: Kullanıcı "kılavuz" yazdı.

```
📖 UPU Emlak — Kullanım Kılavuzu

Bu sistem WhatsApp üzerinden çalışan AI destekli bir asistandir.

Nasıl Kullanılır:

1️⃣ "menü" yaz → komut listesini gör
2️⃣ Bir komut seç → adım adım yönlendirilirsin
3️⃣ İşlem sırasında "iptal" yazarak vazgeçebilirsin
4️⃣ Her sabah sana piyasa özeti gelir (açtıysan)
5️⃣ "ipucu" yazarak tüm ipuçlarını görebilirsin

Sorular için: destek@upudev.nl

[Ana Menü]
```

---

## DALLANMA KURALLARI

| Durum | Ne olur |
|-------|---------|
| Kullanıcı discovery chain'de ama menüye gitti | Sorun yok. Chain bekler. İlgili komutu tamamlayınca devam eder. |
| Kullanıcı sabah raporunu "Hayır" dedi | Rapor gönderilmez. Tips de azaltılır (günde max 1). |
| Kullanıcı 3 gündür sessiz | Akşam 1 mesaj: "5 yeni ilan var, bakmak ister misin?" |
| Kullanıcı 7 gündür sessiz | 1 mesaj: "Geçen hafta kaçırdıkların: [özet]" |
| Kullanıcı 30 gündür sessiz | 1 mesaj: "Merhaba tekrar! Sistemin hâlâ aktif." |
| Kullanıcı "sessiz" veya "dur" yazdı | Tüm otomatik mesajlar durur. Sadece menü/komut çalışır. |
| Kullanıcı herhangi bir mesajda "iptal" yazdı | Aktif komut iptal, ana menüye döner. |

---

## BU DOKÜMANDA EKSİK OLANLAR (sonraki adım)

1. Her komutun kendi iç akışı (mulk-ekle, sunum, fiyatbelirle vb.) — bunlar zaten kodda var, değişmeyebilir
2. Web panel akışı (ayrı doküman)
3. Diğer tenant'lar (bayi, otel, muhasebe) — aynı framework, farklı içerik
4. Hata senaryoları (API hatası, WhatsApp hatası vb.)
5. Admin panel akışı
