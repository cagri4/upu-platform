import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone, company } = await req.json();
    const supabase = getServiceClient();

    // Resolve tenant from request header (set by middleware)
    const tenantKey = req.headers.get("x-tenant-key") || "emlak";
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("saas_type", tenantKey)
      .single();

    // Create auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone, company },
    });

    if (error) {
      if (error.message.includes("already registered")) {
        return NextResponse.json({ error: "Bu e-posta zaten kayıtlı" }, { status: 400 });
      }
      return NextResponse.json({ error: "Kayıt başarısız" }, { status: 400 });
    }

    // Create profile
    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        tenant_id: tenant?.id || null,
        display_name: name,
        email,
        phone,
        metadata: { company },
      });
    }

    return NextResponse.json({ user: data.user });
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 });
  }
}
