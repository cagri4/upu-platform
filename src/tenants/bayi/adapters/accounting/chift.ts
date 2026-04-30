/**
 * Chift Unified Accounting Adapter — Yuki / Exact Online / SnelStart
 *
 * Chift bir "unified API" — 3 farklı NL muhasebe yazılımına tek
 * arayüzden bağlanmamızı sağlar. Avantajı: müşteri Yuki kullanıyorsa
 * connection_id + integration_key="yuki" ile, Exact kullanıyorsa
 * "exact_online", SnelStart kullanıyorsa "snelstart" — kod tek.
 *
 * Müşteri onboarding'i:
 *   1. /api/chift/connect endpoint'i Chift hosted-flow URL'i üretir
 *      (CHIFT_API_KEY ile authenticate, connection oluştur)
 *   2. Müşteri Chift sayfasına yönlendirilir → muhasebe yazılımına
 *      OAuth ile yetki verir
 *   3. Chift webhook → bizim /api/chift/webhook → connection.success
 *      → profile.metadata.chift_connection_id kaydedilir
 *   4. Bu adapter o connection_id ile Chift API'yi kullanır
 *
 * MVP not: gerçek Chift API binding bu commit'te yok — bu adapter şu
 * an stub'a güvenli fallback yapar (CHIFT_API_KEY env-var yoksa
 * AdapterNotReadyError fırlatır). Production'da env-var eklenince
 * implementation aktive edilir.
 *
 * Chift API: https://docs.chift.eu/
 */

import type { AccountingAdapter } from "../index";
import { AdapterNotReadyError } from "../index";
import { getServiceClient } from "@/platform/auth/supabase";

const CHIFT_API_BASE = "https://api.chift.eu";

interface ChiftClientCreds {
  apiKey: string;
  accountId: string;
}

function getChiftCreds(): ChiftClientCreds | null {
  const apiKey = process.env.CHIFT_API_KEY;
  const accountId = process.env.CHIFT_ACCOUNT_ID;
  if (!apiKey || !accountId) return null;
  return { apiKey, accountId };
}

/**
 * Read user's Chift connection_id from profile metadata. Müşteri
 * onboarding'de Chift hosted-flow tamamlanmışsa burada bulunur.
 */
async function getUserChiftConnectionId(userId: string): Promise<string | null> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();
  const meta = (profile?.metadata || {}) as Record<string, unknown>;
  const integrations = (meta.chift_integrations || {}) as Record<string, string>;
  return integrations.accounting_connection_id || null;
}

/**
 * Chift API call wrapper — Bearer auth + connection-id header.
 * Faz 5 MVP: gerçek API binding burada yapılır; şu an stub:
 * env-var yoksa veya connection_id yoksa AdapterNotReadyError.
 */
async function chiftCall(
  creds: ChiftClientCreds,
  connectionId: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${CHIFT_API_BASE}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      "X-Account-Id": creds.accountId,
      "X-Chift-Account-Id": creds.accountId,
      "Authorization": `Bearer ${creds.apiKey}`,
      "X-Connection-Id": connectionId,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

/**
 * Build a ChiftAccountingAdapter for a specific user's connection.
 * Returns null if user hasn't connected accounting yet (or env missing).
 */
export async function buildChiftAccountingAdapter(
  userId: string,
  integrationKey: "yuki" | "exact" | "snelstart",
): Promise<AccountingAdapter | null> {
  const creds = getChiftCreds();
  const connectionId = await getUserChiftConnectionId(userId);

  // Production'da CHIFT_API_KEY var ve user connection tamamlamışsa: gerçek
  // implementation. Yoksa: stub fallback (AdapterNotReadyError throw eder).
  if (!creds || !connectionId) {
    return {
      key: integrationKey,
      async getDealerBalance(): Promise<{ balance: number; currency: string } | null> {
        throw new AdapterNotReadyError("accounting", integrationKey);
      },
      async pushInvoice(): Promise<{ externalId: string }> {
        throw new AdapterNotReadyError("accounting", integrationKey);
      },
    };
  }

  return {
    key: integrationKey,

    async getDealerBalance(dealerExternalId: string): Promise<{ balance: number; currency: string } | null> {
      // Chift contacts/{id}/balance pattern (gerçek endpoint dokümana göre
      // farklı olabilir; entegrasyon test edildiğinde finalize edilecek).
      try {
        const res = await chiftCall(creds, connectionId, `/consumers/contacts/${dealerExternalId}/balance`);
        if (!res.ok) return null;
        const data = await res.json() as { balance: number; currency: string };
        return { balance: data.balance, currency: data.currency };
      } catch (err) {
        console.error("[chift:getDealerBalance]", err);
        return null;
      }
    },

    async pushInvoice(invoice): Promise<{ externalId: string }> {
      const payload = {
        contact_id: invoice.dealerExternalId,
        invoice_number: invoice.invoiceNo,
        currency: invoice.currency,
        due_date: invoice.dueDate,
        lines: invoice.items.map(item => ({
          description: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          tax_rate: invoice.btwRate,
        })),
        total: invoice.amount,
      };
      const res = await chiftCall(creds, connectionId, "/consumers/invoices", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Chift pushInvoice failed: ${res.status} ${errText}`);
      }
      const data = await res.json() as { id: string };
      return { externalId: data.id };
    },

    async listRecentInvoices(limit = 20): Promise<Array<{ externalId: string; invoiceNo: string; amount: number }>> {
      try {
        const res = await chiftCall(creds, connectionId, `/consumers/invoices?limit=${limit}`);
        if (!res.ok) return [];
        const data = await res.json() as { items?: Array<{ id: string; invoice_number: string; total: number }> };
        return (data.items || []).map(item => ({
          externalId: item.id,
          invoiceNo: item.invoice_number,
          amount: item.total,
        }));
      } catch {
        return [];
      }
    },
  };
}
