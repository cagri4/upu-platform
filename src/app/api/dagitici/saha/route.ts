/**
 * GET  /api/dagitici/saha — saha satış elemanı listesi (+atanmış bayi/ziyaret özeti).
 * POST /api/dagitici/saha — yeni saha elemanı oluştur (+portal login provizyon + bayi atama).
 *   body: { name, phone, region?, dealer_ids?: string[] }
 *
 * Eleman oluşturulurken profiles satırı (role='saha') provision edilir ki
 * eleman /tr/saha portalına telefon+OTP ile girebilsin. Telefon başka
 * tenant'a kilitliyse 409.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../_auth";
import { normalizePhoneE164 } from "@/platform/auth/otp";
import { provisionSalesRepLogin } from "@/platform/bayi/saha/provision-rep";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const { data: reps, error } = await sb
    .from("bayi_sales_reps")
    .select("id, name, phone, region, user_id, is_active, created_at")
    .eq("tenant_id", tenantId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[dagitici:saha:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const ids = (reps ?? []).map((r) => r.id as string);
  const dealerCount = new Map<string, number>();
  const visitCount = new Map<string, number>();
  const lastVisit = new Map<string, string>();

  if (ids.length > 0) {
    const { data: assigns } = await sb
      .from("bayi_sales_rep_dealers")
      .select("sales_rep_id")
      .eq("tenant_id", tenantId)
      .in("sales_rep_id", ids);
    for (const a of assigns ?? []) {
      const rid = a.sales_rep_id as string;
      dealerCount.set(rid, (dealerCount.get(rid) ?? 0) + 1);
    }

    const { data: visits } = await sb
      .from("bayi_visits")
      .select("sales_rep_id, check_in_at")
      .eq("tenant_id", tenantId)
      .in("sales_rep_id", ids)
      .order("check_in_at", { ascending: false });
    for (const v of visits ?? []) {
      const rid = v.sales_rep_id as string;
      visitCount.set(rid, (visitCount.get(rid) ?? 0) + 1);
      if (!lastVisit.has(rid)) lastVisit.set(rid, v.check_in_at as string);
    }
  }

  return NextResponse.json({
    success: true,
    items: (reps ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      phone: r.phone as string,
      region: (r.region as string) || null,
      hasLogin: Boolean(r.user_id),
      isActive: Boolean(r.is_active),
      dealerCount: dealerCount.get(r.id as string) ?? 0,
      visitCount: visitCount.get(r.id as string) ?? 0,
      lastVisitAt: lastVisit.get(r.id as string) ?? null,
      createdAt: r.created_at as string,
    })),
  });
}

interface NewRepBody {
  name?: string;
  phone?: string;
  region?: string;
  dealer_ids?: string[];
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as NewRepBody;
  const name = (body.name || "").trim();
  const phone = normalizePhoneE164(body.phone || "");
  const region = body.region?.trim() || null;

  if (!name) {
    return NextResponse.json({ error: "Eleman adı zorunlu." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json(
      { error: "Geçerli telefon gir (ülke kodlu, örn. +90...)." },
      { status: 400 },
    );
  }

  // Portal login provizyonu (profile role='saha'). Telefon başka tenant'a
  // kilitliyse burada dururuz — rep satırı yaratmadan.
  const prov = await provisionSalesRepLogin(sb, { tenantId, phone, name });
  if (!prov.ok) {
    if (prov.error === "phone_taken") {
      return NextResponse.json(
        { error: "Bu telefon başka bir hesaba kayıtlı." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Eleman hesabı oluşturulamadı." }, { status: 500 });
  }

  // Rep satırı: (tenant_id, phone) UNIQUE → mevcut varsa güncelle (idempotent)
  const { data: existingRep } = await sb
    .from("bayi_sales_reps")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("phone", phone)
    .maybeSingle();

  let repId: string;
  if (existingRep) {
    repId = existingRep.id as string;
    await sb
      .from("bayi_sales_reps")
      .update({ name, region, user_id: prov.profileId, is_active: true, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", repId);
  } else {
    const { data: rep, error: insErr } = await sb
      .from("bayi_sales_reps")
      .insert({
        tenant_id: tenantId,
        name,
        phone,
        region,
        user_id: prov.profileId,
        is_active: true,
        created_by: profileId,
      })
      .select("id")
      .single();
    if (insErr || !rep) {
      console.error("[dagitici:saha:create]", insErr);
      return NextResponse.json({ error: "Oluşturulamadı." }, { status: 400 });
    }
    repId = rep.id as string;
  }

  // Atanmış bayiler (whitelist: tenant'a ait dealer id'leri)
  const dealerIds = Array.isArray(body.dealer_ids)
    ? Array.from(new Set(body.dealer_ids.filter((x) => typeof x === "string" && x)))
    : [];
  if (dealerIds.length > 0) {
    const { data: valid } = await sb
      .from("bayi_dealers")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("id", dealerIds);
    const validIds = (valid ?? []).map((d) => d.id as string);
    if (validIds.length > 0) {
      await sb.from("bayi_sales_rep_dealers").upsert(
        validIds.map((dealerId) => ({ tenant_id: tenantId, sales_rep_id: repId, dealer_id: dealerId })),
        { onConflict: "sales_rep_id,dealer_id", ignoreDuplicates: true },
      );
    }
  }

  return NextResponse.json({ success: true, id: repId, loginMode: prov.mode });
}
