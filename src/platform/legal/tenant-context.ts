/**
 * Tenant-aware legal copy resolver — Sprint A.
 *
 * /tr/aydinlatma-metni, /tr/hizmet-sartlari, /tr/iade-iptal sayfaları
 * tenant'a göre brand + sektörel veri tipleri + rol metni değiştirir.
 *
 * Resolution sırası (page-level):
 *   1) ?tenant=<key> searchParams (cross-tenant link override)
 *   2) middleware'in enjekte ettiği x-tenant-key header (hostname'den)
 *   3) "emlak" default (backward compat)
 */

export type LegalTenantKey = "emlak" | "bayi";

export interface LegalTenantContext {
  key: LegalTenantKey;
  /** Kısa marka — header / breadcrumb için. */
  brand: string;
  /** "Hizmet Sağlayıcı" / "Veri Sorumlusu" satırında geçen tam ifade. */
  brandFull: string;
  /** Hizmet tanımı (1. bölüm). */
  serviceDescription: string;
  /** Hangi profesyonel kitleye yönelik (2. bölüm "Hesap Oluşturma"). */
  audienceClaim: string;
  /** İşlenen veri tipleri — KVKK metni 2. bölüm sektörel veri grubu. */
  sectoralDataTypes: string[];
  /** İşleme amaçları — KVKK metni 3. bölüm sektörel amaç maddesi. */
  sectoralPurposes: string[];
}

const CONTEXTS: Record<LegalTenantKey, LegalTenantContext> = {
  emlak: {
    key: "emlak",
    brand: "UPU Emlak",
    brandFull: "UPU Dev (UPU Emlak)",
    serviceDescription:
      "UPU Emlak (“Platform”), emlak danışmanlarına ve emlak ofislerine yönelik olarak portföy yönetimi, müşteri takibi, sözleşme ve sunum hazırlama, WhatsApp üzerinden otomatik bildirim ve iş akışı asistanlığı hizmetlerini sunan bir SaaS (Software as a Service) çözümüdür.",
    audienceClaim: "Profesyonel olarak emlak hizmeti sunma yetkiniz olduğunu beyan edersiniz.",
    sectoralDataTypes: [
      "Mülk ilanları (yüklediğiniz fotoğraf ve açıklamalar dahil)",
      "Müşteri bilgileri (sizin tarafınızdan girilen iletişim ve takip verileri)",
      "Sözleşme ve sunum içerikleri",
      "Hesap tercihleri ve ayarlar",
    ],
    sectoralPurposes: [
      "Mülk yönetimi, müşteri ve sözleşme süreçlerinin yürütülmesi",
    ],
  },
  bayi: {
    key: "bayi",
    brand: "UPU Bayi",
    brandFull: "UPU Dev (UPU Bayi)",
    serviceDescription:
      "UPU Bayi (“Platform”), distribütörlere ve bayi ağına sahip işletmelere yönelik olarak bayi yönetimi, sipariş takibi, tahsilat ve vade hatırlatma, kampanya ve anlaşma yönetimi ile WhatsApp üzerinden otomatik bildirim ve iş akışı asistanlığı hizmetlerini sunan bir SaaS (Software as a Service) çözümüdür.",
    audienceClaim:
      "Bir distribütör/üretici işletme veya yetkili bayi olarak ticari faaliyet yürüttüğünüzü beyan edersiniz.",
    sectoralDataTypes: [
      "Bayi ve dealer kayıtları (ünvan, yetkili adı, iletişim, vergi numarası, IBAN)",
      "Sipariş ve fatura bilgileri (kalem detayları, tutar, vade tarihi)",
      "Tahsilat ve ödeme kayıtları",
      "Anlaşma ve kampanya içerikleri",
      "Hesap tercihleri ve ayarlar",
    ],
    sectoralPurposes: [
      "Bayi yönetimi, sipariş ve tahsilat süreçlerinin yürütülmesi",
      "Vade hatırlatma ve gecikme bildirimlerinin otomasyonu",
    ],
  },
};

export function getLegalTenantContext(input: string | null | undefined): LegalTenantContext {
  if (input === "bayi") return CONTEXTS.bayi;
  return CONTEXTS.emlak;
}

/**
 * Server component'lerden çağrılır — header + searchParams öncelik sırasıyla
 * resolve eder. Çağıran sayfa `await` ile kullanır.
 */
export async function resolveLegalTenantContext(opts: {
  searchParamTenant?: string | null;
  headerTenant?: string | null;
}): Promise<LegalTenantContext> {
  const fromQuery = opts.searchParamTenant === "bayi" ? "bayi" : null;
  const fromHeader = opts.headerTenant === "bayi" ? "bayi" : null;
  return getLegalTenantContext(fromQuery ?? fromHeader ?? "emlak");
}
