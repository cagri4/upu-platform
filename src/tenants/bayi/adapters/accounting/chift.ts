/**
 * Chift Unified Accounting Adapter — Yuki / Exact Online / SnelStart
 *
 * Chift "unified API" — 3 farklı NL muhasebe yazılımına tek arayüz.
 * Müşteri Yuki kullanıyorsa connection_id + integration_key="yuki",
 * Exact kullanıyorsa "exact_online", SnelStart kullanıyorsa "snelstart".
 *
 * Müşteri onboarding'i:
 *   1. /api/chift/connect → Chift hosted-flow URL'i üretir
 *   2. Müşteri Chift sayfasına gider, OAuth ile yetki verir
 *   3. Chift webhook /api/chift/webhook → connection_id kaydedilir
 *   4. Bu adapter o connection_id ile Chift API'yi kullanır
 *
 * MVP: gerçek Chift API binding env-var (CHIFT_API_KEY) yoksa graceful
 * stub fallback (her metod AdapterNotReadyError throw eder).
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
 * Returns adapter implementation; if env-var or connection missing,
 * methods throw AdapterNotReadyError.
 */
export async function buildChiftAccountingAdapter(
  userId: string,
  integrationKey: "yuki" | "exact" | "snelstart",
): Promise<AccountingAdapter> {
  const creds = getChiftCreds();
  const connectionId = await getUserChiftConnectionId(userId);

  if (!creds || !connectionId) {
    return {
      key: integrationKey,
      async listCustomers() { throw new AdapterNotReadyError("accounting", integrationKey); },
      async listProducts() { throw new AdapterNotReadyError("accounting", integrationKey); },
      async getCustomerBalance() { throw new AdapterNotReadyError("accounting", integrationKey); },
      async listOpenInvoices() { throw new AdapterNotReadyError("accounting", integrationKey); },
      async listPayments() { throw new AdapterNotReadyError("accounting", integrationKey); },
    };
  }

  return {
    key: integrationKey,

    async listCustomers() {
      const res = await chiftCall(creds, connectionId, "/consumers/contacts");
      if (!res.ok) return [];
      const data = await res.json() as { items?: Array<{ id: string; name: string; vat_number?: string }> };
      return (data.items || []).map(c => ({
        externalId: c.id,
        name: c.name,
        vatNumber: c.vat_number,
      }));
    },

    async listProducts() {
      const res = await chiftCall(creds, connectionId, "/consumers/products");
      if (!res.ok) return [];
      const data = await res.json() as { items?: Array<{ id: string; name: string; code?: string; unit_price?: number; vat_rate?: number }> };
      return (data.items || []).map(p => ({
        externalId: p.id,
        name: p.name,
        code: p.code,
        unitPrice: p.unit_price ?? 0,
        vatRate: p.vat_rate ?? 21,
      }));
    },

    async getCustomerBalance(customerExternalId) {
      try {
        const res = await chiftCall(creds, connectionId, `/consumers/contacts/${customerExternalId}/balance`);
        if (!res.ok) return null;
        const data = await res.json() as { balance: number; currency: string };
        return { balance: data.balance, currency: data.currency };
      } catch (err) {
        console.error("[chift:getCustomerBalance]", err);
        return null;
      }
    },

    async listOpenInvoices(customerExternalId) {
      const path = customerExternalId
        ? `/consumers/invoices?customer_id=${customerExternalId}&status=open`
        : `/consumers/invoices?status=open`;
      const res = await chiftCall(creds, connectionId, path);
      if (!res.ok) return [];
      const data = await res.json() as { items?: Array<{ id: string; invoice_number: string; total: number; currency: string; due_date: string }> };
      return (data.items || []).map(inv => ({
        externalId: inv.id,
        invoiceNo: inv.invoice_number,
        amount: inv.total,
        currency: inv.currency,
        dueDate: inv.due_date,
      }));
    },

    async listPayments(since) {
      const res = await chiftCall(creds, connectionId, `/consumers/payments?since=${encodeURIComponent(since)}`);
      if (!res.ok) return [];
      const data = await res.json() as { items?: Array<{ id: string; customer_id: string; amount: number; received_at: string }> };
      return (data.items || []).map(p => ({
        externalId: p.id,
        customerExternalId: p.customer_id,
        amount: p.amount,
        receivedAt: p.received_at,
      }));
    },
  };
}
