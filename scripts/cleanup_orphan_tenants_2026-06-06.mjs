/**
 * Bir kerelik orphan bayi tenant temizliği — 2026-06-06.
 *
 * 2026-06-05'te 3 bayi signup tenant'ı yaratıldı ama profile insert/auth.user
 * adımlarında throw olduğu için rollback satırına ulaşamadı; tenants ortada
 * kaldı (KATMAN B verify outer try/catch gap'i).
 *
 * Bu script audit + Çağrı onayı (KATMAN 1 sonrası) ile çalıştırıldı:
 *   d84d7d1f-eb8b-4e95-9806-114909b513e8
 *   9c064abe-9971-4976-896a-8cfe7ec197ca
 *   b8fcf358-526d-4253-ae44-cd066b0e4580
 *
 * Defense guards (yeniden çalıştırılırsa idempotent):
 *   - Tenant DB'de yoksa atla
 *   - saas_type 'bayi' değilse atla
 *   - tenant_id'ye bağlı profile varsa atla (orphan olmaktan çıkmış)
 *   - FK constraint için bağlı tablo (agent_quotas, command_sessions, vd.)
 *     satırları önce temizlenir
 *
 * Çalıştırma: `node scripts/cleanup_orphan_tenants_2026-06-06.mjs`
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Audit: .planning/TENANT-AUDIT-2026-06-06.md
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const TARGETS = [
  "d84d7d1f-eb8b-4e95-9806-114909b513e8",
  "9c064abe-9971-4976-896a-8cfe7ec197ca",
  "b8fcf358-526d-4253-ae44-cd066b0e4580",
];

const DEPENDENT_TABLES = [
  "agent_quotas",
  "command_sessions",
  "invite_codes",
  "magic_link_tokens",
  "magic_links",
  "audit_log",
];

for (const tid of TARGETS) {
  const { data: t } = await sb
    .from("tenants")
    .select("id, saas_type, slug, name")
    .eq("id", tid)
    .maybeSingle();
  if (!t) {
    console.log(`SKIP ${tid} — not found`);
    continue;
  }
  if (t.saas_type !== "bayi") {
    console.log(`SKIP ${tid} — not bayi (${t.saas_type})`);
    continue;
  }
  const { count: pc } = await sb
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid);
  if ((pc ?? 0) > 0) {
    console.log(`SKIP ${tid} — has ${pc} profile(s)`);
    continue;
  }

  for (const tbl of DEPENDENT_TABLES) {
    const { count, error: cntErr } = await sb
      .from(tbl)
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tid);
    if (cntErr) continue;
    if ((count ?? 0) > 0) {
      const { error: delErr } = await sb.from(tbl).delete().eq("tenant_id", tid);
      if (delErr) {
        console.log(`  WARN ${tbl} delete error:`, delErr.message);
      } else {
        console.log(`  cleaned ${count} rows from ${tbl}`);
      }
    }
  }

  const { error: delErr } = await sb.from("tenants").delete().eq("id", tid);
  if (delErr) {
    console.error(`FAIL ${tid}`, delErr);
  } else {
    console.log(`DELETED ${tid} (${t.slug} — ${t.name})`);
  }
}

const { count: remaining } = await sb
  .from("tenants")
  .select("id", { count: "exact", head: true });
console.log(`\nremaining tenants: ${remaining}`);
