/**
 * B2B Portal WA bildirim olay tipleri — Faz 4.
 *
 * 14 tip (milestone bölüm 4):
 *   Dağıtıcı → Bayi (10): hoşgeldin, kampanya, sipariş alındı/onaylandı/
 *   reddedildi, kargo, vade yaklaştı, vade geçti, fatura, ödeme alındı
 *   Dağıtıcı kendine (4): yeni sipariş, onay bekleyen, kritik stok,
 *   geciken bayi raporu
 *
 * Her tip `notifications` tablosu + notification_preferences key'i olarak
 * kullanılır; shouldNotify default'unun açık olması için
 * src/platform/notifications/types.ts NOTIFICATION_TYPES kataloğuna da
 * free tier ile eklenmiştir (BAYI_B2B_NOTIFICATION_TYPES oradan spread).
 */

export type BayiEventType =
  // Dağıtıcı → Bayi (10)
  | "bayi_hosgeldin"
  | "bayi_yeni_kampanya"
  | "bayi_siparis_alindi"
  | "bayi_siparis_onaylandi"
  | "bayi_siparis_reddedildi"
  | "bayi_kargo_cikti"
  | "bayi_vade_yaklasti"
  | "bayi_vade_gecti"
  | "bayi_fatura_kesildi"
  | "bayi_odeme_alindi"
  // Dağıtıcı kendine (4)
  | "dagitici_yeni_siparis"
  | "dagitici_onay_bekleyen"
  | "dagitici_kritik_stok"
  | "dagitici_geciken_rapor";

export interface BayiEventDef {
  type: BayiEventType;
  audience: "dealer" | "distributor";
  label: string;
  description: string;
  /** Meta template adı (templates.ts kataloğuyla eşleşir). */
  templateName: string;
}

export const BAYI_EVENT_DEFS: Record<BayiEventType, BayiEventDef> = {
  bayi_hosgeldin: {
    type: "bayi_hosgeldin",
    audience: "dealer",
    label: "Hoşgeldin",
    description: "Bayi portala kayıt olduğunda karşılama mesajı.",
    templateName: "upu_bayi_hosgeldin",
  },
  bayi_yeni_kampanya: {
    type: "bayi_yeni_kampanya",
    audience: "dealer",
    label: "Yeni kampanya",
    description: "Hedeflemesine uyan kampanya aktive edildiğinde.",
    templateName: "upu_bayi_kampanya",
  },
  bayi_siparis_alindi: {
    type: "bayi_siparis_alindi",
    audience: "dealer",
    label: "Sipariş alındı",
    description: "Sipariş oluşturuldu, dağıtıcı onayı bekliyor.",
    templateName: "upu_bayi_siparis_alindi",
  },
  bayi_siparis_onaylandi: {
    type: "bayi_siparis_onaylandi",
    audience: "dealer",
    label: "Sipariş onaylandı",
    description: "Dağıtıcı siparişi onayladı, hazırlığa geçti.",
    templateName: "upu_bayi_siparis_onay",
  },
  bayi_siparis_reddedildi: {
    type: "bayi_siparis_reddedildi",
    audience: "dealer",
    label: "Sipariş reddedildi",
    description: "Dağıtıcı siparişi reddetti (sebep notuyla).",
    templateName: "upu_bayi_siparis_red",
  },
  bayi_kargo_cikti: {
    type: "bayi_kargo_cikti",
    audience: "dealer",
    label: "Kargo çıktı",
    description: "Sipariş kargoya verildi, takip no üretildi.",
    templateName: "upu_bayi_kargo",
  },
  bayi_vade_yaklasti: {
    type: "bayi_vade_yaklasti",
    audience: "dealer",
    label: "Vade yaklaşıyor",
    description: "Fatura vadesine 3 gün / 1 gün kala hatırlatma.",
    templateName: "upu_bayi_vade_yaklasti",
  },
  bayi_vade_gecti: {
    type: "bayi_vade_gecti",
    audience: "dealer",
    label: "Vade geçti",
    description: "Fatura vadesi geçti, ödeme bekleniyor.",
    templateName: "upu_bayi_vade_gecti",
  },
  bayi_fatura_kesildi: {
    type: "bayi_fatura_kesildi",
    audience: "dealer",
    label: "Fatura kesildi",
    description: "Sipariş faturası hazır, PDF linki ile.",
    templateName: "upu_bayi_fatura",
  },
  bayi_odeme_alindi: {
    type: "bayi_odeme_alindi",
    audience: "dealer",
    label: "Ödeme alındı",
    description: "Ödemen işlendi, teşekkür mesajı.",
    templateName: "upu_bayi_odeme_tesekkur",
  },
  dagitici_yeni_siparis: {
    type: "dagitici_yeni_siparis",
    audience: "distributor",
    label: "Yeni sipariş geldi",
    description: "Bir bayi yeni sipariş verdi.",
    templateName: "upu_dagitici_yeni_siparis",
  },
  dagitici_onay_bekleyen: {
    type: "dagitici_onay_bekleyen",
    audience: "distributor",
    label: "Onay bekleyen siparişler",
    description: "Bekleyen sipariş hatırlatması (günlük özet).",
    templateName: "upu_dagitici_onay_bekleyen",
  },
  dagitici_kritik_stok: {
    type: "dagitici_kritik_stok",
    audience: "distributor",
    label: "Kritik stok",
    description: "Ürün stoğu eşiğin altına düştü.",
    templateName: "upu_dagitici_kritik_stok",
  },
  dagitici_geciken_rapor: {
    type: "dagitici_geciken_rapor",
    audience: "distributor",
    label: "Geciken bayi raporu",
    description: "Vadesi geçmiş bayilerin günlük özeti.",
    templateName: "upu_dagitici_geciken",
  },
};

export const BAYI_EVENT_TYPES = Object.keys(BAYI_EVENT_DEFS) as BayiEventType[];
