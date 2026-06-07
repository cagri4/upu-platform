/**
 * (admin) route group — auth gate.
 *
 * Platform admin (UPU Dev sahibi) = role='admin' AND tenant_id IS NULL.
 * Tenant sahipleri de role='admin' ama tenant_id'leri set; onlar bu
 * route group'a giremez. Aksi halde /<locale>/giris'e yönlendirilir.
 *
 * Cookie session öncelikli (panel navigasyonunda token URL'de olmaz).
 * requireAdminUser ile aynı mantık ama server layout'ta redirect().
 *
 * Redirect loop yok: /giris bu route group'ta değil.
 */
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAdminSessionFromCookies } from "@/platform/auth/session";
import { getServiceClient } from "@/platform/auth/supabase";

export default async function AdminGroupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const session = await getAdminSessionFromCookies();
  if (!session?.uid) {
    redirect(`/${locale}/giris`);
  }

  const sb = getServiceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", session.uid)
    .maybeSingle();

  // Platform admin = role admin VE tenant'sız. Tenant sahibi de role='admin'
  // ama tenant_id set; bu gate ona kapalı.
  if (profile?.role !== "admin" || profile?.tenant_id !== null) {
    redirect(`/${locale}/giris`);
  }

  return <>{children}</>;
}
