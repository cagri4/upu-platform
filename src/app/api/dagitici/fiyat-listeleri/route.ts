/**
 * GET /api/dagitici/fiyat-listeleri — başlık listesi (filtre: status, q).
 * POST /api/dagitici/fiyat-listeleri — yeni başlık.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const statusParam = url.searchParams.get("status") || "active";

  let query = sb
    .from("bayi_price_lists")
    .select(
      "id, name, description, valid_from, valid_until, is_active, currency, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (q) query = query.ilike("name", `%${q.replace(/[,()]/g, "")}%`);
  if (statusParam === "active") query = query.eq("is_active", true);
  else if (statusParam === "inactive") query = query.eq("is_active", false);

  const { data, error } = await query;
  if (error) {
    console.error("[dagitici:fiyat-listeleri:list]", error);
    return NextResponse.json({ error: "Liste yüklenemedi." }, { status: 500 });
  }

  // Her liste için item sayısı + atanmış bayi sayısı
  const listIds = (data ?? []).map((l) => l.id as string);
  const itemCounts = new Map<string, number>();
  const assignCounts = new Map<string, number>();

  if (listIds.length > 0) {
    const { data: items } = await sb
      .from("bayi_price_list_items")
      .select("price_list_id")
      .eq("tenant_id", tenantId)
      .in("price_list_id", listIds);
    (items ?? []).forEach((it) => {
      const k = it.price_list_id as string;
      itemCounts.set(k, (itemCounts.get(k) ?? 0) + 1);
    });

    const { data: assigns } = await sb
      .from("bayi_dealer_price_assignments")
      .select("price_list_id")
      .eq("tenant_id", tenantId)
      .in("price_list_id", listIds);
    (assigns ?? []).forEach((a) => {
      const k = a.price_list_id as string;
      assignCounts.set(k, (assignCounts.get(k) ?? 0) + 1);
    });
  }

  const items = (data ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
    description: (l.description as string) || null,
    validFrom: (l.valid_from as string) || null,
    validUntil: (l.valid_until as string) || null,
    isActive: Boolean(l.is_active),
    currency: (l.currency as string) || "TRY",
    itemCount: itemCounts.get(l.id as string) ?? 0,
    assignedDealerCount: assignCounts.get(l.id as string) ?? 0,
    createdAt: l.created_at as string,
    updatedAt: l.updated_at as string,
  }));

  return NextResponse.json({ success: true, items });
}

interface NewListBody {
  name?: string;
  description?: string;
  valid_from?: string;
  valid_until?: string;
  currency?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  const body = (await req.json().catch(() => ({}))) as NewListBody;
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "İsim zorunlu." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    created_by_user_id: userId,
    name,
    description: body.description?.trim() || null,
    valid_from: body.valid_from || null,
    valid_until: body.valid_until || null,
    currency: body.currency?.trim() || "TRY",
    is_active: true,
  };

  const { data, error } = await sb
    .from("bayi_price_lists")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[dagitici:fiyat-listeleri:create]", error);
    return NextResponse.json({ error: "Liste oluşturulamadı." }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: data!.id });
}
