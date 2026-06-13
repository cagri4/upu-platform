/**
 * e-Fatura / e-Arşiv — Mock Client (Faz 4)
 *
 * Gerçek entegrasyon: GİB UBL-TR XML formatı, entegratör firmalardan biri
 * (e-Finans, Logo, Sovos, Mikro vb.) üzerinden gönderilir. Otel sahibinin
 * mali müşavir + entegratör sözleşmesi gerekir.
 *
 * Bu modül gerçek entegratör gelene kadar tüm akışı simüle eder:
 *   - %92 accepted (UUID + invoice no döner)
 *   - %5 rejected (örn. VKN hatası)
 *   - %3 failed (entegratör down)
 *   - 300ms sahte latency
 *   - Mock PDF URL üretir
 */

export interface InvoiceCustomer {
  name: string;
  vkn_or_tckn?: string | null;       // 11 hane TC veya 10 hane VKN
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;          // KDV hariç birim fiyat
  vat_rate: number;            // % 8 / 18 / vb
}

export interface InvoicePayload {
  invoice_type: "e_fatura" | "e_arsiv";
  customer: InvoiceCustomer;
  items: InvoiceItem[];
  total: number;               // KDV dahil toplam
  currency: string;
  reservation_ref?: string;
}

export interface InvoiceResult {
  status: "accepted" | "rejected" | "failed";
  invoice_uuid: string | null;
  invoice_number: string | null;
  pdf_url: string | null;
  raw_response: Record<string, unknown>;
  error_message: string | null;
  is_mock: true;
}

const MOCK_LATENCY_MS = 300;

function pickWeighted<T>(items: Array<{ value: T; weight: number }>): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (const item of items) {
    acc += item.weight;
    if (r <= acc) return item.value;
  }
  return items[items.length - 1].value;
}

function genUuid(): string {
  const part = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `mock-${part()}${part()}-${part()}-${part()}-${part()}${part()}${part()}`;
}

function genInvoiceNo(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 1000000).toString().padStart(7, "0");
  return `MOCK${year}${seq}`;
}

function validate(payload: InvoicePayload): string | null {
  if (!payload.customer.name || payload.customer.name.trim().length < 2) {
    return "Müşteri adı en az 2 karakter olmalı";
  }
  if (payload.invoice_type === "e_fatura" && !payload.customer.vkn_or_tckn) {
    return "e-Fatura için VKN/TCKN zorunludur";
  }
  if (payload.customer.vkn_or_tckn) {
    const id = payload.customer.vkn_or_tckn;
    if (!/^\d{10}$|^\d{11}$/.test(id)) {
      return "VKN 10 hane, TCKN 11 hane olmalı";
    }
  }
  if (!payload.items?.length) return "En az 1 fatura satırı olmalı";
  if (payload.total <= 0) return "Toplam tutar 0'dan büyük olmalı";
  return null;
}

export async function submitInvoiceMock(payload: InvoicePayload): Promise<InvoiceResult> {
  await new Promise(resolve => setTimeout(resolve, MOCK_LATENCY_MS));

  const validationError = validate(payload);
  if (validationError) {
    return {
      status: "rejected",
      invoice_uuid: null,
      invoice_number: null,
      pdf_url: null,
      raw_response: { mock: true, error_code: "VAL_ERR", message: validationError },
      error_message: validationError,
      is_mock: true,
    };
  }

  const outcome = pickWeighted([
    { value: "accepted" as const, weight: 92 },
    { value: "rejected" as const, weight: 5 },
    { value: "failed" as const, weight: 3 },
  ]);

  if (outcome === "accepted") {
    const uuid = genUuid();
    const no = genInvoiceNo();
    return {
      status: "accepted",
      invoice_uuid: uuid,
      invoice_number: no,
      pdf_url: `https://mock-efatura.upudev.nl/pdf/${uuid}.pdf`,
      raw_response: {
        mock: true,
        uuid, invoice_number: no,
        accepted_at: new Date().toISOString(),
        message: "Fatura kabul edildi (MOCK)",
      },
      error_message: null,
      is_mock: true,
    };
  }

  if (outcome === "rejected") {
    const errors = [
      "GİB sisteminde belirtilen VKN aktif değil",
      "Müşteri kayıtlı kullanıcı listesinde bulunamadı",
      "Fatura tipi seçili döneme uygun değil",
    ];
    const message = errors[Math.floor(Math.random() * errors.length)];
    return {
      status: "rejected",
      invoice_uuid: null,
      invoice_number: null,
      pdf_url: null,
      raw_response: { mock: true, error_code: "REJ_GIB", message },
      error_message: message,
      is_mock: true,
    };
  }

  // failed
  return {
    status: "failed",
    invoice_uuid: null,
    invoice_number: null,
    pdf_url: null,
    raw_response: { mock: true, error_code: "INTEGRATOR_503", message: "Entegratör servisi yanıt vermiyor" },
    error_message: "Entegratör servisi geçici olarak ulaşılamıyor",
    is_mock: true,
  };
}
