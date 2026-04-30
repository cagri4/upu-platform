/**
 * PostNL Shipping Adapter — etiket basma + tracking.
 *
 * Türk dağıtıcının NL bayisine kargo gönderirken kullandığı baskın
 * servis. PostNL Send API (REST) üzerinden:
 *   - createLabel: shipment + barcode + label PDF URL
 *   - trackShipment: barcode ile teslim durumu
 *
 * PostNL Send API: https://developer.postnl.nl/
 *
 * MVP: gerçek API binding env-var (POSTNL_API_KEY, POSTNL_CUSTOMER_CODE,
 * POSTNL_CUSTOMER_NUMBER) yoksa stub fallback.
 */

import type { ShippingAdapter } from "../index";
import { AdapterNotReadyError } from "../index";

const POSTNL_API_BASE = "https://api.postnl.nl";

interface PostNLCreds {
  apiKey: string;
  customerCode: string;
  customerNumber: string;
  collectionLocation?: string;
}

function getPostNLCreds(): PostNLCreds | null {
  const apiKey = process.env.POSTNL_API_KEY;
  const customerCode = process.env.POSTNL_CUSTOMER_CODE;
  const customerNumber = process.env.POSTNL_CUSTOMER_NUMBER;
  if (!apiKey || !customerCode || !customerNumber) return null;
  return {
    apiKey,
    customerCode,
    customerNumber,
    collectionLocation: process.env.POSTNL_COLLECTION_LOCATION,
  };
}

export function buildPostNLShippingAdapter(): ShippingAdapter {
  const creds = getPostNLCreds();

  if (!creds) {
    return {
      key: "postnl",
      async createLabel(): Promise<{ trackingNumber: string; labelUrl: string }> {
        throw new AdapterNotReadyError("shipping", "postnl");
      },
      async trackShipment(): Promise<{ status: string; deliveredAt?: string }> {
        throw new AdapterNotReadyError("shipping", "postnl");
      },
    };
  }

  return {
    key: "postnl",

    async createLabel(params): Promise<{ trackingNumber: string; labelUrl: string }> {
      const payload = {
        Customer: {
          CustomerCode: creds.customerCode,
          CustomerNumber: creds.customerNumber,
          CollectionLocation: creds.collectionLocation,
        },
        Message: {
          MessageID: params.orderId,
          MessageTimeStamp: new Date().toISOString(),
        },
        Shipments: [{
          Addresses: [{
            AddressType: "01",
            FirstName: "",
            Name: params.receiverName,
            Street: params.receiverAddress,
            Zipcode: params.receiverPostcode,
            City: params.receiverCity,
            Countrycode: params.receiverCountry,
          }],
          Dimension: { Weight: Math.round(params.weight) },
          ProductCodeDelivery: "3085",  // 3085 = standart paket NL
        }],
      };

      const res = await fetch(`${POSTNL_API_BASE}/shipment/v2_2/label`, {
        method: "POST",
        headers: {
          "apikey": creds.apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`PostNL createLabel failed: ${res.status} ${errText}`);
      }
      const data = await res.json() as {
        ResponseShipments?: Array<{ Barcode: string; Labels?: Array<{ Content: string }> }>;
      };
      const shipment = data.ResponseShipments?.[0];
      if (!shipment?.Barcode) {
        throw new Error("PostNL response missing barcode");
      }
      const trackingNumber = shipment.Barcode;
      const labelContent = shipment.Labels?.[0]?.Content;
      // Label base64; pratikte labelUrl'ya pdf data URL veya kaydedilen S3
      // URL döndürüyoruz. MVP: data URL (kullanıcı tarayıcıda açar).
      const labelUrl = labelContent ? `data:application/pdf;base64,${labelContent}` : "";
      return { trackingNumber, labelUrl };
    },

    async trackShipment(trackingNumber): Promise<{ status: string; deliveredAt?: string }> {
      try {
        const res = await fetch(
          `${POSTNL_API_BASE}/shipment/v2/status/barcode/${trackingNumber}?customercode=${creds.customerCode}&customernumber=${creds.customerNumber}`,
          { headers: { "apikey": creds.apiKey } },
        );
        if (!res.ok) return { status: "unknown" };
        const data = await res.json() as {
          CompleteStatusResponseShipment?: Array<{
            Events?: Array<{ Code: string; Description: string; TimeStamp: string }>;
            Status?: { CurrentPhaseCode: string; CurrentPhaseDescription: string };
          }>;
        };
        const shipment = data.CompleteStatusResponseShipment?.[0];
        const status = shipment?.Status?.CurrentPhaseDescription || "unknown";
        const deliveredEvent = shipment?.Events?.find(e => e.Code === "01");
        return { status, deliveredAt: deliveredEvent?.TimeStamp };
      } catch (err) {
        console.error("[postnl:trackShipment]", err);
        return { status: "unknown" };
      }
    },
  };
}
