/**
 * GET /api/bayi-kullanicilar/list — admin-only.
 *
 * Bayi tenant'ı için kullanıcı yönetim sayfasına 4 dataset döner:
 *   - employees: iç tenant çalışanları (role: admin/muhasebe/depocu/satis)
 *   - dealers: dış bayiler (bayi_dealers tablosu, profile-bağlı veya değil)
 *   - pending_user_invites: user_invitations status='pending'
 *   - pending_dealer_invites: dealer_invitations status='pending'
 *
 * Suspend durumu profile.metadata.suspended_at flag'inden okunur (UI badge);
 * gerçek auth blok şu an yok — V2'de profile.is_active kolonu eklenecek.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["admin", "user"]);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; tenant_id: string; role: string | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const me = lookup.profile;
  if (!ADMIN_ROLES.has(me.role || "")) {
    return NextResponse.json({ error: "Bu sayfa için admin yetkisi gerekli." }, { status: 403 });
  }

  const tenantId = lookup.tenantId;

  const [employeesRes, dealersRes, userInvitesRes, dealerInvitesRes] = await Promise.all([
    sb.from("profiles")
      .select("id, display_name, whatsapp_phone, role, capabilities, metadata, created_at")
      .eq("tenant_id", tenantId)
      .in("role", ["admin", "user", "muhasebe", "depocu", "satis", "employee"])
      .order("created_at", { ascending: false }),

    sb.from("bayi_dealers")
      .select("id, name, company_name, phone, contact_name, contact_phone, city, balance, credit_limit, is_active, status, user_id, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500),

    sb.from("user_invitations")
      .select("id, invitee_name, invitee_phone, role, invite_token, status, created_at, expires_at")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),

    sb.from("dealer_invitations")
      .select("id, name, store_name, phone, invite_code, status, created_at, expires_at")
      .eq("distributor_tenant_id", tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    success: true,
    self: { id: me.id, role: me.role },
    employees: (employeesRes.data || []).map(p => {
      const meta = (p.metadata || {}) as Record<string, unknown>;
      return {
        id: p.id,
        displayName: p.display_name,
        phone: p.whatsapp_phone,
        role: p.role,
        capabilities: (p.capabilities as string[] | null) || [],
        suspended: !!meta.suspended_at,
        suspendedAt: (meta.suspended_at as string) || null,
        createdAt: p.created_at,
      };
    }),
    dealers: (dealersRes.data || []).map(d => ({
      id: d.id,
      name: d.name || d.company_name,
      contactName: d.contact_name,
      phone: d.phone || d.contact_phone,
      city: d.city,
      balance: Number(d.balance) || 0,
      creditLimit: Number(d.credit_limit) || 0,
      isActive: d.is_active !== false,
      status: d.status || (d.is_active === false ? "passive" : "active"),
      profileLinked: !!d.user_id,
      createdAt: d.created_at,
    })),
    pendingUserInvites: (userInvitesRes.data || []).map(i => ({
      id: i.id,
      name: i.invitee_name,
      phone: i.invitee_phone,
      role: i.role,
      inviteToken: i.invite_token,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
    })),
    pendingDealerInvites: (dealerInvitesRes.data || []).map(i => ({
      id: i.id,
      name: i.name,
      storeName: i.store_name,
      phone: i.phone,
      inviteCode: i.invite_code,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
    })),
  });
}
