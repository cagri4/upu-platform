# Karar — Faz 3 e-Fatura Sağlayıcısı

**Tarih:** 2026-06-10
**Karar veren:** Çağrı + worker önerisi
**Durum:** Foriba seçildi — Mikrohizmet/Edm/Veriban yedek

## Bağlam

Faz 3'te dağıtıcı sipariş onayladığında otomatik e-Fatura kesilecek; PDF
Supabase Storage'a yüklenip bayi panelindeki "PDF İndir" butonuna bağlanacak.
Bunun için TR e-Fatura entegratörü seçmemiz gerek.

## Aday sağlayıcılar

| Sağlayıcı | Pazar payı | Fiyatlama (~) | API kalitesi | Yorum |
|---|---|---|---|---|
| **Foriba** | Yaygın TR, kurumsal | 3-7 TL/fatura | REST + WSDL, doküman bol | İlk tercih |
| **Mikrohizmet** | Orta segment | Genellikle daha ucuz | REST, daha az doküman | Ucuzluk kazanırsa B planı |
| **Edm Bilişim** | Kurumsal | Foriba seviyesi | XML/SOAP ağırlıklı | Modern API zayıf |
| **Veriban** | Küçük-orta | Foriba'dan biraz ucuz | REST | İyi alternatif |

## Karar

**Foriba** birinci tercih:
1. Doküman + örnek bol → entegrasyon riski düşük
2. KOBİ'lerden kurumsala kadar müşteri tabanı geniş → Mehmet Bey gibi bir
   gıda toptancısı için "bilindik" sağlayıcı, satışta itiraza takılmaz
3. Sandbox ortamı var → Faz 3'te gerçek fatura çıkarmadan test edilir
4. REST API + XML SOAP destekli → modern adapter

Mikrohizmet B planı: dağıtıcının fiyat hassasiyeti yüksekse veya Foriba
sözleşmesi karmaşıksa.

## Mimari

`src/platform/efatura/` adapter dizini:
- `types.ts` — `InvoiceProvider` interface (issueInvoice, voidInvoice,
  retrieveInvoice). Tüm adapter'lar bu interface'i implement eder.
- `foriba.ts` — Foriba REST adapter (sandbox + live mode tenant settings'ten).
  Çağrı API key vermeden mock akış: provider yapılandırılmamış → fake
  invoice no + data URL PDF döner. Sandbox key gelirse foriba test
  ortamına gerçek istek atar.
- `mikrohizmet.ts` — B planı, şimdilik stub.

## Tetik akışı

1. Dağıtıcı sipariş onaylar → `transitionOrderStatus(toStatus: 'approved')`
2. Hook: `emitInvoiceForOrder(orderId)` → background olarak
3. Tenant'ın aktif efatura provider'ını bul (tenant_integration_settings)
4. Provider adapter `issueInvoice` çağır → externalRef + pdfUrl
5. `bayi_invoices` INSERT (status='open', external_ref, pdf_url, order_id
   referansı)
6. `bayi_orders.invoice_id` güncelle
7. Faz 4'te WA bildirim: "Faturanız hazır 🧾 → PDF" (event yine bu hook'tan
   tetiklenir)

İade akışı (Faz 3 sonrası): sipariş 'cancelled' → `voidInvoice(externalRef)`
çağrılır + iade faturası kesilir.

## Faz 3 sınırı

- Şimdilik **mock + foriba sandbox** desteklenir
- Canlı Foriba sözleşmesi + GİB Test ETTN ile production'a geçiş Faz 3
  sonunda, Çağrı'dan onay
- PDF dosyaları Supabase Storage `efatura-pdfs/<tenant_id>/<invoice_no>.pdf`
  altında saklanır (mock akışta data URL döner, gerçekte upload edilir)

## Memory not

- Tüm adapter çağrıları `recordSyncResult(provider='foriba', status=...)`
  ile log lansın → Entegrasyonlar sayfasında son sync timestamp/error görünür
- Aynı sipariş için çift fatura kesmemek: `bayi_orders.invoice_id` set ise
  hook erken çıksın
