# Bayi SaaS — Çok Kullanıcılı Sistem Planı

## Vizyon
Dağıtıcı firma, tüm bayi ağını ve kendi çalışanlarını tek bir WhatsApp botu + web panel üzerinden yönetir. Firma sahibi istediği kişiye istediği yetkiyi verir.

---

## 1. Kullanıcı Rolleri

### 1.1 Firma Sahibi (admin)
- Tüm komutlara erişim
- Çalışan ekleme/çıkarma + yetki belirleme
- Bayi davet linki oluşturma
- Tüm verileri görme (bayiler, siparişler, stok, tahsilat)
- Dashboard: tam görünüm

### 1.2 Firma Çalışanı (employee)
- Admin'in belirlediği komutlara erişim
- Örnek: Satış müdürü → kampanya, sipariş, bayi ziyaret, performans
- Örnek: Muhasebeci → bakiye, fatura, tahsilat, ödeme
- Örnek: Depocu → stok, teslimat, tedarik
- Kendi dashboard'u (yetkileri dahilinde)
- Admin'den talimat alabilir (sistem üzerinden)

### 1.3 Bayi (dealer)
- Kendi siparişleri, bakiyesi, faturaları
- Ürün kataloğu + fiyat listesi
- Kampanya bildirimleri alma + yanıt verme
- Destek talebi oluşturma
- Kendi dashboard'u

---

## 2. Veritabanı Değişiklikleri

### 2.1 profiles tablosu — yeni alanlar
```sql
ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'admin';
-- Değerler: 'admin', 'employee', 'dealer'

ALTER TABLE profiles ADD COLUMN dealer_id UUID REFERENCES bayi_dealers(id);
-- Sadece dealer rolü için — hangi bayiye bağlı

ALTER TABLE profiles ADD COLUMN permissions JSONB DEFAULT '{}';
-- Employee için yetki listesi: {"commands": ["kampanyaolustur", "siparisler", ...], "employees": ["satisMuduru"]}

ALTER TABLE profiles ADD COLUMN invited_by UUID REFERENCES profiles(id);
-- Kim davet etti
```

### 2.2 bayi_invite_links tablosu (yeni)
```sql
CREATE TABLE bayi_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  created_by UUID REFERENCES profiles(id),
  code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'dealer', -- 'dealer' veya 'employee'
  permissions JSONB DEFAULT '{}', -- employee için ön tanımlı yetkiler
  max_uses INTEGER, -- null = sınırsız
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. Kayıt Akışları

### 3.1 Bayi Davet Akışı
1. Firma sahibi WhatsApp'tan: "bayi davet linki oluştur" veya web panelden
2. Sistem tek kullanımlık veya çoklu kullanımlık link oluşturur
3. Link formatı: `https://wa.me/31644967207?text=BAYI:KODXYZ`
4. Bayi linke tıklar → WhatsApp açılır → mesaj gönderir
5. Sistem telefon numarasından yeni profil oluşturur (role=dealer)
6. Onboarding başlar:
   - Bayi adı (firma)
   - Yetkili kişi adı soyadı
   - Kuruluş yılı
   - Ürün grupları seçimi (liste)
   - E-posta
   - Vergi numarası
   - Şehir / İlçe
7. bayi_dealers + profiles kaydedilir, bağlantı kurulur
8. Bayi sistemi kullanmaya başlar

### 3.2 Çalışan Davet Akışı
1. Firma sahibi: "çalışan ekle" komutu veya web panelden
2. Yetki seçimi: hangi elemanları/komutları kullanabilecek
3. Davet kodu oluşturulur (tek kullanımlık)
4. Çalışan kayıt olur → role=employee, permissions belirlenir
5. Basit onboarding: ad, telefon, pozisyon
6. Çalışan menüsünde sadece yetkili komutlar görünür

---

## 4. WhatsApp Menü Yapısı (Role Bazlı)

### 4.1 Admin Menüsü (mevcut + eklemeler)
- Favoriler
- 8 Sanal Eleman (mevcut)
- Yeni: "Ekip Yönetimi" — çalışan ekle/çıkar, yetki ver
- Yeni: "Bayi Davet" — davet linki oluştur
- Sistem Menüsü

### 4.2 Employee Menüsü
- Favoriler
- Sadece yetkili elemanlar (admin'in belirlediği)
- Sistem Menüsü (profilim, webpanel)

### 4.3 Dealer Menüsü
- Favoriler (varsayılan: siparisver, bakiyem, urunler)
- Bayi Asistanı (tek eleman):
  - siparisver, siparislerim, tekrarsiparis
  - bakiyem, faturalarim, odemelerim
  - urunler, fiyatlar, kampanyalar
  - mesajgonder
- Sistem Menüsü (profilim, webpanel)

---

## 5. İnteraktif Bildirim Sistemi

### 5.1 Firma → Bayiler
- Kampanya oluşturulduğunda → tüm bayilere (veya seçili gruba) WhatsApp mesajı
  - Mesaj formatı: kampanya detayı + "Sipariş Ver" / "Detay" butonları
- Fiyat güncellemesi → bildirim
- Yeni ürün → bildirim
- Tahsilat hatırlatması → ilgili bayiye

### 5.2 Bayi → Firma
- Sipariş verildiğinde → firma admin + ilgili çalışana bildirim
- Ödeme yapıldığında → bildirim
- Destek talebi → bildirim

### 5.3 Admin → Çalışan (Talimat Sistemi)
- Admin: "Satış müdürüne talimat: yeni kampanya hazırla"
- Sistem çalışana WhatsApp mesajı gönderir
- Çalışan görevi tamamlayınca admin'e bildirim

---

## 6. Web Dashboard (Role Bazlı)

### 6.1 Admin Dashboard (mevcut + genişletme)
- Özet kartlar, bayi listesi, siparişler, stok, tahsilat, insight
- Yeni: Çalışan yönetimi sekmesi
- Yeni: Bayi davet yönetimi

### 6.2 Employee Dashboard
- Sadece yetkili verileri görür
- Kendine atanan görevler
- Kendi aktivite raporu

### 6.3 Dealer Dashboard
- Siparişlerim (liste + detay)
- Bakiyem + ödeme geçmişi
- Ürün kataloğu (arama + filtreleme)
- Faturalarım
- Aktif kampanyalar
- Profil bilgileri

---

## 7. Uygulama Fazları

### Faz 1 — Altyapı (öncelik)
- [ ] profiles tablosuna role, dealer_id, permissions, invited_by alanları ekle
- [ ] bayi_invite_links tablosu oluştur
- [ ] Router'da role bazlı menü gösterimi
- [ ] Çoklu kullanımlık davet kodu sistemi

### Faz 2 — Bayi Tarafı
- [ ] Bayi onboarding akışı (7 adım)
- [ ] Bayi komutları (siparisver, bakiyem, urunler vs.)
- [ ] Bayi menüsü (tek eleman: Bayi Asistanı)
- [ ] Bayi web dashboard

### Faz 3 — Çalışan Tarafı
- [ ] Çalışan ekleme komutu + yetki seçimi
- [ ] Router'da permission kontrolü
- [ ] Çalışan menüsü (yetkili elemanlar)
- [ ] Talimat sistemi (admin → çalışan)

### Faz 4 — İnteraktif Bildirimler
- [ ] Kampanya → bayilere bildirim + butonlu yanıt
- [ ] Sipariş → firmaya bildirim
- [ ] Tahsilat hatırlatma → bayiye bildirim
- [ ] Talimat → çalışana bildirim

### Faz 5 — Web Dashboard Genişletme
- [ ] Dealer dashboard (siparişler, bakiye, katalog)
- [ ] Employee dashboard (yetkili veriler)
- [ ] Admin: çalışan yönetimi + bayi davet yönetimi sayfaları

---

## 8. Teknik Notlar
- Tüm roller aynı WhatsApp numarasını kullanır — telefon + role ile ayrışır
- Magic link role'e göre doğru dashboard'a yönlendirir
- Bildirimler sendText/sendButtons ile — mevcut WhatsApp altyapısı yeterli
- Permission sistemi JSON bazlı — esnek, yeni komut eklenince kolayca güncellenebilir
