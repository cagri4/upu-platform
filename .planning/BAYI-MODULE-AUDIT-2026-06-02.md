# Bayi SaaS — Dağıtıcı Gözünden Modül Audit

**Tarih:** 2026-06-02
**Kapsam:** 10 modül × ~5-7 alt-özellik = 58 alt-özellik
**Metod:** Kod taraması (migration + API route + UI sayfa), pazarlama dili yok, gerçek kod durumu.

## Özet

| Statü | Sayı |
|-------|------|
| 🟢 VAR (tam) | 19 |
| 🟡 KISMİ | 22 |
| 🔴 YOK | 17 |
| **Toplam** | **58** |

**Toplam backlog tahmini:** ~80-100 insan-günü. **Sahaya çıkma MVP** (kritik 5 boşluk dahil Sprint 1+2) için ~3 hafta.

## Modül-Modül Detay

### 1. BAYİ & ORGANİZASYON YÖNETİMİ

| # | Özellik | Durum | Kanıt | Eksik | Efor |
|---|---------|-------|-------|-------|------|
| 1.1 | Bayi kaydı/onayı | 🟡 | `migrations/20260519060000_dealer_invitations.sql` (pending/accepted/expired); WA davet akışı | Panel onay-UI flow yok, prod tabloları planning'de | 1g |
| 1.2 | Bayi hiyerarşisi (ana/alt/şube) | 🔴 | `parent_dealer_id` yok | parent FK + recursive query helper | 2g |
| 1.3 | Bölge/territory ataması | 🔴 | `dealers.region` kolonu yok | region + sales_rep tablo + atama UI | 1-2g |
| 1.4 | Segmentasyon (A/B/C) | 🟡 | `risk_status` (clean/watch/risk) var; A/B/C sınıfı YOK | segment kolonu + manuel/otomatik atama | 1g |
| 1.5 | RBAC | 🟡 | `profiles.capabilities[]`; `bayi-kullanicilar/update-role` endpoint | Sıkı `requireCapability()` util yok, hardcoded `ADMIN_ROLES.has()` | 1g |
| 1.6 | Multi-tenant izolasyon (RLS) | 🟢 | RLS aktif 97 tablo (commit 8d13558+e7c6918), tenant_id NOT NULL guard | — | — |
| 1.7 | Bayi profili (vergi no/adres/sözleşme) | 🟡 | vergi_no, vergi_dairesi, IBAN, adres var | sözleşme_tarihi yok, PDF storage yok | 4-6 sa |

### 2. ÜRÜN & KATALOG

| # | Özellik | Durum | Kanıt | Eksik | Efor |
|---|---------|-------|-------|-------|------|
| 2.1 | Ürün/varyant/kategori | 🟡 | `bayi-urun-ekle/save`, `bayi_categories` | `bayi_product_variants` (size/color) yok | 1g |
| 2.2 | Bayiye özel ürün görünürlüğü | 🔴 | `dealer_product_visibility` yok | `dealer_product_grants` tablo + filter | 2g |
| 2.3 | Görseller/döküman/barkod | 🟡 | image_url, images[], metadata.ean | document_url (datasheet) yok | 1g |
| 2.4 | Stok durumu (var/yok/kısıt) | 🟢 | `bayi-urunlerim/page.tsx:33` stockStatus enum; `bayi_stock_movements` | — | — |
| 2.5 | Min sipariş/koli/paket | 🟡 | `min_order` kolon var | `package_size`, `unit_per_package`, validasyon yok | 1g |

### 3. FİYAT & İSKONTO MOTORU

| # | Özellik | Durum | Kanıt | Eksik | Efor |
|---|---------|-------|-------|-------|------|
| 3.1 | Bayi grubu fiyat listesi | 🔴 | `price_list` migration yok | `bayi_price_lists` + grup mapping | 2g |
| 3.2 | Kademeli iskonto (adet/ciro) | 🔴 | `ORDERS_DISCOUNT` capability var, motor YOK | `bayi_discount_tiers` (qty_min, rate) + hesap fn | 2g |
| 3.3 | Sözleşmeye özel fiyat | 🔴 | `contracts` tablo var, `contract_prices` yok | `bayi_contract_prices` tablo + FK | 1g |
| 3.4 | Kampanya promosyon fiyatı (tarih) | 🟡 | `bayi-kampanya/save` (start/end_date, discount); WA broadcast | Sipariş satırında otomatik discount apply yok | 2g |
| 3.5 | Para birimi & KDV | 🟡 | VALID_VAT_RATES (0/1/9/10/20/21); `bayi_invoices.currency` (EUR/TRY/USD/GBP) | Hardcoded FX, `currency_rates` tablo yok | 2g |
| 3.6 | Fiyat listesi PDF export | 🟡 | `bayi-export/*` Excel var | Price list PDF generation yok | 1g |

### 4. SİPARİŞ YÖNETİMİ

| # | Özellik | Durum | Kanıt | Eksik | Efor |
|---|---------|-------|-------|-------|------|
| 4.1 | Hızlı sipariş (sepet) | 🟢 | `bayi_dealer_orders`, `bayi_dealer_order_items`; `/api/bayi-dealer-orders/create`; `/tr/bayi-siparis-ver` | — | — |
| 4.2 | Tekrar sipariş | 🟢 | `handleDealerTekrarSiparis()` `bayi-siparislerim` | — | — |
| 4.3 | Sipariş onay (HITL) | 🟢 | status enum (pending→confirmed→preparing→shipped→delivered/cancelled/rejected); confirm/reject endpoint; status_history audit | — | — |
| 4.4 | Durum takibi timeline | 🟡 | `[id]/update-status` route var; eski WA `/kargotakip` | Yeni `bayi_dealer_orders` için UI timeline yok | 4-6 sa |
| 4.5 | **Kredi limiti kontrolü** | 🔴 | `credit_limit` NUMERIC var, sipariş create'te VALIDATION YOK | Backend hook (balance+total>limit → reject) + UI uyarı | 8-12 sa |
| 4.6 | İade & iptal | 🟡 | `[id]/cancel` var (pending only) | `bayi_order_returns` tablo + reason + refund workflow | 2-3g |
| 4.7 | Sipariş geçmişi & filtre | 🟢 | `bayi-dealer-orders/list` (status, scope, date) | — | — |

### 5. CARİ & FİNANS

| # | Özellik | Durum | Kanıt | Eksik | Efor |
|---|---------|-------|-------|-------|------|
| 5.1 | Bayi bakiyesi | 🟡 | `bayi_account_statement` VIEW (orders+invoices+payments UNION) | Her API call'da recalc, real-time sync yok, n+1 risk | 12-16 sa |
| 5.2 | Cari ekstre + export | 🟢 | `bayi-cari/statement` + `bayi-export/cari` Excel; `/tr/bayi-cari` filtre UI | — | — |
| 5.3 | Vade takibi & geciken uyarı | 🟡 | `bayi_invoices.due_date` + view-time overdue; WA `/vadeler` | Cron-based reminder yok | 10-14 sa |
| 5.4 | Ödeme kaydı / dekont | 🟢 | `bayi_payments`; `bayi-payments/create` + `[id]/approve|reject`; admin notify | — | — |
| 5.5 | Kredi limiti tanımlama | 🟡 | `credit_limit` kolon var, demo seed dolduruluyor | Admin UI yok (manuel SQL); edit endpoint yok | 6-8 sa |
| 5.6 | Fatura/e-fatura | 🟡 | `bayi_invoices`; list+create route | PDF generator backend yok; e-fatura entegrasyon (efatura/efinans/uyumsoft) HİÇ YOK | 20-24 sa |

### 6. STOK & SEVKİYAT

| # | Özellik | Durum | Kanıt | Eksik | Efor |
|---|---------|-------|-------|-------|------|
| 6.1 | Anlık stok | 🟢 | `bayi_products.stock_quantity`; `bayi-stok/list`; `/tr/bayi-stok` | — | — |
| 6.2 | Stok rezervasyonu | 🔴 | `bayi_stock_movements` var, sipariş create'te atomik decrement YOK | `bayi_stock_reservations` tablo + order create hook (race condition koruması) | 12-16 sa |
| 6.3 | Kargo takip & no | 🔴 | tracking_number kolon hiç yok | tracking_number + kargo API SDK (PostNL/DHL/Aras/Yurtiçi) + shipment tablo | 18-24 sa |
| 6.4 | Kısmi sevkiyat | 🔴 | order_items var, shipment-per-item yok | `bayi_shipments` + `bayi_shipment_items` tablo, partial_quantity track | 14-18 sa |
| 6.5 | Çok depo | 🔴 | tek depo varsayım; warehouse_id yok | `bayi_warehouses` + junction + allocation logic | 20-24 sa |

### 7. İLETİŞİM & BİLDİRİM

| # | Özellik | Durum | Kanıt | Eksik | Efor |
|---|---------|-------|-------|-------|------|
| 7.1 | WhatsApp (sipariş/sevk/hatırlatma) | 🟢 | `whatsapp/send.ts`; `bayi-campaigns/rule-engine.ts:165` wa_message; broadcast | Otomatik sevkiyat WA cron'u eksik | 2-3 sa |
| 7.2 | Telegram | 🔴 | Repoda ref yok | Provider + komut yapısı | 1g |
| 7.3 | E-posta/SMS | 🟡 | `site-channels.ts` SMS mock; davet sayfasında SMS paylaş UI | Gerçek SMS (Twilio/SNS); gerçek email (Resend/Sendgrid) | 2-3g |
| 7.4 | Duyuru/broadcast | 🟢 | `bayi-kampanya/save` loop; `bayi-ayarlar/wa-broadcast` admin | Rate-limiting/queue opt. | 1-2 sa |
| 7.5 | Sipariş onay magic link | 🟢 | `commands/siparis.ts` magic_link_tokens; `commands/dealer.ts` accept | TTL fine-tune | 2-3 sa |

### 8. RAPORLAMA & ANALİTİK

| # | Özellik | Durum | Kanıt | Eksik | Efor |
|---|---------|-------|-------|-------|------|
| 8.1 | Bayi performans skor | 🟢 | `bayi-scoring/calculate.ts` (volume/regularity/collection/trend); endpoint + cron haftalık | UI dashboard placeholder | 3-4g (grafik) |
| 8.2 | En çok satan / trend | 🟡 | Market'ta RPC var; bayi `insight.ts:44` trend | Bayi-scope'lu top-products endpoint (port) | 1-2 sa |
| 8.3 | Ödeme disiplini | 🟢 | `sub_collection` (vade uyumu + overdue ceza); `max_overdue_days` | UI ayrı sekme yok | 2-3 sa |
| 8.4 | Bölge/temsilci satış | 🔴 | dealers.region yok; geography pivot yok | region/sales_rep assignment tablo + report | 1g |
| 8.5 | Hedef vs gerçekleşen | 🟢 | `bayi_sales_targets` tablo; commands/kampanya.ts join; agents/bayi-upu.ts target/actual | UI dashboard sekmesi (WA komut var) | 3-4 sa |

### 9. KAMPANYA & HEDEF

| # | Özellik | Durum | Kanıt | Eksik | Efor |
|---|---------|-------|-------|-------|------|
| 9.1 | Kampanya tanımlama (X al Y öde) | 🟡 | `bayi-kampanya/save` (discount); rule-engine event-driven | "Buy X Get Y" engine yok; hediye akışı yok | 2-3g |
| 9.2 | Bayi hedefi & prim | 🟡 | `bayi_sales_targets` tablo + sorgular | Bonus formula + payment endpoint + prim dashboard | 2-3g |
| 9.3 | Kampanya katılım raporu | 🟡 | `bayi_campaign_executions` log | Aggregate rapor view/endpoint yok | 1-2 sa |

### 10. YÖNETİM & SİSTEM

| # | Özellik | Durum | Kanıt | Eksik | Efor |
|---|---------|-------|-------|-------|------|
| 10.1 | Admin paneli | 🟢 | `(admin)/admin/page.tsx`; `/api/admin/*` | Bayi-spesifik admin tools (target/rule/payment approve) sekmesi | 2-3g |
| 10.2 | Audit log | 🟡 | `audit_log` feature flag var; AUDIT_VIEW capability | Gerçek `audit_logs` tablo + middleware/hook yok | 2-3g |
| 10.3 | Doküman merkezi | 🔴 | Hiç tablo/route yok | S3 upload + sharing + versioning | 3-4g |
| 10.4 | Destek/ticket | 🟢 | `migrations/20260511100000_support_tickets.sql` (7 tablo + RLS); admin/tickets/page.tsx | Bayi-portal ticket sayfası yok; auto-routing yok | 2-3 sa |
| 10.5 | ERP entegrasyon | 🔴 | Logo/Netsis/Paraşüt ref yok | Webhook + sync + invoice/GL posting | 5+ g |
| 10.6 | E-fatura entegrasyon | 🔴 | efatura/efinans/uyumsoft ref yok | API + sertifika + UBL submission | 5+ g |
| 10.7 | Ödeme/sanal POS | 🟡 | `payments/site-pos.ts` MockSitePosProvider (DEMO); V2 Iyzico placeholder | Gerçek Iyzico/PayTR/Garanti; webhook | 3-4g |
| 10.8 | Çoklu dil | 🟢 | `i18n/routing.ts`; next-intl ^4.8.3; 37 bayipanel sayfa localized (TR/EN/NL) | Hardcoded TR string'ler olabilir (audit) | 2-3 sa |
| 10.9 | Çoklu para birimi | 🟢 | `i18n/currency.ts` (EUR/TRY/USD/GBP); bayi_invoices.currency | Real-time FX rates eksik | 2-3 sa |

## En Kritik 5 Boşluk (Sahaya Çıkmadan Önce KAPANMALI)

1. **Kredi limiti enforcement (#4.5)** — `credit_limit` data tutuluyor AMA sipariş validation YOK. Bayi limit aşan sipariş verebilir. Backend hook + UI uyarı şart. **8-12 saat.**

2. **Stok rezervasyonu race condition (#6.2)** — Sipariş create'te atomik decrement YOK. İki dealer aynı anda son ürünü alabilir. `bayi_stock_reservations` tablo + transaction. **12-16 saat.**

3. **Kargo takip no & API (#6.3)** — `tracking_number` kolonu hiç yok. Müşteri "kargom nerede" diye sorduğunda cevap yok. PostNL/Aras/Yurtiçi adapter zorunlu. **18-24 saat.**

4. **Bayiye özel ürün görünürlüğü (#2.2)** — Tüm bayiler tüm ürünleri görüyor. Çoğu distribütör SaaS'ta bayi-grup bazında SKU gizleme zorunlu. **2 gün.**

5. **Otomatik vade hatırlatma cron (#5.3)** — Vade tablosu var, geç ödeme tespiti VIEW'de var, AMA otomatik bildirim cron'u yok. Bu olmadan tahsilat manual. **10-14 saat.**

## Sprint Önerisi

### Sprint 1 (1 hafta — sahaya çıkma MVP)
- 4.5 Kredi limiti enforcement
- 6.2 Stok rezervasyonu (race condition fix)
- 5.3 Vade hatırlatma cron
- 2.2 Bayiye özel ürün görünürlüğü (minimal viable)
- 4.4 Durum takibi UI timeline

### Sprint 2 (1 hafta — operasyonel olgunluk)
- 6.3 Kargo takip no (en az 1 kargo SDK + manual fallback)
- 5.6 Fatura PDF generator (e-fatura öncesi)
- 5.5 Kredi limiti tanımlama admin UI
- 10.2 Audit log tablosu + middleware
- 10.4 Bayi-portal ticket sayfası

### Sprint 3 (1 hafta — fiyatlandırma motoru)
- 3.1 Bayi grubu fiyat listesi
- 3.2 Kademeli iskonto motoru
- 3.3 Sözleşmeye özel fiyat
- 3.4 Sipariş satırında otomatik discount apply
- 1.7 Bayi sözleşme yönetimi (PDF storage)

### Sprint 4 (1 hafta — analitik & raporlama)
- 8.1 Performans dashboard grafik UI
- 8.4 Bölge/temsilci raporu
- 1.3 Territory atama + UI
- 1.4 A/B/C segmentasyon UI
- 9.3 Kampanya katılım aggregate rapor

### Sprint 5+ (ileri faz — entegrasyon)
- 1.2 Hiyerarşi (multi-level dealers)
- 6.4 Kısmi sevkiyat
- 6.5 Multi-warehouse
- 10.3 Doküman merkezi
- 10.5 ERP entegrasyon (Logo/Paraşüt)
- 10.6 E-fatura (efatura/efinans)
- 10.7 Gerçek POS (Iyzico/PayTR)
- 7.3 SMS/email provider

## Toplam Backlog Tahmini

~80-100 insan-günü. Sahaya çıkmaya yetecek MVP için **Sprint 1+2 = 3 hafta**.

Diğer 6 SaaS'a (emlak/market/otel/restoran/siteyonetim/muhasebe) yayma stratejisi bayi pilot başarısına göre belirlenecek.
