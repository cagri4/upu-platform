import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = readFileSync("/home/cagr/Masaüstü/upu-platform/.env.local","utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

// Current DB has m² price instead of total price for arsa listings.
// Fix: total_price = current_price * area (where area exists and price < 100000)

const { data: arsas } = await sb.from("emlak_properties")
  .select("id, price, area, title")
  .eq("type", "arsa")
  .gt("area", 0)
  .gt("price", 0)
  .lt("price", 100000);  // m² prices are under 100k

console.log(`Found ${arsas?.length || 0} arsa listings to fix`);

let fixed = 0;
for (const a of arsas || []) {
  const totalPrice = Math.round(a.price * a.area);
  if (totalPrice > 100000) {  // sanity check
    await sb.from("emlak_properties")
      .update({ price: totalPrice })
      .eq("id", a.id);
    fixed++;
    if (fixed <= 5) {
      console.log(`  ${a.title?.substring(0,40)} | ${a.price} TL/m² × ${a.area} m² = ${totalPrice.toLocaleString('tr-TR')} TL`);
    }
  }
}
console.log(`\n✅ Fixed ${fixed} arsa prices (m²→total)`);
