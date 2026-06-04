# Notification Templates — submission & status

UPU platformunda WhatsApp 24h pencere DIŞINDA proaktif bildirim atmak için
Meta-onaylı template'ler kullanılır. Bu klasördeki Python script'leri Meta
Business API ile submission/status sync yapar.

## Onaylı templatelar (runtime)

Allowlist: `src/platform/whatsapp/templates.ts → APPROVED_NOTIFICATION_TEMPLATES`

| Template | Kullanım | Durum |
|---|---|---|
| `upu_otp_giris` | 6 haneli giriş kodu | ✅ Onaylı |
| `upu_panel_erisim` | Magic-link panel girişi | ✅ Onaylı |
| `upu_yeni_kayit` | Yeni kayıt geldi bildirimi | 🟡 PENDING |
| `upu_bekleyen_islem` | İlgilenilmesi gereken iş var (vade vb.) | 🟡 PENDING |
| `upu_durum_guncelleme` | Kayıt durumu değişti | 🟡 PENDING |
| `upu_gunluk_ozet` | Günlük panel özeti | 🟡 PENDING |

## Script'ler

### `submit_notification_templates.py`
4 generic UTILITY template'i (TR/EN/NL = 12 lokalize) Meta'ya gönderir.
Çıktı: `scripts/notification_templates_submission.json` (template_id'ler).

```bash
cd <repo>
python scripts/submit_notification_templates.py
```

### `check_template_status.py`
Submission JSON'undaki ID'lerin **güncel** durumunu Meta Graph API'sinden
çeker (PENDING → APPROVED/REJECTED geçişlerini görmek için).

```bash
cd <repo>
python scripts/check_template_status.py
```

Çıktı: `scripts/notification_templates_status.json` + stdout tablo.
Onaylananları **elle** `templates.ts:APPROVED_NOTIFICATION_TEMPLATES` set'ine ekleyin (defense-in-depth — runtime allowlist).

### Diğer (panel/giris template'leri arşiv)

| Script | Amaç |
|---|---|
| `submit_panel_link_autocat.py` | upu_panel_erisim AUTO_CATEGORY denemesi |
| `submit_panel_link_marketing.py` | MARKETING category attempt (Meta UTILITY'ye reclassify etti) |
| `submit_wa_templates.py` | upu_otp_giris + upu_panel_erisim initial submit |
| `retry_wa_templates.py`, `retry2_wa_templates.py` | rejected → text revize → re-submit |

JSON artefaktları (`wa_*_final.json`, `wa_templates_*.json`) Meta'dan gelen ID/status
snapshot'ları — history için commit edilmiştir, runtime'da okunmaz.

## Operasyonel akış

1. Yeni template tasarla → `submit_notification_templates.py` benzeri script
2. Meta dashboard'da approval'ı bekle (~24h)
3. `check_template_status.py` ile durumu doğrula
4. APPROVED ise → `templates.ts:APPROVED_NOTIFICATION_TEMPLATES`'e adı ekle
5. `NOTIFICATION_TYPE_TEMPLATES` mapping zaten varsa otomatik aktif olur
6. `send-notification.ts` window kapalı kullanıcılar için template path'ini kullanır
