/**
 * GET /api/dagitici/kategoriler — kategori ağacı.
 * POST /api/dagitici/kategoriler — yeni kategori (parent_id opsiyonel).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../_auth";

export const dynamic = "force-dynamic";

interface CategoryNode {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  children: CategoryNode[];
}

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const { data: cats, error } = await sb
    .from("bayi_categories")
    .select("id, name, description, parent_id, sort_order, is_active")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[dagitici:kategoriler:list]", error);
    return NextResponse.json({ error: "Liste yüklenemedi." }, { status: 500 });
  }

  // Ürün sayımları — single tenant'ta ürün kategorisini bir kerede say
  const { data: prods } = await sb
    .from("bayi_products")
    .select("category_id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  const counts = new Map<string, number>();
  (prods ?? []).forEach((p) => {
    if (p.category_id) {
      counts.set(p.category_id as string, (counts.get(p.category_id as string) ?? 0) + 1);
    }
  });

  // Ağaç oluştur
  const nodes = new Map<string, CategoryNode>();
  (cats ?? []).forEach((c) => {
    nodes.set(c.id as string, {
      id: c.id as string,
      name: c.name as string,
      description: (c.description as string) || null,
      parentId: (c.parent_id as string) || null,
      sortOrder: Number(c.sort_order ?? 0),
      isActive: Boolean(c.is_active),
      productCount: counts.get(c.id as string) ?? 0,
      children: [],
    });
  });

  const roots: CategoryNode[] = [];
  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return NextResponse.json({ success: true, tree: roots, flat: Array.from(nodes.values()) });
}

interface NewCategoryBody {
  name?: string;
  description?: string;
  parent_id?: string | null;
  sort_order?: number | string;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  const body = (await req.json().catch(() => ({}))) as NewCategoryBody;
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "İsim zorunlu." }, { status: 400 });
  }

  // Parent kategori varsa aynı tenant'a ait mi doğrula (sızıntı önleme)
  if (body.parent_id) {
    const { data: parent } = await sb
      .from("bayi_categories")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", body.parent_id)
      .maybeSingle();
    if (!parent) {
      return NextResponse.json({ error: "Üst kategori bulunamadı." }, { status: 400 });
    }
  }

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    user_id: userId,
    name,
    description: body.description?.trim() || null,
    parent_id: body.parent_id || null,
    sort_order: body.sort_order != null ? Number(body.sort_order) : 0,
    is_active: true,
  };

  const { data, error } = await sb
    .from("bayi_categories")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[dagitici:kategoriler:create]", error);
    return NextResponse.json({ error: "Kategori kaydedilemedi." }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: data!.id });
}
