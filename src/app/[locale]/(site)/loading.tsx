/**
 * /tr/site/* loading state — Site SaaS route group level.
 *
 * Next.js sayfa geçişlerinde Suspense fallback olarak render. Spinner/
 * kum saati yerine banking skeleton (Çağrı 2026-05-27 onayı).
 */
import { SkeletonPanelShell } from "@/components/banking";

export default function SiteLoading() {
  return <SkeletonPanelShell />;
}
