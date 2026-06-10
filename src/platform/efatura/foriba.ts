/**
 * Foriba e-Fatura adapter — Faz 3 Sprint H.
 *
 * Çağrı Foriba sözleşmesi ayarlayana kadar mock akış default. Tenant
 * settings (provider='foriba') yapılandırıldığında ve aktif olduğunda
 * gerçek sandbox/live çağrısı yapılır.
 *
 * Mock akış:
 *   - invoiceNo = "MCK-${yıl}${ay}-NNNN" (tenant base sayısı)
 *   - externalRef = "mock-${uuid}"
 *   - pdfUrl = data URL: text/plain özet (UI'da indir butonu çalışır,
 *     gerçek PDF Foriba aktif olduğunda gelir)
 *
 * Live akış (placeholder — TODO Çağrı sözleşme + canlı key):
 *   POST {host}/Connector/api/Document/SendInvoice {document XML}
 *   Auth: Basic <user:pass>
 *   Response: { documentUUID, downloadUrl }
 *
 * Şu an live path implement edilmedi; config aktifse "Faz 3 Foriba canlı
 * pending" hatası döner. Sandbox/live wire'ı sonra eklenir.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getIntegrationSetting, recordSyncResult } from "@/platform/integrations/tenant-settings";
import type {
  InvoiceProvider,
  IssueInvoiceArgs,
  IssueInvoiceResult,
  VoidInvoiceArgs,
  VoidInvoiceResult,
} from "./types";

interface ForibaConfig {
  mode: "sandbox" | "live";
  username: string;
  password: string;
  baseUri: string;
  ettnPrefix: string;
}

async function getConfig(
  sb: SupabaseClient,
  tenantId: string,
): Promise<ForibaConfig | null> {
  const setting = await getIntegrationSetting(sb, tenantId, "foriba");
  if (!setting || !setting.isActive) return null;
  const username = (setting.secrets.username as string) || "";
  const password = (setting.secrets.password as string) || "";
  const mode = ((setting.config.mode as string) || "sandbox") as "sandbox" | "live";
  if (!username || !password) return null;
  const baseUri =
    mode === "live"
      ? "https://api.foriba.com"
      : "https://sandbox.foriba.com";
  return {
    mode,
    username,
    password,
    baseUri,
    ettnPrefix: (setting.config.gib_ettn_prefix as string) || "TEST-",
  };
}

function mockInvoiceNo(orderNumber: string): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `MCK-${ym}-${orderNumber.replace(/-/g, "").slice(-6).padStart(6, "0")}`;
}

function mockPdfUrl(invoiceNo: string, args: IssueInvoiceArgs): string {
  // Basit text "PDF" — gerçek Foriba canlıda binary PDF döner ve Supabase
  // Storage'a upload edilir. Mock akışta data URL ile UI testlenir.
  const summary = [
    `MOCK E-FATURA`,
    `=`.repeat(40),
    `Fatura No: ${invoiceNo}`,
    `Tarih: ${args.issueDate}`,
    `Sipariş: ${args.orderNumber}`,
    ``,
    `Alıcı:`,
    `  ${args.buyer.name}`,
    args.buyer.taxNo ? `  VKN: ${args.buyer.taxNo}` : "",
    args.buyer.address ? `  ${args.buyer.address}` : "",
    ``,
    `Kalemler:`,
    ...args.lines.map(
      (l) =>
        `  ${l.productCode}  ${l.productName.slice(0, 30)}  ` +
        `${l.quantity} x ${l.unitPrice.toFixed(2)} = ${l.lineTotal.toFixed(2)}`,
    ),
    ``,
    `Ara toplam:   ${args.subtotal.toFixed(2)} ${args.currency}`,
    `İndirim:     -${args.discountTotal.toFixed(2)} ${args.currency}`,
    `KDV:          ${args.taxTotal.toFixed(2)} ${args.currency}`,
    `TOPLAM:       ${args.total.toFixed(2)} ${args.currency}`,
    ``,
    `Faz 3 mock — gerçek PDF Foriba canlı bağlantısıyla gelecek.`,
  ]
    .filter(Boolean)
    .join("\n");
  const b64 = Buffer.from(summary, "utf-8").toString("base64");
  return `data:text/plain;charset=utf-8;base64,${b64}`;
}

export const foribaProvider: InvoiceProvider = {
  id: "foriba",

  async issueInvoice(
    sb: SupabaseClient,
    args: IssueInvoiceArgs,
  ): Promise<IssueInvoiceResult> {
    const cfg = await getConfig(sb, args.tenantId);
    if (!cfg) {
      // Mock akış — provider yapılandırılmamış
      const invoiceNo = mockInvoiceNo(args.orderNumber);
      const externalRef = `mock-${crypto.randomUUID()}`;
      const pdfUrl = mockPdfUrl(invoiceNo, args);
      await recordSyncResult(sb, {
        tenantId: args.tenantId,
        provider: "foriba",
        status: "ok",
      });
      return {
        success: true,
        invoiceNo,
        externalRef,
        pdfUrl,
        mocked: true,
        provider: "foriba",
      };
    }

    // TODO: Live Foriba REST çağrısı. Şimdilik sandbox/live mode
    // yapılandırıldıysa "henüz wire edilmedi" hatası döner. Hook tarafı
    // bunu yakalar ve siparişi engellemez (faturasız onaylanır).
    await recordSyncResult(sb, {
      tenantId: args.tenantId,
      provider: "foriba",
      status: "error",
      errorMessage: "Foriba canlı wire Faz 3 sonunda Çağrı onayıyla.",
    });
    return {
      success: false,
      invoiceNo: null,
      externalRef: null,
      pdfUrl: null,
      mocked: false,
      provider: "foriba",
      errorMessage:
        "Foriba canlı çağrı henüz wire edilmedi. Sözleşme + canlı API key ile aktive edilecek.",
    };
  },

  async voidInvoice(
    sb: SupabaseClient,
    args: VoidInvoiceArgs,
  ): Promise<VoidInvoiceResult> {
    const cfg = await getConfig(sb, args.tenantId);
    if (!cfg) {
      // Mock void — no-op
      return { success: true };
    }
    return {
      success: false,
      errorMessage: "Foriba void canlı wire pending.",
    };
  },
};
