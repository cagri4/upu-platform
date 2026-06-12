/**
 * GET /api/bayi/sayim — açık sayım oturumları (mobil sayım için).
 *
 * Bayi portalında (getBayiAuth — depocu dahil tüm roller) mobil sayım
 * yapacak kullanıcı, tenant'ındaki AÇIK sayım oturumlarını listeler.
 * Sayım oturumları dağıtıcı tarafında açılır; burada sadece okunur +
 * sayım girişi yapılır (depo personeli telefonla).
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const { data, error } = await sb
    .from("bayi_stocktake_sessions")
    .select("id, title, status, warehouse_id, started_at, bayi_warehouses(name)")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .order("started_at", { ascending: false });

  if (error) {
    console.error("[bayi:sayim:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };
  const rows = (data ?? []) as unknown as Array<{
    id: string; title: string; warehouse_id: string; started_at: string; bayi_warehouses: unknown;
  }>;

  return NextResponse.json({
    success: true,
    sessions: rows.map((s) => ({
      id: s.id,
      title: s.title,
      warehouse: (pick(s.bayi_warehouses)?.name as string) || "—",
      startedAt: s.started_at,
    })),
  });
}
