#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envFile = readFileSync(join(__dirname, "..", ".env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const tables = ["bayi_dealers", "bayi_orders", "bayi_dealer_invoices", "bayi_dealer_transactions", "bayi_products"];
for (const t of tables) {
  const { data, error } = await sb.from(t).select("*").limit(1);
  if (error) {
    console.log(`\n${t}: ERROR ${error.message}`);
    continue;
  }
  if (!data?.length) {
    // Boş tablo — empty insert ile cherry-pick
    const { error: e2 } = await sb.from(t).insert({}).select();
    if (e2) {
      console.log(`\n${t}: BOŞ tablo. Empty insert err = "${e2.message}"`);
    }
    continue;
  }
  const cols = Object.keys(data[0]);
  console.log(`\n${t} (${cols.length} kolon):`);
  for (const c of cols) {
    const v = data[0][c];
    const t = v === null ? "null" : Array.isArray(v) ? `array(${v.length})` : typeof v;
    console.log(`  ${c.padEnd(28)} ${t}`);
  }
}
