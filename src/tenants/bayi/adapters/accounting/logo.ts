/**
 * Logo Accounting Adapter — TR pazarı için iskelet.
 *
 * Müşteri Logo versiyonu netleşince (Tiger / GO / İşbaşı) implementasyon
 * doldurulacak. Şu an scaffold: tüm method'lar AdapterNotReadyError
 * fırlatır, çağıran kod kullanıcıya "Logo entegrasyonu yolda" mesajı
 * gösterir.
 *
 * NOT: Bu dosyayı doldurmak için Logo versiyonu + API erişim bilgisi
 * netleşmeli. Şu an implementasyona BAŞLAMAYIN.
 */

import type { AccountingAdapter } from "../index";
import { AdapterNotReadyError } from "../index";

export function buildLogoAccountingAdapter(): AccountingAdapter {
  return {
    key: "logo",
    async listCustomers() { throw new AdapterNotReadyError("accounting", "logo"); },
    async listProducts() { throw new AdapterNotReadyError("accounting", "logo"); },
    async getCustomerBalance() { throw new AdapterNotReadyError("accounting", "logo"); },
    async listOpenInvoices() { throw new AdapterNotReadyError("accounting", "logo"); },
    async listPayments() { throw new AdapterNotReadyError("accounting", "logo"); },
  };
}
