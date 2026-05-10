/**
 * Cookie-aware panel fetch helper.
 * Token varsa ?t= eklenir (legacy WA URL'leri); yoksa cookie session
 * (credentials: same-origin) ile request gider.
 */
export function panelFetch(
  path: string,
  token: string | null | undefined,
  init: RequestInit = {},
): Promise<Response> {
  const sep = path.includes("?") ? "&" : "?";
  const url = token ? `${path}${sep}t=${encodeURIComponent(token)}` : path;
  return fetch(url, { credentials: "same-origin", ...init });
}
