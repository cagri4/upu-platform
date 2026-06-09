/**
 * GET /api/dagitici/bayiler/[id]/fiyat-listeleri — bu bayiye atanmış listeler (öncelik sırasında).
 * POST /api/dagitici/bayiler/[id]/fiyat-listeleri — atama ekle/güncelle.
 *   body: { price_list_id, priority }
 * DELETE ?price_list_id=... — atamayı kaldır.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id: dealerId } = await params;

  // Bayi tenant'a ait mi?
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id, name, company_name, segment")
    .eq("tenant_id", tenantId)
    .eq("id", dealerId)
    .maybeSingle();
  if (!dealer) return NextResponse.json({ error: "Bayi bulunamadı." }, { status: 404 });

  const { data, error } = await sb
    .from("bayi_dealer_price_assignments")
    .select(
      "id, price_list_id, priority, created_at, bayi_price_lists(name, description, is_active, valid_from, valid_until, currency)",
    )
    .eq("tenant_id", tenantId)
    .eq("dealer_id", dealerId)
    .order("priority", { ascending: true });

  if (error) {
    console.error("[dagitici:bayi-fiyat:list]", error);
    return NextResponse.json({ error: "Liste yüklenemedi." }, { status: 500 });
  }

  const items = (data ?? []).map((a) => {
    // PostgREST nested select bazen array, bazen tek object döner. Cast
    // sırasında unknown ara aşaması zorunlu.
    const raw = a.bayi_price_lists as unknown;
    const plArr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const pl = (plArr[0] ?? null) as
      | {
          name: string;
          description: string | null;
          is_active: boolean;
          valid_from: string | null;
          valid_until: string | null;
          currency: string;
        }
      | null;
    return {
      id: a.id as string,
      priceListId: a.price_list_id as string,
      priority: Number(a.priority),
      name: pl?.name ?? "—",
      description: pl?.description ?? null,
      isActive: pl ? Boolean(pl.is_active) : false,
      validFrom: pl?.valid_from ?? null,
      validUntil: pl?.valid_until ?? null,
      currency: pl?.currency ?? "TRY",
      createdAt: a.created_at as string,
    };
  });

  return NextResponse.json({
    success: true,
    dealer: {
      id: dealer.id as string,
      name: (dealer.company_name as string) || (dealer.name as string),
      segment: (dealer.segment as string) || null,
    },
    items,
  });
}

interface AssignBody {
  price_list_id?: string;
  priority?: number | string;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id: dealerId } = await params;

  const body = (await req.json().catch(() => ({}))) as AssignBody;
  const priceListId = (body.price_list_id || "").trim();
  if (!priceListId) {
    return NextResponse.json({ error: "price_list_id zorunlu." }, { status: 400 });
  }
  const priority = body.priority != null && body.priority !== "" ? Number(body.priority) : 100;

  // Bayi + liste tenant'a ait mi?
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", dealerId)
    .maybeSingle();
  if (!dealer) return NextResponse.json({ error: "Bayi bulunamadı." }, { status: 404 });

  const { data: list } = await sb
    .from("bayi_price_lists")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", priceListId)
    .maybeSingle();
  if (!list) return NextResponse.json({ error: "Liste bulunamadı." }, { status: 404 });

  const { error } = await sb
    .from("bayi_dealer_price_assignments")
    .upsert(
      {
        tenant_id: tenantId,
        dealer_id: dealerId,
        price_list_id: priceListId,
        priority,
      },
      { onConflict: "dealer_id,price_list_id" },
    );

  if (error) {
    console.error("[dagitici:bayi-fiyat:assign]", error);
    return NextResponse.json({ error: "Atama yapılamadı." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id: dealerId } = await params;

  const url = new URL(req.url);
  const priceListId = url.searchParams.get("price_list_id");
  if (!priceListId) {
    return NextResponse.json({ error: "price_list_id query gerekli." }, { status: 400 });
  }

  const { error } = await sb
    .from("bayi_dealer_price_assignments")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("dealer_id", dealerId)
    .eq("price_list_id", priceListId);

  if (error) {
    console.error("[dagitici:bayi-fiyat:delete]", error);
    return NextResponse.json({ error: "Kaldırılamadı." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
