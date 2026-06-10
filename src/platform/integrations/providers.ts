/**
 * UPU entegrasyon provider registry — Faz 3.
 *
 * Her provider için:
 *   - id (DB tenant_integration_settings.provider değerine eşit)
 *   - category (payment / efatura / kargo / erp)
 *   - label / description
 *   - configSchema: non-sensitive ayar field'ları (UI form üretimi için)
 *   - secretSchema: sensitive credential field'ları (redact edilir)
 *
 * Yeni provider eklerken: schema'yı buraya ekle + ilgili adapter
 * (src/platform/{kategori}/<provider>.ts) yarat + Sprint UI listesinden
 * görünecek.
 */

export type ProviderCategory = "payment" | "efatura" | "kargo" | "erp";

export interface FieldSchema {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "number" | "url";
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  helper?: string;
}

export interface ProviderDef {
  id: string;
  category: ProviderCategory;
  label: string;
  description: string;
  docsUrl?: string;
  configSchema: FieldSchema[];
  secretSchema: FieldSchema[];
  status: "live" | "sandbox" | "mock" | "planned";
}

export const INTEGRATION_PROVIDERS: ProviderDef[] = [
  {
    id: "iyzico",
    category: "payment",
    label: "iyzico (TR)",
    description: "Kart ödeme — Türkiye. 3DS + taksit destekler.",
    docsUrl: "https://dev.iyzipay.com",
    configSchema: [
      {
        key: "mode",
        label: "Mod",
        type: "select",
        options: [
          { value: "sandbox", label: "Sandbox (test)" },
          { value: "live", label: "Canlı" },
        ],
        required: true,
      },
    ],
    secretSchema: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "secret_key", label: "Secret Key", type: "password", required: true },
    ],
    status: "sandbox",
  },
  {
    id: "mollie",
    category: "payment",
    label: "Mollie (EU)",
    description: "Kart + iDEAL + Bancontact — Avrupa pazarı.",
    docsUrl: "https://docs.mollie.com",
    configSchema: [],
    secretSchema: [
      { key: "api_key", label: "API Key (test_ veya live_)", type: "password", required: true },
    ],
    status: "live",
  },
  {
    id: "foriba",
    category: "efatura",
    label: "Foriba",
    description: "e-Fatura entegratör — yaygın TR sağlayıcı.",
    docsUrl: "https://www.foriba.com",
    configSchema: [
      {
        key: "mode",
        label: "Mod",
        type: "select",
        options: [
          { value: "sandbox", label: "Test" },
          { value: "live", label: "Canlı" },
        ],
        required: true,
      },
      { key: "gib_ettn_prefix", label: "GİB ETTN prefix", type: "text", placeholder: "TEST-" },
    ],
    secretSchema: [
      { key: "username", label: "Kullanıcı adı", type: "text", required: true },
      { key: "password", label: "Şifre", type: "password", required: true },
    ],
    status: "mock",
  },
  {
    id: "mikrohizmet",
    category: "efatura",
    label: "Mikrohizmet",
    description: "Alternatif TR e-Fatura entegratör (genellikle daha ucuz).",
    configSchema: [
      {
        key: "mode",
        label: "Mod",
        type: "select",
        options: [
          { value: "sandbox", label: "Test" },
          { value: "live", label: "Canlı" },
        ],
        required: true,
      },
    ],
    secretSchema: [
      { key: "api_key", label: "API Key", type: "password", required: true },
    ],
    status: "planned",
  },
  {
    id: "aras",
    category: "kargo",
    label: "Aras Kargo",
    description: "Gönderi oluştur + takip no + status webhook.",
    configSchema: [
      { key: "musteri_kodu", label: "Müşteri Kodu", type: "text", required: true },
    ],
    secretSchema: [
      { key: "username", label: "Kullanıcı adı", type: "text", required: true },
      { key: "password", label: "Şifre", type: "password", required: true },
    ],
    status: "mock",
  },
  {
    id: "yurtici",
    category: "kargo",
    label: "Yurtiçi Kargo",
    description: "Aras alternatifi.",
    configSchema: [
      { key: "musteri_kodu", label: "Müşteri Kodu", type: "text", required: true },
    ],
    secretSchema: [
      { key: "username", label: "Kullanıcı adı", type: "text", required: true },
      { key: "password", label: "Şifre", type: "password", required: true },
    ],
    status: "mock",
  },
  {
    id: "mng",
    category: "kargo",
    label: "MNG Kargo",
    description: "3. kargo seçeneği.",
    configSchema: [
      { key: "musteri_kodu", label: "Müşteri Kodu", type: "text", required: true },
    ],
    secretSchema: [
      { key: "api_key", label: "API Key", type: "password", required: true },
    ],
    status: "mock",
  },
  {
    id: "logo_tiger",
    category: "erp",
    label: "Logo Tiger",
    description:
      "ERP entegrasyonu — ürün/stok/fiyat/bayi senkron. LogoConnect veya Tiger Sync REST API.",
    docsUrl: "https://www.logo.com.tr",
    configSchema: [
      { key: "host", label: "Host", type: "url", placeholder: "https://tiger.firma.com", required: true },
      { key: "port", label: "Port", type: "number", placeholder: "32001" },
      { key: "firma_kodu", label: "Firma Kodu", type: "text", placeholder: "001", required: true },
    ],
    secretSchema: [
      { key: "username", label: "Kullanıcı adı", type: "text", required: true },
      { key: "password", label: "Şifre", type: "password", required: true },
    ],
    status: "planned",
  },
  {
    id: "parasut",
    category: "erp",
    label: "Paraşüt",
    description: "Küçük dağıtıcı için ERP alternatifi.",
    configSchema: [
      { key: "company_id", label: "Şirket ID", type: "text", required: true },
    ],
    secretSchema: [
      { key: "client_id", label: "Client ID", type: "password", required: true },
      { key: "client_secret", label: "Client Secret", type: "password", required: true },
    ],
    status: "planned",
  },
];

export function getProviderById(id: string): ProviderDef | null {
  return INTEGRATION_PROVIDERS.find((p) => p.id === id) ?? null;
}

export function getProvidersByCategory(cat: ProviderCategory): ProviderDef[] {
  return INTEGRATION_PROVIDERS.filter((p) => p.category === cat);
}

/**
 * Redact sensitive values for API GET response — show only "•••• last4".
 */
export function redactSecrets(
  provider: ProviderDef,
  secrets: Record<string, unknown>,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const f of provider.secretSchema) {
    const v = secrets[f.key];
    if (v == null || v === "") {
      out[f.key] = null;
    } else {
      const s = String(v);
      out[f.key] = s.length > 4 ? `••••${s.slice(-4)}` : "••••";
    }
  }
  return out;
}
