// Faz 5 Depo E2E — production, test identity 31600000001
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env={};for(const l of readFileSync(".env.local","utf-8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,"")}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE="https://retailai.upudev.nl"; let cookie="";
const R=[]; const ok=(n,d="")=>{R.push(1);console.log(`  ✓ ${n}${d?" — "+d:""}`)}; const no=(n,d="")=>{R.push(0);console.log(`  ✗ ${n}${d?" — "+d:""}`)};
async function api(p,o={}){const r=await fetch(BASE+p,{...o,headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{}),...(o.headers||{})}});for(const c of r.headers.getSetCookie?.()||[])if(c.startsWith("upu_session="))cookie=c.split(";")[0];let j=null;try{j=await r.json()}catch{}return{s:r.status,j}}

console.log("Faz 5 Depo E2E\n");
await api("/api/auth/otp/request",{method:"POST",body:JSON.stringify({phone:"31600000001",purpose:"login",locale:"tr"})});
const v=await api("/api/auth/otp/verify",{method:"POST",body:JSON.stringify({phone:"31600000001",code:"112233",purpose:"login",locale:"tr"})});
v.s===200&&cookie?ok("OTP login"):no("OTP login",JSON.stringify(v.j));
const me=await api("/api/bayi/me"); const tenantId=me.j.tenant.id;

// 1) 2 depo oluştur
const w1=await api("/api/dagitici/depo",{method:"POST",body:JSON.stringify({name:"Ana Depo (E2E)",address:"Merkez"})});
const w2=await api("/api/dagitici/depo",{method:"POST",body:JSON.stringify({name:"Şube (E2E)",address:"Şube"})});
w1.j?.id&&w2.j?.id?ok("2 depo oluşturuldu"):no("depo oluştur",JSON.stringify([w1.j,w2.j]));
const anaId=w1.j.id, subeId=w2.j.id;

// 2) 3 ürün — mevcut + 2 yeni; her birine Ana depoya mal kabul ile stok
const list=await api("/api/dagitici/urunler?pageSize=5");
let prods=list.j.items.slice(0,1).map(p=>p.id);
for(const [code,name] of [["E2E-DEPO-A","E2E Depo Ürün A"],["E2E-DEPO-B","E2E Depo Ürün B"]]){
  const c=await api("/api/dagitici/urunler",{method:"POST",body:JSON.stringify({code:code+"-"+Date.now()%10000,name,base_price:10,low_stock_threshold:20})});
  if(c.j?.id)prods.push(c.j.id);
}
prods.length>=3?ok("3 ürün hazır",prods.length+" ürün"):no("ürün hazırlık",prods.length);

// mal kabul: her ürün Ana depoya 100
let recvOk=0;
for(const pid of prods.slice(0,3)){
  const r=await api("/api/dagitici/depo/mal-kabul",{method:"POST",body:JSON.stringify({warehouse_id:anaId,product_id:pid,quantity:100,supplier_name:"E2E Tedarikçi"})});
  if(r.j?.success)recvOk++;
}
recvOk===3?ok("mal kabul: 3 ürün × 100 Ana depoya"):no("mal kabul",recvOk+"/3");

// 3) transfer Ana→Şube 50 (ilk ürün)
const tr=await api("/api/dagitici/depo/transfer",{method:"POST",body:JSON.stringify({from_warehouse_id:anaId,to_warehouse_id:subeId,product_id:prods[0],quantity:50,reason:"E2E denge"})});
tr.j?.success?ok("transfer Ana→Şube 50"):no("transfer",JSON.stringify(tr.j));
// doğrula: Ana=50, Şube=50
const {data:s1}=await sb.from("bayi_warehouse_stock").select("quantity").eq("warehouse_id",anaId).eq("product_id",prods[0]).maybeSingle();
const {data:s2}=await sb.from("bayi_warehouse_stock").select("quantity").eq("warehouse_id",subeId).eq("product_id",prods[0]).maybeSingle();
(Number(s1?.quantity)===50&&Number(s2?.quantity)===50)?ok("transfer sonrası stok",`Ana=${s1?.quantity} Şube=${s2?.quantity}`):no("transfer stok",`Ana=${s1?.quantity} Şube=${s2?.quantity}`);

// 4) sayım Ana depo → 1 ürün farkı
const ses=await api("/api/dagitici/depo/sayim",{method:"POST",body:JSON.stringify({warehouse_id:anaId,title:"E2E Sayım"})});
ses.j?.id?ok("sayım oturumu",`${ses.j.itemCount} ürün snapshot`):no("sayım oluştur",JSON.stringify(ses.j));
const sid=ses.j.id;
// prods[1] sistemde 100, sayılan 90 (10 eksik)
await api(`/api/dagitici/depo/sayim/${sid}`,{method:"PUT",body:JSON.stringify({items:[{product_id:prods[1],counted_qty:90}]})});
const kapat=await api(`/api/dagitici/depo/sayim/${sid}/kapat`,{method:"POST"});
kapat.j?.success?ok("sayım kapandı",`${kapat.j.corrections} düzeltme`):no("sayım kapat",JSON.stringify(kapat.j));
const {data:s3}=await sb.from("bayi_warehouse_stock").select("quantity").eq("warehouse_id",anaId).eq("product_id",prods[1]).maybeSingle();
Number(s3?.quantity)===90?ok("fark düzeltme sonrası stok 90"):no("fark düzeltme",`stok=${s3?.quantity}`);
// audit: stocktake movement var mı
const {data:mv}=await sb.from("bayi_stock_movements").select("id").eq("reference_type","stocktake").eq("reference_id",sid);
(mv?.length>0)?ok("audit: stocktake movement",mv.length+" kayıt"):no("audit movement");

// 5) min altı bildirim: prods[2] Ana'da 100, min=20. Sayımla 5'e düşür (TOPLAM
//    100->5 < 20) -> kritik event. Transfer toplam değiştirmez (total-based).
const startIso=new Date().toISOString();
const ses2=await api("/api/dagitici/depo/sayim",{method:"POST",body:JSON.stringify({warehouse_id:anaId,title:"E2E Kritik Sayim"})});
await api(`/api/dagitici/depo/sayim/${ses2.j.id}`,{method:"PUT",body:JSON.stringify({items:[{product_id:prods[2],counted_qty:5}]})});
await api(`/api/dagitici/depo/sayim/${ses2.j.id}/kapat`,{method:"POST"});
await new Promise(r=>setTimeout(r,1500));
const profileId=(await sb.from("profiles").select("id").eq("whatsapp_phone","31600000001").eq("tenant_id",tenantId).maybeSingle()).data?.id;
const {data:notif}=await sb.from("notifications").select("type,channels_sent,title").eq("user_id",profileId).eq("type","dagitici_kritik_stok").gte("created_at",startIso).order("created_at",{ascending:false}).limit(1);
(notif?.length>0)?ok("kritik stok bildirimi",`"${notif[0].title}" ${JSON.stringify(notif[0].channels_sent)}`):no("kritik stok bildirimi","event yok");

// 6) AI tool: kritik stok raporu
const ai=await api("/api/agent/chat",{method:"POST",body:JSON.stringify({message:"Kritik stoktaki ürünleri listele",role:"yonetici"})});
(ai.s===200 && /kritik|stok/i.test(ai.j?.reply||""))?ok("AI kritik stok tool",`"${(ai.j.reply||"").slice(0,60).replace(/\n/g," ")}"`):no("AI tool",ai.s+" "+JSON.stringify(ai.j).slice(0,80));

const total=R.length, pass=R.reduce((a,b)=>a+b,0);
console.log(`\n${pass}/${total} adım geçti`);
process.exit(pass===total?0:1);
