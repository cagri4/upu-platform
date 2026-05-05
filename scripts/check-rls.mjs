import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = readFileSync("/home/cagr/Masaüstü/upu-platform/.env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

// pg_class'tan RLS bilgisi okumak için önce mevcut policy'leri SUPABASE REST'le doğrudan alamayız.
// Onun yerine: emlak_customers'a anon (RLS'li) bir client ile SELECT ata, başarısız olursa RLS aktif.
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const anon = createClient(url, anonKey);

const { data, error, status } = await anon.from("emlak_customers").select("id").limit(1);
console.log("Anon SELECT emlak_customers:");
console.log("  status:", status);
console.log("  error:", error?.message || "none");
console.log("  rows:", data?.length ?? 0);

// Diğer tabloda da test
const { error: e2 } = await anon.from("emlak_properties").select("id").limit(1);
console.log("\nAnon SELECT emlak_properties:");
console.log("  error:", e2?.message || "none");

// Service role ile SELECT — bypass RLS
const { data: srData, error: srErr } = await sb.from("emlak_customers").select("id", { count: "exact", head: true });
console.log("\nService-role SELECT emlak_customers:");
console.log("  error:", srErr?.message || "none");
