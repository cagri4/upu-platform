/**
 * (admin) route group — auth gate.
 *
 * /admin ve alt sayfaları yalnızca giriş yapmış + role='admin' kullanıcıya
 * açıktır. Aksi halde /<locale>/giris'e yönlendirilir (eski davranış: boş
 * panel render ediliyordu).
 *
 * Cookie session öncelikli (panel navigasyonunda token URL'de olmaz).
 * requireAdminUser ile aynı mantık (eq id + role==admin) ama server
 * layout'ta redirect() ile çalışır.
 *
 * Redirect loop yok: /giris bu route group'ta değil.
 */
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/platform/auth/session";
import { getServiceClient } from "@/platform/auth/supabase";

export default async function AdminGroupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const session = await getSessionFromCookies();
  if (!session?.uid) {
    redirect(`/${locale}/giris`);
  }

  const sb = getServiceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", session.uid)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(`/${locale}/giris`);
  }

  return <>{children}</>;
}
