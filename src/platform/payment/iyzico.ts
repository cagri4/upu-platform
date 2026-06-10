/**
 * iyzico Checkout Form adapter — Faz 3 Sprint G.
 *
 * Tenant ayarlarından (tenant_integration_settings, provider='iyzico')
 * api_key + secret_key + mode (sandbox/live) okur. SDK iyzipay-node
 * üzerinden CF init + retrieve sarmalar.
 *
 * Akış:
 *   1. start: cart + dealer + order_id → CF initialize → paymentPageUrl
 *   2. Kullanıcı paymentPageUrl'e redirect olur (iyzico 3DS sayfası)
 *   3. iyzico → callbackUrl'e POST (token + payment status)
 *   4. callback handler: CF retrieve → paymentStatus + paymentId → DB
 *
 * iyzipay paketi TypeScript types içermez; `unknown` cast'lerle sarmalanır.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getIntegrationSetting } from "@/platform/integrations/tenant-settings";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Iyzipay = require("iyzipay");

interface IyzipayConfig {
  apiKey: string;
  secretKey: string;
  uri: string;
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
): Promise<IyzipayConfig | null> {
  const setting = await getIntegrationSetting(sb, tenantId, "iyzico");
  if (!setting || !setting.isActive) return null;

  const apiKey = (setting.secrets.api_key as string) || "";
  const secretKey = (setting.secrets.secret_key as string) || "";
  const mode = (setting.config.mode as string) || "sandbox";
  if (!apiKey || !secretKey) return null;

  const uri =
    mode === "live"
      ? "https://api.iyzipay.com"
      : "https://sandbox-api.iyzipay.com";

  return { apiKey, secretKey, uri };
}

interface IyzipayInstance {
  checkoutFormInitialize: {
    create: (
      req: Record<string, unknown>,
      cb: (err: unknown, result: Record<string, unknown>) => void,
    ) => void;
  };
  checkoutForm: {
    retrieve: (
      req: Record<string, unknown>,
      cb: (err: unknown, result: Record<string, unknown>) => void,
    ) => void;
  };
}

function createClient(cfg: IyzipayConfig): IyzipayInstance {
  return new Iyzipay({
    apiKey: cfg.apiKey,
    secretKey: cfg.secretKey,
    uri: cfg.uri,
  }) as unknown as IyzipayInstance;
}

export async function initCheckout(
  sb: SupabaseClient,
  args: CheckoutInitArgs,
): Promise<CheckoutInitResult & { mocked?: boolean }> {
  const cfg = await getConfig(sb, args.tenantId);
  if (!cfg) {
    // Provider yapılandırılmamış veya aktif değil — mock akış
    // (Çağrı'nın sandbox/live key vermesi gelene kadar UI test edilebilir)
    return {
      status: "success",
      token: `mock-${args.orderId}`,
      paymentPageUrl: `${args.callbackUrl}?mocked=1&token=mock-${args.orderId}`,
      conversationId: args.conversationId,
      mocked: true,
    };
  }

  const client = createClient(cfg);
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

  return new Promise<CheckoutInitResult>((resolve) => {
    client.checkoutFormInitialize.create(request, (err, result) => {
      if (err || !result) {
        resolve({
          status: "failure",
          errorMessage: String(err ?? "iyzico hata"),
        });
        return;
      }
      const status = (result.status as string) || "failure";
      if (status !== "success") {
        resolve({
          status: "failure",
          errorMessage: (result.errorMessage as string) || "iyzico reddetti",
          errorCode: (result.errorCode as string) || undefined,
          conversationId: (result.conversationId as string) || undefined,
        });
        return;
      }
      resolve({
        status: "success",
        token: result.token as string,
        paymentPageUrl: result.paymentPageUrl as string,
        conversationId: (result.conversationId as string) || undefined,
      });
    });
  });
}

export async function retrievePayment(
  sb: SupabaseClient,
  tenantId: string,
  token: string,
): Promise<RetrieveResult> {
  // Mock token — config olmadığında start mock olarak imzaladı
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

  const client = createClient(cfg);
  return new Promise<RetrieveResult>((resolve) => {
    client.checkoutForm.retrieve({ token }, (err, result) => {
      if (err || !result) {
        resolve({
          status: "failure",
          paymentStatus: null,
          paymentId: null,
          paidPrice: null,
          currency: null,
          conversationId: null,
          errorMessage: String(err ?? "iyzico retrieve hata"),
        });
        return;
      }
      const status = (result.status as string) || "failure";
      const paymentStatus = (result.paymentStatus as string) || null;
      resolve({
        status: status === "success" ? "success" : "failure",
        paymentStatus,
        paymentId: (result.paymentId as string) || null,
        paidPrice:
          result.paidPrice != null ? Number(result.paidPrice) : null,
        currency: (result.currency as string) || "TRY",
        conversationId: (result.conversationId as string) || null,
        errorMessage: (result.errorMessage as string) || undefined,
        errorCode: (result.errorCode as string) || undefined,
        raw: result as Record<string, unknown>,
      });
    });
  });
}
