/**
 * iyzico Checkout Form adapter — Faz 3 Sprint G.
 *
 * iyzipay SDK (CommonJS dynamic require) Turbopack ile uyumsuz; bu yüzden
 * doğrudan REST API'yi çağırıyoruz. Auth pattern:
 *   Authorization: IYZWS <apiKey>:<base64(HMAC-SHA1(secretKey, apiKey + randomString + bodyJson))>
 *   x-iyzi-rnd: <randomString>
 *
 * Endpoint'ler (iyzico docs):
 *   POST /payment/iyzipos/checkoutform/initialize/auth/ecom  — CF init
 *   POST /payment/iyzipos/checkoutform/auth/ecom/detail     — payment retrieve
 *
 * Tenant ayarlarından credential okur (mode=sandbox/live).
 * Yapılandırılmamış / inactive ise mock token üretir (UI test edilebilir).
 */
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getIntegrationSetting } from "@/platform/integrations/tenant-settings";

interface IyzicoConfig {
  apiKey: string;
  secretKey: string;
  baseUri: string;
}

interface BuyerInfo {
  id: string;
  name: string;
  surname: string;
  email: string;
  identityNumber?: string;
  phone?: string;
  registrationAddress: string;
  city: string;
  country: string;
  ip: string;
}

export interface CheckoutInitArgs {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  total: number;
  currency: "TRY";
  callbackUrl: string;
  buyer: BuyerInfo;
  basketItems: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
  }>;
  conversationId?: string;
}

export interface CheckoutInitResult {
  status: "success" | "failure";
  errorMessage?: string;
  errorCode?: string;
  token?: string;
  paymentPageUrl?: string;
  conversationId?: string;
  mocked?: boolean;
}

export interface RetrieveResult {
  status: "success" | "failure";
  paymentStatus: string | null;
  paymentId: string | null;
  paidPrice: number | null;
  currency: string | null;
  conversationId: string | null;
  errorMessage?: string;
  errorCode?: string;
  raw?: Record<string, unknown>;
}

async function getConfig(
  sb: SupabaseClient,
  tenantId: string,
): Promise<IyzicoConfig | null> {
  const setting = await getIntegrationSetting(sb, tenantId, "iyzico");
  if (!setting || !setting.isActive) return null;

  const apiKey = (setting.secrets.api_key as string) || "";
  const secretKey = (setting.secrets.secret_key as string) || "";
  const mode = (setting.config.mode as string) || "sandbox";
  if (!apiKey || !secretKey) return null;

  const baseUri =
    mode === "live"
      ? "https://api.iyzipay.com"
      : "https://sandbox-api.iyzipay.com";

  return { apiKey, secretKey, baseUri };
}

function randomString(): string {
  return crypto.randomBytes(8).toString("hex");
}

function buildAuthHeader(cfg: IyzicoConfig, rnd: string, body: string): string {
  // iyzico v1 auth: base64(HMAC-SHA1(secretKey, apiKey + rnd + body))
  const hmac = crypto.createHmac("sha1", cfg.secretKey);
  hmac.update(cfg.apiKey + rnd + body);
  const signature = hmac.digest("base64");
  return `IYZWS ${cfg.apiKey}:${signature}`;
}

async function iyzicoPost(
  cfg: IyzicoConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const rnd = randomString();
  const json = JSON.stringify(body);
  const auth = buildAuthHeader(cfg, rnd, json);
  const res = await fetch(`${cfg.baseUri}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
      "x-iyzi-rnd": rnd,
      Accept: "application/json",
    },
    body: json,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return data;
}

export async function initCheckout(
  sb: SupabaseClient,
  args: CheckoutInitArgs,
): Promise<CheckoutInitResult> {
  const cfg = await getConfig(sb, args.tenantId);
  if (!cfg) {
    // Mock: provider yapılandırılmamış. Callback'e GET ile dönüyoruz.
    const token = `mock-${args.orderId}`;
    return {
      status: "success",
      token,
      paymentPageUrl: `${args.callbackUrl}?token=${encodeURIComponent(token)}&mocked=1`,
      conversationId: args.conversationId,
      mocked: true,
    };
  }

  const request: Record<string, unknown> = {
    locale: "tr",
    conversationId: args.conversationId || args.orderId,
    price: args.total.toFixed(2),
    paidPrice: args.total.toFixed(2),
    currency: args.currency,
    basketId: args.orderNumber,
    paymentGroup: "PRODUCT",
    callbackUrl: args.callbackUrl,
    buyer: {
      id: args.buyer.id,
      name: args.buyer.name,
      surname: args.buyer.surname,
      gsmNumber: args.buyer.phone || "+905555555555",
      email: args.buyer.email,
      identityNumber: args.buyer.identityNumber || "11111111111",
      registrationAddress: args.buyer.registrationAddress,
      city: args.buyer.city,
      country: args.buyer.country,
      ip: args.buyer.ip,
    },
    shippingAddress: {
      contactName: `${args.buyer.name} ${args.buyer.surname}`.trim(),
      city: args.buyer.city,
      country: args.buyer.country,
      address: args.buyer.registrationAddress,
    },
    billingAddress: {
      contactName: `${args.buyer.name} ${args.buyer.surname}`.trim(),
      city: args.buyer.city,
      country: args.buyer.country,
      address: args.buyer.registrationAddress,
    },
    basketItems: args.basketItems.map((it) => ({
      id: it.id,
      name: it.name,
      category1: it.category,
      itemType: "PHYSICAL",
      price: it.price.toFixed(2),
    })),
  };

  let result: Record<string, unknown>;
  try {
    result = await iyzicoPost(
      cfg,
      "/payment/iyzipos/checkoutform/initialize/auth/ecom",
      request,
    );
  } catch (err) {
    return {
      status: "failure",
      errorMessage: `iyzico bağlantı hatası: ${String(err)}`,
    };
  }

  const status = (result.status as string) || "failure";
  if (status !== "success") {
    return {
      status: "failure",
      errorMessage: (result.errorMessage as string) || "iyzico reddetti",
      errorCode: (result.errorCode as string) || undefined,
      conversationId: (result.conversationId as string) || undefined,
    };
  }
  return {
    status: "success",
    token: result.token as string,
    paymentPageUrl: result.paymentPageUrl as string,
    conversationId: (result.conversationId as string) || undefined,
  };
}

export async function retrievePayment(
  sb: SupabaseClient,
  tenantId: string,
  token: string,
): Promise<RetrieveResult> {
  if (token.startsWith("mock-")) {
    return {
      status: "success",
      paymentStatus: "SUCCESS",
      paymentId: token,
      paidPrice: null,
      currency: "TRY",
      conversationId: null,
      raw: { mocked: true },
    };
  }

  const cfg = await getConfig(sb, tenantId);
  if (!cfg) {
    return {
      status: "failure",
      paymentStatus: null,
      paymentId: null,
      paidPrice: null,
      currency: null,
      conversationId: null,
      errorMessage: "iyzico yapılandırılmamış.",
    };
  }

  let result: Record<string, unknown>;
  try {
    result = await iyzicoPost(
      cfg,
      "/payment/iyzipos/checkoutform/auth/ecom/detail",
      { locale: "tr", token },
    );
  } catch (err) {
    return {
      status: "failure",
      paymentStatus: null,
      paymentId: null,
      paidPrice: null,
      currency: null,
      conversationId: null,
      errorMessage: `iyzico bağlantı hatası: ${String(err)}`,
    };
  }

  const status = (result.status as string) || "failure";
  const paymentStatus = (result.paymentStatus as string) || null;
  return {
    status: status === "success" ? "success" : "failure",
    paymentStatus,
    paymentId: (result.paymentId as string) || null,
    paidPrice: result.paidPrice != null ? Number(result.paidPrice) : null,
    currency: (result.currency as string) || "TRY",
    conversationId: (result.conversationId as string) || null,
    errorMessage: (result.errorMessage as string) || undefined,
    errorCode: (result.errorCode as string) || undefined,
    raw: result,
  };
}
