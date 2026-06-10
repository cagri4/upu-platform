/**
 * 3 kargo provider'ının ortak mock implementasyonu.
 *
 * Çağrı'dan canlı API key gelene kadar adapter'lar bu factory ile çalışır;
 * provider yapılandırılmamış veya inactive ise sandbox/live yerine mock
 * tracking üretir. UI test edilebilir kalır.
 */
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getIntegrationSetting,
  recordSyncResult,
} from "@/platform/integrations/tenant-settings";
import type {
  CreateShipmentArgs,
  CreateShipmentResult,
  ShipmentProvider,
  TrackStatusResult,
} from "./types";

interface ProviderConfig {
  prefix: string;
  trackUrl: (no: string) => string;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  aras: {
    prefix: "ARS",
    trackUrl: (no) =>
      `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${no}`,
  },
  yurtici: {
    prefix: "YIK",
    trackUrl: (no) =>
      `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${no}`,
  },
  mng: {
    prefix: "MNG",
    trackUrl: (no) => `https://service.mngkargo.com.tr/track/${no}`,
  },
};

function mockTrackingNo(prefix: string): string {
  // 10 haneli numeric — gerçek kargolar 10-14 hane numeric/alphanumeric
  const n = crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 10);
  return `${prefix}${n}`;
}

export function createKargoProvider(
  id: "aras" | "yurtici" | "mng",
  label: string,
): ShipmentProvider {
  const cfg = PROVIDER_CONFIGS[id];

  return {
    id,
    label,

    async createShipment(
      sb: SupabaseClient,
      args: CreateShipmentArgs,
    ): Promise<CreateShipmentResult> {
      const setting = await getIntegrationSetting(sb, args.tenantId, id);

      // Provider aktif değil → mock
      if (!setting || !setting.isActive) {
        const trackingNo = mockTrackingNo(cfg.prefix);
        await recordSyncResult(sb, {
          tenantId: args.tenantId,
          provider: id,
          status: "ok",
        });
        return {
          success: true,
          carrier: id,
          trackingNo,
          trackingUrl: cfg.trackUrl(trackingNo),
          mocked: true,
        };
      }

      // Provider aktif — gerçek API çağrısı yapılacaktı, ama Faz 3'te
      // sandbox/live wire yapılmadı. Çağrı sözleşme + canlı key + API
      // dokümanı verince burası implement edilecek.
      await recordSyncResult(sb, {
        tenantId: args.tenantId,
        provider: id,
        status: "error",
        errorMessage: `${label} canlı wire pending.`,
      });
      return {
        success: false,
        carrier: id,
        trackingNo: null,
        trackingUrl: null,
        mocked: false,
        errorMessage:
          `${label} canlı entegrasyon henüz wire edilmedi. ` +
          `Sözleşme + API key + endpoint dokümanı sonrası aktif edilecek.`,
      };
    },

    async trackStatus(
      sb: SupabaseClient,
      args: { tenantId: string; trackingNo: string },
    ): Promise<TrackStatusResult> {
      const setting = await getIntegrationSetting(sb, args.tenantId, id);
      // Mock: track URL döner, status "unknown" — gerçek query Foriba/iyzico
      // gibi canlı API'de yapılacak
      if (!setting || !setting.isActive) {
        return {
          success: true,
          status: "unknown",
          lastUpdate: null,
          trackingUrl: cfg.trackUrl(args.trackingNo),
        };
      }
      return {
        success: false,
        status: "unknown",
        lastUpdate: null,
        trackingUrl: cfg.trackUrl(args.trackingNo),
        errorMessage: `${label} track API canlı wire pending.`,
      };
    },
  };
}
