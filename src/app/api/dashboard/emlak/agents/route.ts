import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

const AGENT_META: Record<string, { name: string; icon: string; description: string }> = {
  sekreter: { name: "Sekreter", icon: "👩‍💼", description: "Hatırlatma, sözleşme takibi, günlük planlama" },
  satis:    { name: "Satış Destek", icon: "💼", description: "Müşteri kayıt, eşleştirme, takip" },
  portfoy:  { name: "Portföy Sorumlusu", icon: "📁", description: "Portföy analizi, eksik bilgi, bayat ilan" },
  medya:    { name: "Medya Uzmanı", icon: "📸", description: "Fotoğraf, sunum, sosyal medya" },
  pazar:    { name: "Pazar Analisti", icon: "📊", description: "Piyasa karşılaştırma, fiyat, trend" },
};

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: progression } = await supabase
    .from("user_employee_progress")
    .select("employee_key, xp, tier")
    .eq("user_id", userId)
    .eq("tenant_key", "emlak");

  const progMap = new Map<string, { xp: number; tier: number }>();
  for (const p of progression || []) progMap.set(p.employee_key, { xp: p.xp, tier: p.tier });

  const agents = Object.entries(AGENT_META).map(([key, meta]) => ({
    key,
    ...meta,
    xp: progMap.get(key)?.xp || 0,
    tier: progMap.get(key)?.tier || 0,
  }));

  return NextResponse.json({ agents });
}
