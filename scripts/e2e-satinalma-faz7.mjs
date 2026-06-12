// Faz 7 Satın Alma E2E — production, dağıtıcı 31600000001
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env={};for(const l of readFileSync(".env.local","utf-8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,"")}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE="https://retailai.upudev.nl"; let cookie="";
const R=[]; const ok=(n,d="")=>{R.push(1);console.log(`  ✓ ${n}${d?" — "+d:""}`)}; const no=(n,d="")=>{R.push(0);console.log(`  ✗ ${n}${d?" — "+d:""}`)};
async function api(p,o={}){const r=await fetch(BASE+p,{...o,headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{}),...(o.headers||{})}});for(const c of r.headers.getSetCookie?.()||[])if(c.startsWith("upu_session="))cookie=c.split(";")[0];let j=null;try{j=await r.json()}catch{}return{s:r.status,j}}

console.log("Faz 7 Satın Alma E2E\n");

// deterministik login
await sb.from("otp_codes").insert({phone:"31600000001",code:"112233",purpose:"login",expires_at:new Date(Date.now()+600000).toISOString()});
const v=await api("/api/auth/otp/verify",{method:"POST",body:JSON.stringify({phone:"31600000001",code:"112233",purpose:"login",locale:"tr"})});
v.s===200&&cookie?ok("dağıtıcı login"):no("login",JSON.stringify(v.j));
const me=await api("/api/bayi/me"); const tenantId=me.j.tenant.id;

// depo hazırla (mevcut default varsa kullan)
const dl=await api("/api/dagitici/depo");
let whId=(dl.j.items||[])[0]?.id;
if(!whId){const w=await api("/api/dagitici/depo",{method:"POST",body:JSON.stringify({name:"E2E SA Depo"})});whId=w.j?.id;}
whId?ok("depo hazır"):no("depo");

// 2 ürün oluştur (PO satırları için)
const prods=[];
for(const[code,name]of[["E2E-SA-A","E2E SA Ürün A"],["E2E-SA-B","E2E SA Ürün B"]]){
  const c=await api("/api/dagitici/urunler",{method:"POST",body:JSON.stringify({code:code+"-"+String(Date.now()).slice(-5),name,base_price:5,low_stock_threshold:10})});
  if(c.j?.id)prods.push(c.j.id);
}
prods.length===2?ok("2 ürün hazır"):no("ürün",prods.length);

// 1) tedarikçi oluştur
const sup=await api("/api/dagitici/satinalma/tedarikci",{method:"POST",body:JSON.stringify({name:"E2E Tedarikçi "+String(Date.now()).slice(-5),tax_no:"1234567890",payment_term_days:30})});
sup.j?.success?ok("tedarikçi oluşturuldu"):no("tedarikçi",JSON.stringify(sup.j));
const supId=sup.j.id;

// 2) PO oluştur (2 ürün × 100 × 5 = 1000)
const po=await api("/api/dagitici/satinalma",{method:"POST",body:JSON.stringify({supplier_id:supId,expected_date:new Date(Date.now()+7*864e5).toISOString().slice(0,10),lines:[{product_id:prods[0],quantity:100,unit_price:5},{product_id:prods[1],quantity:100,unit_price:5}]})});
(po.j?.success&&po.j.total===1000)?ok("PO oluşturuldu",`#${po.j.poNumber} ${po.j.total}₺`):no("PO",JSON.stringify(po.j));
const poId=po.j.id;

// 3) PO durum: taslak → gönderildi
const det0=await api(`/api/dagitici/satinalma/${poId}`);
det0.j?.po?.status==="draft"?ok("PO taslak"):no("PO durum",det0.j?.po?.status);
const send=await api(`/api/dagitici/satinalma/${poId}`,{method:"PATCH",body:JSON.stringify({status:"sent"})});
send.j?.success?ok("PO gönderildi"):no("PO gönder",JSON.stringify(send.j));

// 4) mal kabul: ürün1 100, ürün2 60 → kısmi kabul
const det=await api(`/api/dagitici/satinalma/${poId}`);
const lineA=det.j.lines.find(l=>l.productId===prods[0]);
const lineB=det.j.lines.find(l=>l.productId===prods[1]);
const recv=await api(`/api/dagitici/satinalma/${poId}/mal-kabul`,{method:"POST",body:JSON.stringify({warehouse_id:whId,lines:[{line_id:lineA.id,received_qty:100},{line_id:lineB.id,received_qty:60}]})});
(recv.j?.success&&recv.j.status==="partial")?ok("kısmi mal kabul",`durum=${recv.j.status}`):no("mal kabul",JSON.stringify(recv.j));

// 5) Faz 5 depo stoğunda artış (mal kabul → warehouse_stock)
const{data:s1}=await sb.from("bayi_warehouse_stock").select("quantity").eq("warehouse_id",whId).eq("product_id",prods[0]).maybeSingle();
const{data:s2}=await sb.from("bayi_warehouse_stock").select("quantity").eq("warehouse_id",whId).eq("product_id",prods[1]).maybeSingle();
(Number(s1?.quantity)===100&&Number(s2?.quantity)===60)?ok("depo stoğu arttı",`A=${s1?.quantity} B=${s2?.quantity}`):no("depo stok",`A=${s1?.quantity} B=${s2?.quantity}`);

// 6) cari ekstre: borç 1000, ödeme yok
const car0=await api(`/api/dagitici/satinalma/tedarikci/${supId}`);
(car0.j?.summary?.debt===1000&&car0.j.summary.paid===0&&car0.j.summary.balance===1000)?ok("cari: borç 1000, ödeme yok"):no("cari",JSON.stringify(car0.j?.summary));

// 7) manuel ödeme → mahsup (400 → kalan 600)
const pay=await api(`/api/dagitici/satinalma/tedarikci/${supId}/odeme`,{method:"POST",body:JSON.stringify({amount:400,method:"transfer"})});
pay.j?.success?ok("ödeme kaydı 400"):no("ödeme",JSON.stringify(pay.j));
const car1=await api(`/api/dagitici/satinalma/tedarikci/${supId}`);
(car1.j?.summary?.paid===400&&car1.j.summary.balance===600)?ok("cari mahsup",`ödenen=${car1.j.summary.paid} kalan=${car1.j.summary.balance}`):no("cari mahsup",JSON.stringify(car1.j?.summary));

// 8) gecikmiş PO uyarısı: geçmiş tarihli + gönderilmiş PO
const po2=await api("/api/dagitici/satinalma",{method:"POST",body:JSON.stringify({supplier_id:supId,expected_date:new Date(Date.now()-3*864e5).toISOString().slice(0,10),lines:[{product_id:prods[0],quantity:10,unit_price:5}]})});
await api(`/api/dagitici/satinalma/${po2.j.id}`,{method:"PATCH",body:JSON.stringify({status:"sent"})});
const dash=await api("/api/dagitici/satinalma/dashboard");
const isOverdue=(dash.j?.overduePOs||[]).some(p=>p.id===po2.j.id);
isOverdue?ok("gecikmiş PO uyarısı",`${dash.j.totals.overduePOs} gecikmiş`):no("gecikmiş PO",JSON.stringify(dash.j?.totals));

const total=R.length, pass=R.reduce((a,b)=>a+b,0);
console.log(`\n${pass}/${total} adım geçti`);
process.exit(pass===total?0:1);
