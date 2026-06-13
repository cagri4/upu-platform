/**
 * KBS (Konaklama Bildirim Sistemi) — Mock Client
 *
 * Gerçek KBS entegrasyonu: T.C. İçişleri Bakanlığı / Polis Genel Müdürlüğü
 * SOAP servisi. Otel sahibi başvurusu + güvenli kimlik (tesis kodu + şifre)
 * gerektirir.
 *
 * Bu modül gerçek API gelene kadar TÜM akışı simüle eder:
 *   - 200ms sahte latency
 *   - %85 accepted, %10 pending (random ref no), %5 rejected (gerçek hata
 *     mesajı taklit edilir — "TC kimlik no hatalı", "doğum tarihi yanlış"...)
 *
 * Gerçek istemci eklendiğinde: bu dosya `real-client.ts`'in yanına gider,
 * env `KBS_MOCK=false` ile switch yapılır.
 */

export interface KbsGuestInput {
  tc_no?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  guest_name: string;
  birth_date?: string | null;
  nationality?: string | null;
  mother_name?: string | null;
  father_name?: string | null;
  gender?: string | null;
}

export interface KbsStayInput {
  room_name?: string | null;
  check_in: string;
  check_out: string;
}

export interface KbsHotelInput {
  hotel_name: string;
  hotel_id: string;
}

export interface KbsSubmissionPayload {
  guest: KbsGuestInput;
  stay: KbsStayInput;
  hotel: KbsHotelInput;
}

export interface KbsSubmissionResult {
  status: "accepted" | "rejected" | "pending" | "failed";
  reference_no: string | null;
  raw_response: Record<string, unknown>;
  error_message: string | null;
  is_mock: true;
}

const MOCK_LATENCY_MS = 200;

function randomRef(): string {
  const part = () => Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `MOCK-KBS-${part()}-${part()}`;
}

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

function validateGuest(g: KbsGuestInput): string | null {
  if (!g.guest_name || g.guest_name.trim().length < 3) {
    return "Misafir adı en az 3 karakter olmalı";
  }
  if (g.tc_no && !/^\d{11}$/.test(g.tc_no)) {
    return "TC kimlik numarası 11 haneli olmalı";
  }
  if (g.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(g.birth_date)) {
    return "Doğum tarihi YYYY-MM-DD formatında olmalı";
  }
  if (!g.tc_no && !g.id_number) {
    return "TC kimlik no veya yabancı kimlik/pasaport no girilmeli";
  }
  return null;
}

export async function submitKbsMock(payload: KbsSubmissionPayload): Promise<KbsSubmissionResult> {
  await new Promise(resolve => setTimeout(resolve, MOCK_LATENCY_MS));

  // Önce statik validation hataları
  const validationError = validateGuest(payload.guest);
  if (validationError) {
    return {
      status: "rejected",
      reference_no: null,
      raw_response: { mock: true, error_code: "VAL_ERR", message: validationError },
      error_message: validationError,
      is_mock: true,
    };
  }

  // Sonra ağırlıklı random sonuç
  const outcome = pickWeighted([
    { value: "accepted" as const, weight: 85 },
    { value: "pending" as const, weight: 10 },
    { value: "rejected" as const, weight: 5 },
  ]);

  if (outcome === "accepted") {
    const ref = randomRef();
    return {
      status: "accepted",
      reference_no: ref,
      raw_response: {
        mock: true,
        kbs_ref: ref,
        accepted_at: new Date().toISOString(),
        message: "Bildirim kabul edildi (MOCK)",
      },
      error_message: null,
      is_mock: true,
    };
  }

  if (outcome === "pending") {
    const ref = randomRef();
    return {
      status: "pending",
      reference_no: ref,
      raw_response: {
        mock: true,
        kbs_ref: ref,
        message: "Bildirim alındı, manuel inceleme bekleniyor (MOCK)",
      },
      error_message: null,
      is_mock: true,
    };
  }

  // rejected — random sahte hata
  const errors = [
    "TC kimlik numarası nüfus kayıtlarıyla eşleşmiyor",
    "Doğum tarihi nüfus kayıtlarıyla uyuşmuyor",
    "Misafir adı kimlik bilgileriyle eşleşmiyor",
    "Tesis kodu doğrulanamadı",
  ];
  const message = errors[Math.floor(Math.random() * errors.length)];
  return {
    status: "rejected",
    reference_no: null,
    raw_response: {
      mock: true,
      error_code: `MOCK_E${Math.floor(Math.random() * 900) + 100}`,
      message,
    },
    error_message: message,
    is_mock: true,
  };
}
