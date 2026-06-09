/**
 * Generic feature-flag helper.
 *
 * Env-based; her flag `NEXT_PUBLIC_FEATURE_<UPPER_SNAKE>` formunda env
 * değişkeni okur (`bayi.cross_sell` → `NEXT_PUBLIC_FEATURE_BAYI_CROSS_SELL`).
 * `NEXT_PUBLIC_` prefix'i Next.js'in client + server bundle'a inline ettiği
 * env'lerdir; client component'lardan da güvenli çağrılır.
 *
 * Default: env yoksa OFF. İleride DB-based override eklemek istersek
 * buraya wrapper konabilir — şu an aşırı tasarım yapma.
 */
export function isFeatureEnabled(flag: string): boolean {
  const envKey = `NEXT_PUBLIC_FEATURE_${flag.toUpperCase().replace(/\./g, "_")}`;
  return process.env[envKey] === "true";
}
