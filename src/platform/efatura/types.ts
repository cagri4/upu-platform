/**
 * e-Fatura provider adapter interface — Faz 3 Sprint H.
 *
 * Tüm adapter'lar (Foriba, Mikrohizmet) bu interface'i implement eder.
 * Tetikleyici (emitInvoiceForOrder) tenant'ın aktif provider'ını çözer ve
 * issueInvoice çağırır.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface InvoiceLine {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
  lineDiscount: number;
}

export interface InvoiceBuyer {
  name: string;
  taxNo: string | null;
  taxOffice: string | null;
  address: string;
  city: string;
  email: string | null;
  phone: string | null;
}

export interface IssueInvoiceArgs {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  buyer: InvoiceBuyer;
  lines: InvoiceLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  currency: "TRY";
  issueDate: string; // YYYY-MM-DD
  notes?: string;
}

export interface IssueInvoiceResult {
  success: boolean;
  errorMessage?: string;
  invoiceNo: string | null;
  externalRef: string | null;
  pdfUrl: string | null;
  mocked: boolean;
  provider: string;
}

export interface VoidInvoiceArgs {
  tenantId: string;
  externalRef: string;
  reason: string;
}

export interface VoidInvoiceResult {
  success: boolean;
  errorMessage?: string;
}

export interface InvoiceProvider {
  id: string;
  issueInvoice(sb: SupabaseClient, args: IssueInvoiceArgs): Promise<IssueInvoiceResult>;
  voidInvoice(sb: SupabaseClient, args: VoidInvoiceArgs): Promise<VoidInvoiceResult>;
}
