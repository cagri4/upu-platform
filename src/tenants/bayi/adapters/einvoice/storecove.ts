/**
 * Storecove Peppol Adapter — UBL invoice oluşturma + Peppol network'a
 * gönderim.
 *
 * Storecove API (https://www.storecove.com/docs/) Peppol Access Point
 * olarak çalışır. Biz UBL XML üretip Storecove'a JSON payload ile
 * gönderiyoruz; Storecove Peppol network üzerinden alıcıya iletir.
 *
 * Kullanım: Pro tier'da owner Yuki/Exact'ten fatura kestiğinde otomatik
 * olarak Peppol UBL oluşur, alıcı bayinin Peppol ID'sine gönderilir.
 *
 * NL B2B Peppol 2030'da zorunlu olacak; biz şimdiden hazırlık.
 *
 * MVP: STORECOVE_API_KEY env-var yoksa AdapterNotReadyError.
 */

import type { EinvoiceAdapter } from "../index";
import { AdapterNotReadyError } from "../index";

const STORECOVE_API_BASE = "https://api.storecove.com/api/v2";

interface StorecoveCreds {
  apiKey: string;
  legalEntityId: string;        // Sender legal entity in Storecove
}

function getStorecoveCreds(): StorecoveCreds | null {
  const apiKey = process.env.STORECOVE_API_KEY;
  const legalEntityId = process.env.STORECOVE_LEGAL_ENTITY_ID;
  if (!apiKey || !legalEntityId) return null;
  return { apiKey, legalEntityId };
}

export function buildStorecoveEinvoiceAdapter(): EinvoiceAdapter {
  const creds = getStorecoveCreds();

  if (!creds) {
    return {
      key: "storecove",
      async sendInvoice(): Promise<{ documentId: string }> {
        throw new AdapterNotReadyError("einvoice", "storecove");
      },
    };
  }

  return {
    key: "storecove",

    /**
     * Storecove'a invoice payload (JSON) gönder. Storecove dahili olarak
     * UBL 2.1 üretir ve Peppol network'a gönderir. Çağıran kod
     * `invoiceXml` parametresini Storecove için hazır UBL XML olarak
     * verebilir VE/VEYA Storecove'un structured JSON payload'ı için ham
     * veriyi geçebilir. Burada XML received → wrap olarak alıyoruz.
     *
     * Receiver Peppol ID format: "iso6523-actorid-upis::0106:12345678"
     * (NL KvK için scheme 0106, BE için 0208, vb.)
     */
    async sendInvoice(params): Promise<{ documentId: string }> {
      const payload = {
        legalEntityId: creds.legalEntityId,
        // Storecove "documentSubmissions": ya direkt UBL dosya, ya
        // structured invoice. UBL paslamak için "document" alanı:
        document: {
          documentType: "invoice",
          rawDocumentData: {
            document: Buffer.from(params.invoiceXml, "utf-8").toString("base64"),
            parse: true,
            parseStrategy: "ubl",
          },
        },
        receiver: {
          identifier: params.receiverPeppolId,
        },
      };

      const res = await fetch(`${STORECOVE_API_BASE}/document_submissions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${creds.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Storecove sendInvoice failed: ${res.status} ${errText}`);
      }
      const data = await res.json() as { guid?: string; id?: string };
      return { documentId: data.guid || data.id || "unknown" };
    },
  };
}
