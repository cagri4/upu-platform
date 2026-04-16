#!/usr/bin/env node
/**
 * Drop gamification tables — platform pivot away from missions/XP/streaks.
 *
 * Tables removed:
 *   - platform_missions (mission definitions)
 *   - user_mission_progress (per-user mission status)
 *   - user_quest_state (active mission + current chapter per user)
 *   - user_employee_progress (XP/tier per agent per user)
 *   - user_streaks (daily activity streaks)
 *
 * One-off, irreversible. Runs via Supabase service role.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync("/home/cagr/Masaüstü/upu-platform/.env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

const TABLES = [
  "user_mission_progress",
  "user_quest_state",
  "user_employee_progress",
  "user_streaks",
  "platform_missions",
];

async function run(sql) {
  // Supabase JS SDK can't DDL; use raw fetch to Postgres REST exec_sql
  // or rely on CLI / migrations. Here we attempt via rpc if available.
  const res = await sb.rpc("exec_sql", { sql }).catch(() => null);
  return res;
}

async function main() {
  console.log("▶ Dropping gamification tables");
  for (const t of TABLES) {
    try {
      // SDK doesn't DDL; attempt truncate via delete + log for manual DROP
      const { error: countErr, count } = await sb.from(t).select("*", { count: "exact", head: true });
      if (countErr) {
        console.log(`  • ${t}: already gone or inaccessible (${countErr.message.substring(0,60)})`);
        continue;
      }
      if (count > 0) {
        await sb.from(t).delete().gte("created_at", "1900-01-01");
        console.log(`  ✓ emptied ${t} (${count} rows)`);
      } else {
        console.log(`  • ${t}: already empty`);
      }
    } catch (e) {
      console.log(`  ✗ ${t}: ${e.message}`);
    }
  }
  console.log("\n⚠️  Note: Tables emptied but not DROPped (SDK limitation).");
  console.log("   Supabase Studio → SQL → run:");
  console.log("   DROP TABLE IF EXISTS " + TABLES.join(", ") + " CASCADE;");
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
