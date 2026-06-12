import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env={};for(const l of readFileSync(".env.local","utf-8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,"")}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE="https://retailai.upudev.nl"; let cookie="";
async function api(p,o={}){const r=await fetch(BASE+p,{...o,headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{}),...(o.headers||{})}});for(const c of r.headers.getSetCookie?.()||[])if(c.startsWith("upu_session="))cookie=c.split(";")[0];let j=null;try{j=await r.json()}catch{}return{s:r.status,j}}

// TEK login
await api("/api/auth/otp/request",{method:"POST",body:JSON.stringify({phone:"31600000001",purpose:"login",locale:"tr"})});
const v=await api("/api/auth/otp/verify",{method:"POST",body:JSON.stringify({phone:"31600000001",code:"112233",purpose:"login",locale:"tr"})});
const me=await api("/api/bayi/me"); const tenantA=me.j.tenant.id;
console.log("login:",v.s,"tenantA="+tenantA.slice(0,8));

// === CROSS-TENANT (B = 32f5feda ana bayi tenant) ===
const tenantB=(await sb.from("tenants").select("id").eq("name","Bayi Yönetimi").single()).data.id;
let {data:whB}=await sb.from("bayi_warehouses").select("id").eq("tenant_id",tenantB).limit(1).maybeSingle();
if(!whB){whB=(await sb.from("bayi_warehouses").insert({tenant_id:tenantB,name:"B-depo sec-test",is_active:true}).select("id").single()).data;}
const prodB=(await sb.from("bayi_products").select("id").eq("tenant_id",tenantB).limit(1).maybeSingle()).data?.id;
// A'nın kendi deposu (transfer kaynağı)
const listA=await api("/api/dagitici/depo"); let whA=listA.j.items?.[0]?.id;
if(!whA){whA=(await api("/api/dagitici/depo",{method:"POST",body:JSON.stringify({name:"A-depo sec"})})).j.id;}

console.log("\n[CROSS-TENANT]");
const g=await api("/api/dagitici/depo/"+whB.id); console.log("  B deposu GET:",g.s,g.s===404?"404 ✓":"✗ SIZINTI");
const t=await api("/api/dagitici/depo/transfer",{method:"POST",body:JSON.stringify({from_warehouse_id:whA,to_warehouse_id:whB.id,product_id:prodB,quantity:1})});
console.log("  transfer to_warehouse=B:",t.s,t.s>=400?"reddedildi ✓ ("+(t.j?.error||"").slice(0,30)+")":"✗ KABUL");
const sy=await api("/api/dagitici/depo/sayim",{method:"POST",body:JSON.stringify({warehouse_id:whB.id,title:"x"})});
console.log("  sayım warehouse=B:",sy.s,sy.s>=400?"reddedildi ✓":"✗ KABUL");
// mal-kabul foreign product
const mk=await api("/api/dagitici/depo/mal-kabul",{method:"POST",body:JSON.stringify({warehouse_id:whA,product_id:prodB,quantity:5})});
console.log("  mal-kabul foreign product:",mk.s,mk.s>=400?"reddedildi ✓":"✗ KABUL");

// === RACE CONDITION: concurrent mal-kabul ===
console.log("\n[RACE]");
const pA=(await api("/api/dagitici/urunler",{method:"POST",body:JSON.stringify({code:"RACE-"+Date.now()%100000,name:"Race Ürün",base_price:1})})).j.id;
// 10 paralel +10 mal kabul → atomik ise 100, race ise <100
await Promise.all(Array.from({length:10},()=>api("/api/dagitici/depo/mal-kabul",{method:"POST",body:JSON.stringify({warehouse_id:whA,product_id:pA,quantity:10})})));
await new Promise(r=>setTimeout(r,1000));
const {data:rstock}=await sb.from("bayi_warehouse_stock").select("quantity").eq("tenant_id",tenantA).eq("warehouse_id",whA).eq("product_id",pA).maybeSingle();
const finalQty=Number(rstock?.quantity)||0;
console.log(`  10× paralel +10 → final=${finalQty} (atomik beklenen 100)`, finalQty===100?"✓ TUTARLI":`✗ RACE: ${100-finalQty} kayıp güncelleme`);

// === UPPER BOUND ===
console.log("\n[INPUT BOUNDS]");
const huge=await api("/api/dagitici/depo/mal-kabul",{method:"POST",body:JSON.stringify({warehouse_id:whA,product_id:pA,quantity:9999999999999})});
console.log("  mal-kabul qty=10^13:",huge.s,huge.s>=400?"reddedildi ✓":`✗ KABUL (${JSON.stringify(huge.j).slice(0,60)})`);

// === STOCKTAKE DOUBLE-CLOSE RACE ===
console.log("\n[STOCKTAKE DOUBLE-CLOSE]");
const ses=(await api("/api/dagitici/depo/sayim",{method:"POST",body:JSON.stringify({warehouse_id:whA,title:"DoubleClose"})})).j;
await api(`/api/dagitici/depo/sayim/${ses.id}`,{method:"PUT",body:JSON.stringify({items:[{product_id:pA,counted_qty:5}]})});
const {data:before}=await sb.from("bayi_warehouse_stock").select("quantity").eq("warehouse_id",whA).eq("product_id",pA).maybeSingle();
// iki paralel kapat
const [k1,k2]=await Promise.all([api(`/api/dagitici/depo/sayim/${ses.id}/kapat`,{method:"POST"}),api(`/api/dagitici/depo/sayim/${ses.id}/kapat`,{method:"POST"})]);
await new Promise(r=>setTimeout(r,800));
const {data:mvs}=await sb.from("bayi_stock_movements").select("id").eq("reference_type","stocktake").eq("reference_id",ses.id);
console.log(`  2× paralel kapat → kapat sonuçları [${k1.s},${k2.s}], stocktake movement sayısı=${mvs?.length}`, mvs?.length<=1?"✓ tek düzeltme":`⚠️ ${mvs?.length} düzeltme (çift olabilir)`);

// temizlik
await sb.from("bayi_warehouses").delete().eq("id",whB.id).eq("name","B-depo sec-test");
console.log("\n(test verisi temizlendi)");
