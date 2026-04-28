"use client";

import { AnchorHTMLAttributes } from "react";
import { useSahibindenDeeplink } from "@/lib/sahibinden-deeplink";

/**
 * `<a>` wrapper — href Sahibinden URL ise Android'de app'e yönlendiren
 * intent:// scheme'e dönüşür, diğer ortamlarda orijinal URL korunur.
 *
 * Kullanım: `<SahibindenLink href={url} target="_blank" className="...">...</SahibindenLink>`
 */
export function SahibindenLink({
  href,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const resolved = useSahibindenDeeplink(href);
  return <a {...rest} href={resolved} />;
}
