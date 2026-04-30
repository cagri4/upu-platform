/**
 * Mollie Payment Adapter — iDEAL + SEPA Direct Debit
 *
 * NL pazarında ödeme ekosisteminin merkezinde Mollie var. iki ana use-case:
 *
 *   1. iDEAL ödeme link'i: bayi vade gelince WA'da "iDEAL ile öde"
 *      butonu → Mollie hosted checkout → bayi banka uygulamasını açar
 *      → ödeme tamamlanır → webhook → biz cari hesabı kapatırız
 *   2. SEPA Direct Debit mandate: bayi tek seferlik mandate imzalar
 *      → sonraki vadelerde otomatik çekim (hatırlatma gerekmiyor)
 *
 * Mollie API: https://docs.mollie.com/
 *
 * MVP: gerçek API binding env-var (MOLLIE_API_KEY) yoksa stub fallback.
 * Production'da MOLLIE_API_KEY ve MOLLIE_WEBHOOK_SECRET eklenir.
 */

import type { PaymentAdapter } from "../index";
import { AdapterNotReadyError } from "../index";

const MOLLIE_API_BASE = "https://api.mollie.com/v2";

function getMollieApiKey(): string | null {
  return process.env.MOLLIE_API_KEY || null;
}

async function mollieCall(apiKey: string, path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${MOLLIE_API_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

/**
 * Build a MolliePaymentAdapter. iDEAL + SEPA Direct Debit destekler.
 */
export function buildMolliePaymentAdapter(): PaymentAdapter {
  const apiKey = getMollieApiKey();

  if (!apiKey) {
    return {
      key: "mollie",
      async createPaymentLink(): Promise<{ paymentId: string; checkoutUrl: string }> {
        throw new AdapterNotReadyError("payment", "mollie");
      },
      async createMandate(): Promise<{ mandateId: string }> {
        throw new AdapterNotReadyError("payment", "mollie");
      },
    };
  }

  return {
    key: "mollie",

    /**
     * Tek seferlik ödeme — bayi WA üzerinden iDEAL/kart ile öder.
     * Mollie payment.id'i kaydedilir, webhook'la status update.
     */
    async createPaymentLink(params): Promise<{ paymentId: string; checkoutUrl: string }> {
      const payload = {
        amount: {
          currency: params.currency,
          value: params.amount.toFixed(2),
        },
        description: params.description,
        redirectUrl: params.redirectUrl,
        webhookUrl: params.webhookUrl,
        metadata: {
          invoice_id: params.invoiceId,
        },
        // iDEAL primary, SEPA + kart fallback. Mollie'ya boş method
        // verirsek tüm aktif methodları gösterir — Mollie dashboard'tan
        // tenant kendi seçtiklerini açar.
      };
      const res = await mollieCall(apiKey, "/payments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Mollie createPaymentLink failed: ${res.status} ${errText}`);
      }
      const data = await res.json() as {
        id: string;
        _links?: { checkout?: { href: string } };
      };
      const checkoutUrl = data._links?.checkout?.href;
      if (!checkoutUrl) {
        throw new Error("Mollie response missing checkout URL");
      }
      return { paymentId: data.id, checkoutUrl };
    },

    /**
     * SEPA Direct Debit mandate — bayi tek seferlik imzalar, sonraki
     * vadelerde otomatik çekim. Türk dağıtıcının vade gecikme acısının
     * doğrudan çözümü.
     *
     * Mollie iki adımlı:
     *   1. Customer create
     *   2. Mandate create (paperOrSignature: paper | signature)
     *
     * Bu helper customer + mandate'i tek çağrıda yapıyor — basit kullanım
     * için. Daha sofistike akış için Customer'ı önceden cache'leyin.
     */
    async createMandate(params): Promise<{ mandateId: string }> {
      // Step 1: customer create
      const custRes = await mollieCall(apiKey, "/customers", {
        method: "POST",
        body: JSON.stringify({
          name: `Dealer ${params.dealerId}`,
          metadata: { dealer_id: params.dealerId },
        }),
      });
      if (!custRes.ok) {
        const errText = await custRes.text();
        throw new Error(`Mollie customer create failed: ${custRes.status} ${errText}`);
      }
      const customer = await custRes.json() as { id: string };

      // Step 2: mandate create
      const mandateRes = await mollieCall(apiKey, `/customers/${customer.id}/mandates`, {
        method: "POST",
        body: JSON.stringify({
          method: "directdebit",
          consumerName: `Dealer ${params.dealerId}`,
          consumerAccount: params.iban,
          signatureDate: params.signedDate,
        }),
      });
      if (!mandateRes.ok) {
        const errText = await mandateRes.text();
        throw new Error(`Mollie mandate create failed: ${mandateRes.status} ${errText}`);
      }
      const mandate = await mandateRes.json() as { id: string };
      return { mandateId: mandate.id };
    },
  };
}
