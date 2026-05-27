/**
 * Site SaaS Banka Sanal POS — provider-agnostic interface (Sprint 2 Modül 1).
 *
 * Çağrı 2026-05-27 onayı: "DEMO ONLY — mock entegrasyon, gerçek para çekme yok.
 * Iyzico-vari interface yaz ama dummy 'always succeeds' davranışı."
 *
 * V2'de gerçek provider (Iyzico/PayTR/Garanti) bu interface'i implement
 * edecek. UI tarafı provider'ı bilmez — `chargePayment(req)` çağırır.
 */

export interface PaymentChargeRequest {
  /** Ödeme tutarı kuruş cinsinden. */
  amount_kurus: number;
  /** TRY zorunlu (V2'de currency parametresi destekli olabilir). */
  currency: "TRY";
  /** Ödeme yapanın kart bilgileri (mock — kullanılmaz). */
  card_number_masked: string;  // örn "**** **** **** 1234"
  card_holder: string;
  /** İlgili ledger satırı veya iş objesi (idempotency için). */
  reference: string;
  /** Açıklama (banka ekstresinde görünür). */
  description: string;
}

export interface PaymentChargeResponse {
  success: boolean;
  /** Sağlayıcı tarafından dönen txn ID — webhook eşleştirme için. */
  transaction_id: string;
  /** Bankaya ne zaman gitti. */
  charged_at: string;
  /** Hata durumunda kod. Mock'ta hep null. */
  error_code: string | null;
  /** Hata mesajı. */
  error_message: string | null;
  /** Provider'ın ham yanıtı (debug). */
  raw_response?: Record<string, unknown>;
}

export interface PaymentProvider {
  name: string;
  charge(req: PaymentChargeRequest): Promise<PaymentChargeResponse>;
}

/**
 * Mock provider — her ödeme başarılı.
 *
 * V2'de gerçek Iyzico SDK adapter'ı yazılır:
 *   class IyzicoProvider implements PaymentProvider {
 *     async charge(req) { ... iyzipay.payment.create(...) ... }
 *   }
 */
export class MockSitePosProvider implements PaymentProvider {
  name = "mock-site-pos";

  async charge(req: PaymentChargeRequest): Promise<PaymentChargeResponse> {
    // Test/demo: 100ms gecikme + her zaman başarılı + random txn id
    await new Promise((resolve) => setTimeout(resolve, 100));

    const txnId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return {
      success: true,
      transaction_id: txnId,
      charged_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
      raw_response: {
        provider: "mock-site-pos",
        amount_kurus: req.amount_kurus,
        reference: req.reference,
        note: "DEMO ONLY — gerçek banka çekimi yapılmadı.",
      },
    };
  }
}

/**
 * Provider seçici — env veya config flag ile gerçek sağlayıcıya geçilebilir.
 *
 * Sprint 2: yalnızca MockSitePosProvider. Sprint 3+ gerçek Iyzico/PayTR
 * adapter'ı eklendiğinde burada switch.
 */
export function getSitePosProvider(): PaymentProvider {
  // V2: process.env.SITE_POS_PROVIDER === "iyzico" ? new IyzicoProvider() : ...
  return new MockSitePosProvider();
}
