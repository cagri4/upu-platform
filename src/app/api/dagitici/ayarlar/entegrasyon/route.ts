/**
 * GET /api/dagitici/ayarlar/entegrasyon — provider listesi + her birinin
 *   tenant ayarı (config + redacted secrets + son sync).
 * PUT /api/dagitici/ayarlar/entegrasyon — bir provider için ayarı güncelle.
 *   body: { provider, is_active?, config?, secrets_patch? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";
import {
  INTEGRATION_PROVIDERS,
  getProviderById,
  redactSecrets,
} from "@/platform/integrations/providers";
import {
  listIntegrationSettings,
  upsertIntegrationSetting,
} from "@/platform/integrations/tenant-settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const settings = await listIntegrationSettings(sb, tenantId);
  const settingsByProvider = new Map(settings.map((s) => [s.provider, s]));

  const items = INTEGRATION_PROVIDERS.map((p) => {
    const s = settingsByProvider.get(p.id);
    return {
      provider: p.id,
      category: p.category,
      label: p.label,
      description: p.description,
      docsUrl: p.docsUrl ?? null,
      status: p.status,
      configSchema: p.configSchema,
      secretSchema: p.secretSchema,
      isActive: s?.isActive ?? false,
      isConfigured: !!s,
      config: s?.config ?? {},
      secretsRedacted: s ? redactSecrets(p, s.secrets) : redactSecrets(p, {}),
      lastSyncedAt: s?.lastSyncedAt ?? null,
      lastSyncStatus: s?.lastSyncStatus ?? null,
      lastSyncError: s?.lastSyncError ?? null,
    };
  });

  return NextResponse.json({ success: true, items });
}

interface UpdateBody {
  provider?: string;
  is_active?: boolean;
  config?: Record<string, unknown>;
  /**
   * Sensitive credentials. UI'dan input dolu gelirse yazılır;
   * placeholder bırakılan alanlar boş string → değişiklik yok.
   * Açıkça silmek için null gönder.
   */
  secrets_patch?: Record<string, string | null>;
}

export async function PUT(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const body = (await req.json().catch(() => ({}))) as UpdateBody;
  const providerId = (body.provider || "").trim();
  const provider = getProviderById(providerId);
  if (!provider) {
    return NextResponse.json({ error: "Geçersiz provider." }, { status: 400 });
  }

  // Aktive ederken zorunlu secret'lar boş ise reddet
  if (body.is_active === true) {
    const existing = (await listIntegrationSettings(sb, tenantId)).find(
      (s) => s.provider === providerId,
    );
    const merged: Record<string, unknown> = {
      ...(existing?.secrets || {}),
    };
    if (body.secrets_patch) {
      for (const [k, v] of Object.entries(body.secrets_patch)) {
        if (v === null) delete merged[k];
        else if (v !== "" && v != null) merged[k] = v;
      }
    }
    const missing: string[] = [];
    for (const f of provider.secretSchema) {
      if (f.required && (merged[f.key] == null || merged[f.key] === "")) {
        missing.push(f.label);
      }
    }
    const cfg = { ...(existing?.config || {}), ...(body.config || {}) };
    for (const f of provider.configSchema) {
      if (f.required && (cfg[f.key] == null || cfg[f.key] === "")) {
        missing.push(f.label);
      }
    }
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Eksik alan: ${missing.join(", ")}` },
        { status: 400 },
      );
    }
  }

  const result = await upsertIntegrationSetting(sb, {
    tenantId,
    provider: providerId,
    isActive: body.is_active,
    config: body.config,
    secretsPatch: body.secrets_patch,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Kaydedilemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
