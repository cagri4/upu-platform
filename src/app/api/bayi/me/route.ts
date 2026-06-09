/**
 * GET /api/bayi/me — bayi alıcı kullanıcısının kimlik snapshot'ı.
 * Layout açılışında auth doğrulamak için.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, displayName, role } = auth;

  const { data: tenant } = await sb
    .from("tenants")
    .select("name, saas_type")
    .eq("id", tenantId)
    .maybeSingle();

  // Bayi alıcı kullanıcısı ise ilişkilendirilmiş dealer (kendi market'i)
  // varsa onu da çek — Faz 2'de dealer_id eşleştirme magic-link/davet
  // akışında set ediliyor. Yoksa null döner.
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id, name, company_name, segment, region, credit_limit, balance")
    .eq("tenant_id", tenantId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    userId: auth.userId,
    displayName,
    role,
    tenant: {
      id: tenantId,
      name: (tenant?.name as string) || "Bayi",
      saasType: (tenant?.saas_type as string) || "bayi",
    },
    dealer: dealer
      ? {
          id: dealer.id as string,
          name:
            (dealer.company_name as string) ||
            (dealer.name as string) ||
            "Bayi",
          segment: (dealer.segment as string) || null,
          region: (dealer.region as string) || null,
          creditLimit:
            dealer.credit_limit != null ? Number(dealer.credit_limit) : null,
          balance: Number(dealer.balance ?? 0),
        }
      : null,
  });
}
