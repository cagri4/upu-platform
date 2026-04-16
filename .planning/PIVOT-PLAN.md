# UPU Emlak — Pivot Plan (2026-04-16)

## Strateji

Gamification + 5 eleman + 34 görev modelini bırak. Odak:
**"Emlakçının tekrar eden süreçlerini AI ile otomatikleştir + sürekli Tips ile yol göster."**

- Tek asistan (UPU) — WA'da
- Sade komut seti (5-7 killer)
- Web panel (zaten kuruldu)
- Tips sistemi (günde 2-3 bağlamsal öneri, push değil pull)
- Sadece **emlak** — diğer 5 tenant feature flag ile kapalı

**Brand pitch hikayesi (arka planda):** 5 uzman AI ajan her agent için çalışır. Kullanıcı UX'inde görünmez, marketing'de hikaye olarak var.

---

## Silinecek (Phase 1)

### Gamification katmanı

**Tablolar (migration ile drop):**
- `platform_missions`
- `user_mission_progress`
- `user_quest_state`
- `user_employee_progress`
- `user_streaks` (opsiyonel — "last_active_date" için tutulabilir)

**Kod modülleri:**
- `src/platform/gamification/` (tüm klasör — engine, quest-state, progression, combos, triggers, employees)
- `src/tenants/emlak/gamification.ts` (seed + mission array)
- `src/app/api/cron/seed-missions/`
- `src/app/api/cron/daily-check/` (streak/mission bazlı)
- `src/app/api/cron/inactivity-check/` (mission bazlı)

**Web panel sayfaları:**
- `src/app/[locale]/(dashboard)/quest/` → SİL
- `src/app/[locale]/(dashboard)/agents/` → SİL veya "Tips ayarları"na dönüştür

**Router logic:**
- `SELF_TRIGGERING_COMMANDS` set'i (artık gereksiz, mission yok)
- `triggerMissionCheck` çağrıları (tüm command'larda)
- `nudgeToCorridor` + corridor lock in `showMenu`
- `handleWebpanelShared` içindeki mission check
- `MISSION_CTA` tablosu

**Onboarding flow:**
- Emlak onboarding-flow.ts içindeki `updateStreak`, `ensureActiveMission`, mission CTA mesajı

### Komut eleme

**Sil (kodu + menü + label):**
- `brifing` (pazartarama'ya kaynasın)
- `analiz` (zaten silinmişti — doğrula)
- `trend`
- `yayinla` (chrome extension yerine geçer)
- `degerle` (fiyatbelirle yeter)
- `favoriler` (gereksiz)
- `gorevler` (no gamification)
- `hediyeler`
- `ortakpazar` (ileride açılır)
- `websitem` (ileride)
- `portfoyum` (web panel)
- `mulkyonet` (web panel)
- `mulkduzenle` (web panel + mülkekle edit)
- `tara` (mulkekle link mode zaten var)
- `rapor` (web panel)
- `fotograf` komut olarak kalkar — fotoğraf doğrudan atılabilir (handler zaten pasif algılar)

**Kal (menüde görünür, killer):**
- `mulkekle` (polish)
- `fiyatbelirle` (polish, "degerle"yi de absorbe et)
- `pazartarama` (YENİ — sabah rapor, bodrum data kullanır)
- `musteriEkle` (polish)
- `musteriTakip` (polish, "satistavsiye"yi absorbe et — "bu müşteriye nasıl yaklaş" AI modu)
- `sunum` (polish — müşteri psikolojisi modu)
- `mulkoner` (polish — "eslestir"i absorbe et)

**Gizli ama çalışır (menüde yok, doğrudan yazarsan çalışır):**
- `hatirlatma`
- `sozlesme`
- `takipEt` (kriter bazlı sabah bildirim — zaten var)
- `paylas`
- `uzanti` (settings linki)

### 5 eleman UX (UPU tek asistana dönüş)

- Intro flow `src/platform/whatsapp/intro.ts` → **SİL** veya tamamen basitleştir:
  - "Merhaba, ben UPU asistanın. Sana yardım edeceğim" + "Başla" butonu
- `src/tenants/emlak/agents/*` AGENT DOSYALARI (portfoy, satis, medya, pazar, sekreter) — **KALSIN** (cron'la arka planda çalışır, agent_proposals üretir)
- Menüdeki "Bir sanal eleman seçin" listesi — **SİL** (direkt komut listesi göster)
- `emp:xxx` callback'leri — **SİL**
- Agent setup flow (`asetup:*`) — **SİLME**, ayarlara taşı (gelişmiş kullanıcı için)

### Diğer tenant'lar

- `src/tenants/config.ts` → her tenant'a `active: boolean` alanı ekle
- emlak `active: true`, diğer 5 tenant `active: false`
- Landing page'de `inactive` tenant'lar "Yakında" rozeti ile görünsün (ya da tamamen gizlensin)
- Signup/invite path inactive tenant için red
- WA gateway active değilse "henüz kullanıma açık değil" mesajı

---

## Eklenecek (Phase 2)

### Tips sistemi

**Tablo:**
```sql
CREATE TABLE user_tips (
  user_id uuid NOT NULL,
  tip_key text NOT NULL,
  shown_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  clicked_at timestamptz,
  PRIMARY KEY (user_id, tip_key, shown_at)
);

CREATE TABLE user_notification_prefs (
  user_id uuid PRIMARY KEY,
  tips_enabled boolean DEFAULT true,
  tips_frequency_per_day integer DEFAULT 2,
  quiet_hours_start integer DEFAULT 22,  -- 22:00
  quiet_hours_end integer DEFAULT 9       -- 09:00
);
```

**Kod:**
- `src/platform/tips/library.ts` — tip kataloğu (30+ tip)
- `src/platform/tips/picker.ts` — kullanıcı durumuna göre en uygun 1-2 tip seç
- `src/app/api/cron/tips/route.ts` — günde 3 kez (10:00, 14:00, 18:00) çalışır, her aktif kullanıcıya uygun tip yollar
- `src/app/[locale]/(dashboard)/settings/` — tips on/off + frequency ayarı

**Tip kategorileri (örnek):**

*Keşif (yeni kullanıcı):*
- "2 mülk eklediğin oldu. Müşteri ekleyerek otomatik eşleştirme yapabilirsin. Denemek ister misin?"
- "Sunum komutu ile bir müşterine özel görsel sunum hazırlayabilirsin — 5 dakikada, PDF + web link."

*Değer (orta kullanıcı):*
- "Bodrum'da son 3 günde 47 yeni ilan çıktı. Kriterine uygun 3 tane buldum — görmek ister misin?"
- "Ahmet müşterisiyle 14 gündür temas kurmadın. Sıcak tutmak için bir mesaj hazırlayayım mı?"
- "Villa Y için piyasa ortalamasına göre fiyatın %12 üstünde. İlan görüntülenmiyor olabilir. Revize edelim mi?"

*Öneri (aktif kullanıcı):*
- "Bu hafta 8 ilan ekledin — Chrome uzantısı ile bu süre 3 katına çıkar. Kurmak ister misin?"
- "Fiyatbelirle komutunu 3x kullandın — Pazar Analisti arka planda bölgeni izliyor, sabah raporunu aç?"

*Durum bazlı (trigger):*
- Sözleşme süresi 7 gün içinde bitenler
- 30+ gündür güncellenmemiş mülkler
- Fotoğrafı olmayan ilanlar
- Atanmamış müşteriler

**Spam önleme:**
- Aynı tip 14 gün içinde tekrar göstermez
- Quiet hours (22:00 – 09:00) gönderim yok
- Kullanıcı dismiss ederse o tip 30 gün gösterilmez
- Günlük limit (default 2, max 5, min 0)

### Pazartarama komutu (YENİ — killer feature #1)

Şu an brifing komutu `emlak_properties` + `emlak_customers` + `reminders` sayısı veriyor. Pazartarama daha zengin:

**Morning report içeriği:**
1. "Dün Bodrum'da 23 yeni ilan çıktı (sahibi: 5, emlakçı: 18)"
2. "Kriterlerinle eşleşen 3 tane var → liste + linkler"
3. "Senin mülklerinden 1 tanesi pazar ortalamasının %8 altında, revize edelim mi?"
4. "2 müşteri için yeni uygun ilanlar geldi: Ahmet (villa) → Villa X, Ayşe (3+1) → Daire Y"
5. "Bugün 2 hatırlatman var: saat 14:00 gezme, 16:30 telefon"

Komut veya cron: her sabah 09:00 otomatik WA'ya gönderilir (opt-in). Kullanıcı istediği an `pazartarama` yazarak da çağırabilir.

---

## Sıra (haftalık plan)

### Hafta 1: Temizlik (refactor + silme)

- [ ] DB migration: gamification tabloları drop (dikkatli — existing data)
- [ ] Gamification klasörünü sil
- [ ] Router'dan triggerMissionCheck/nudgeToCorridor çağrılarını temizle
- [ ] ShowMenu'den corridor lock'u sil
- [ ] Komutlardan mission check'leri sil
- [ ] Onboarding flow'u sadeleştir (completion message güncel)
- [ ] Intro flow'u tek asistana indirge
- [ ] Menü: "Ekibi Çağır" listesi kaldır, komutları direkt göster
- [ ] Web panel: /quest ve /agents sayfalarını sil (veya "Tips" ayarları yap)
- [ ] Komutları kes (brifing, trend, yayinla, degerle, favoriler, mulkyonet, mulkduzenle, tara, rapor, analiz, gorevler, hediyeler, ortakpazar, websitem, portfoyum)
- [ ] Sidebar/web panel menü güncellenmeli
- [ ] Tenant config: active flag + emlak hariç hepsini false
- [ ] Landing page: inactive tenant'lar "yakında"

### Hafta 2: Tips altyapısı + Pazartarama

- [ ] Migration: user_tips + user_notification_prefs tabloları
- [ ] Tips library (ilk 15 tip)
- [ ] Tips picker logic (context-aware)
- [ ] Cron: günde 3 kez tips gönder
- [ ] Settings sayfasında tips on/off
- [ ] Pazartarama komutu yaz (brifing'in yerine, zengin rapor)
- [ ] Cron: 09:00 otomatik pazartarama (opt-in)

### Hafta 3-4: Killer feature polish

- [ ] `sunum` komutu — müşteri psikolojisi modu + PDF + web link WOW
- [ ] `fiyatbelirle` komutu — "degerle"yi absorbe et, AI yorumunu güçlendir
- [ ] `mulkoner` komutu — "eslestir"i absorbe et
- [ ] `musteriTakip` komutu — "bu müşteriye nasıl yaklaş" AI modu ekle
- [ ] Observability: Sentry + system_errors tablosu

### Hafta 5-6: Pilot

- [ ] 1 Bodrum emlakçısı bul
- [ ] 2 saat yüz yüze: acı noktaları listele
- [ ] Platforma onboard et
- [ ] Haftalık 30 dk check-in
- [ ] 30. günde metric çek

### Hafta 7+: Vaka → deck → brand pitch

(Ayrı planda — önce ön kullanıcı sonuçlarını göreceğiz.)

---

## Riskler

1. **Veri kaybı**: gamification tablolarını drop etmek geri dönülemez. Mevcut test verilerini kaybedeceğiz (az).
2. **Refactor patlaması**: Çok sayıda dosyada mission check çağrısı var. Birini atlarsak run-time crash olur. Sistematik arama + test gerekir.
3. **Tips spam riski**: Yanlış sıklık → kullanıcı bloklar. Quiet hours + günlük limit kritik.
4. **Pazartarama doğru ton**: Çok uzun olursa okunmaz. 4-5 paragraf, kişisel, alakalı olmalı.

## Risk azaltma

- Her refactor adımı kendi commit'i — geri alınabilir
- Migration öncesi DB full backup
- Tips sistemi önce "preview mode" — gönderilen tip'i loglar, sana gösterir, sen onaylarsın 1 hafta
- Stage gate: her hafta sonunda kontrol + gidiş/dönüş kararı

---

## Başarı kriterleri (3 ay sonra)

- 1 pilot emlakçı 30 gün aktif (günde 3+ komut)
- Ortalama komut sayısı/kullanıcı/hafta: 30+
- Pazartarama açılma oranı: %60+
- Pilot "bu olmadan çalışamam" seviyesinde bağımlı
- Pilot satışlarına izlenebilir katkı
- Pitch deck vaka çalışmasıyla hazır
