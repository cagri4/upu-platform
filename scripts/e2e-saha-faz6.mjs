// Faz 6 Saha Satış E2E — production, dağıtıcı 31600000001 + saha eleman 31600000077
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env={};for(const l of readFileSync(".env.local","utf-8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,"")}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE="https://retailai.upudev.nl";
const jars={admin:"",rep:""};
const R=[]; const ok=(n,d="")=>{R.push(1);console.log(`  ✓ ${n}${d?" — "+d:""}`)}; const no=(n,d="")=>{R.push(0);console.log(`  ✗ ${n}${d?" — "+d:""}`)};
async function api(p,o={},jar="admin"){const r=await fetch(BASE+p,{...o,headers:{"Content-Type":"application/json",...(jars[jar]?{Cookie:jars[jar]}:{}),...(o.headers||{})}});for(const c of r.headers.getSetCookie?.()||[])if(c.startsWith("upu_session="))jars[jar]=c.split(";")[0];let j=null;try{j=await r.json()}catch{}return{s:r.status,j}}
const REP_PHONE="31600000077";

console.log("Faz 6 Saha Satış E2E\n");

// dağıtıcı login
await api("/api/auth/otp/request",{method:"POST",body:JSON.stringify({phone:"31600000001",purpose:"login",locale:"tr"})},"admin");
const v=await api("/api/auth/otp/verify",{method:"POST",body:JSON.stringify({phone:"31600000001",code:"112233",purpose:"login",locale:"tr"})},"admin");
v.s===200&&jars.admin?ok("dağıtıcı OTP login"):no("dağıtıcı login",JSON.stringify(v.j));
const me=await api("/api/bayi/me",{},"admin"); const tenantId=me.j.tenant.id;
// admin auth id (test identity FK için)
const {data:adminProf}=await sb.from("profiles").select("id,auth_user_id").eq("whatsapp_phone","31600000001").eq("tenant_id",tenantId).maybeSingle();
const adminUserId=adminProf?.auth_user_id||adminProf?.id;

// 2 bayi hazırla (mevcut varsa kullan, yoksa oluştur)
const bl=await api("/api/dagitici/bayiler?pageSize=10",{},"admin");
let dealerIds=(bl.j.items||[]).slice(0,2).map(d=>d.id);
let lastErr="";
while(dealerIds.length<2){
  const c=await api("/api/dagitici/bayiler",{method:"POST",body:JSON.stringify({name:"E2E Saha Bayi "+(dealerIds.length+1),phone:"+90555"+String(Date.now()).slice(-8),segment:"B"})},"admin");
  if(c.j?.id)dealerIds.push(c.j.id); else { lastErr=JSON.stringify(c.j); break; }
}
dealerIds.length>=2?ok("2 bayi hazır",dealerIds.join(",").slice(0,30)):no("bayi hazırlık",dealerIds.length+" "+lastErr);

// 1) saha eleman oluştur (2 bayi atanmış)
const rep=await api("/api/dagitici/saha",{method:"POST",body:JSON.stringify({name:"E2E Saha Elemanı",phone:REP_PHONE,region:"Marmara",dealer_ids:dealerIds})},"admin");
rep.j?.success?ok("saha eleman oluşturuldu",`login=${rep.j.loginMode}`):no("saha eleman",JSON.stringify(rep.j));
const repId=rep.j.id;

// test identity ekle (OTP 112233) — rep telefonu
const {data:ti}=await sb.from("admin_test_identities").select("id").eq("virtual_phone",REP_PHONE).maybeSingle();
if(!ti){const{error:tiErr}=await sb.from("admin_test_identities").insert({virtual_phone:REP_PHONE,display_name:"E2E Saha",target_tenant:"bayi",admin_user_id:adminUserId});if(tiErr)console.log("  (test identity insert hatası:",tiErr.message,")");}
ok("test identity hazır");

// 2) 2 ziyaret planı (bugün)
const today=new Date().toISOString().slice(0,10);
let planOk=0;
for(const did of dealerIds){
  const p=await api("/api/dagitici/saha/plan",{method:"POST",body:JSON.stringify({sales_rep_id:repId,dealer_id:did,planned_date:today,planned_time:"10:00"})},"admin");
  if(p.j?.success)planOk++;
}
planOk===2?ok("2 ziyaret planı (bugün)"):no("ziyaret planı",planOk+"/2");

// 3) saha eleman login (/tr/saha akışı = aynı OTP)
await api("/api/auth/otp/request",{method:"POST",body:JSON.stringify({phone:REP_PHONE,purpose:"login",locale:"tr"})},"rep");
const rv=await api("/api/auth/otp/verify",{method:"POST",body:JSON.stringify({phone:REP_PHONE,code:"112233",purpose:"login",locale:"tr"})},"rep");
rv.s===200&&jars.rep?ok("saha eleman OTP login"):no("saha login",JSON.stringify(rv.j));
const sahaMe=await api("/api/saha/me",{},"rep");
sahaMe.j?.success?ok("saha /me",`${sahaMe.j.repName} · ${sahaMe.j.dealerCount} bayi`):no("saha /me",JSON.stringify(sahaMe.j));

// 4) bugünün ziyaretleri görünür (2 kayıt)
const vis=await api("/api/saha/visits",{},"rep");
(vis.j?.plans?.length===2)?ok("bugünün ziyaretleri",vis.j.plans.length+" kart"):no("bugünün ziyaretleri",JSON.stringify(vis.j?.plans?.length));

// 5) ziyaret 1: check-in → not → sipariş → check-out
const card1=vis.j.plans[0];
const ci=await api("/api/saha/visits",{method:"POST",body:JSON.stringify({dealer_id:card1.dealerId,plan_id:card1.planId,gps_lat:40.99,gps_lng:29.02,client_uuid:"e2e-visit1-"+Date.now()})},"rep");
ci.j?.success?ok("ziyaret 1 check-in"):no("check-in",JSON.stringify(ci.j));
const visit1=ci.j.id;
await api(`/api/saha/visits/${visit1}`,{method:"PATCH",body:JSON.stringify({note:"E2E ziyaret notu"})},"rep");
// ürün seç
const pl=await api("/api/saha/products",{},"rep");
const prod=pl.j?.items?.[0];
let ordNo=null;
if(prod){
  const ord=await api(`/api/saha/visits/${visit1}/order`,{method:"POST",body:JSON.stringify({lines:[{product_id:prod.id,quantity:2}]})},"rep");
  ord.j?.success?ok("ziyaret 1 sipariş",`#${ord.j.orderNumber} ${ord.j.finalTotal}₺`):no("sipariş",JSON.stringify(ord.j));
  ordNo=ord.j?.orderId;
}else no("sipariş","ürün yok");
const co=await api(`/api/saha/visits/${visit1}`,{method:"PATCH",body:JSON.stringify({check_out:true})},"rep");
co.j?.success?ok("ziyaret 1 check-out"):no("check-out",JSON.stringify(co.j));

// 6) ziyaret 2: offline check-in simülasyonu (aynı client_uuid 2× → idempotent)
const card2=vis.j.plans[1];
const cu="e2e-offline-"+Date.now();
const off1=await api("/api/saha/visits",{method:"POST",body:JSON.stringify({dealer_id:card2.dealerId,plan_id:card2.planId,client_uuid:cu})},"rep");
const off2=await api("/api/saha/visits",{method:"POST",body:JSON.stringify({dealer_id:card2.dealerId,plan_id:card2.planId,client_uuid:cu})},"rep");
(off1.j?.success&&off2.j?.success&&off1.j.id===off2.j.id&&off2.j.deduped)?ok("offline check-in idempotent (senkron 2× → tek ziyaret)",off1.j.id.slice(0,8)):no("offline idempotent",JSON.stringify([off1.j,off2.j]));
// canlıda görünür mü
const {data:v2row}=await sb.from("bayi_visits").select("id,status").eq("id",off1.j.id).maybeSingle();
v2row?ok("ziyaret 2 canlıda görünür",`status=${v2row.status}`):no("ziyaret 2 görünmedi");

// 7) dashboard: eleman 2 ziyaret + 1 sipariş
await new Promise(r=>setTimeout(r,800));
const dash=await api("/api/dagitici/saha/dashboard",{},"admin");
const row=(dash.j?.rows||[]).find(r=>r.id===repId);
(row&&row.visits===2&&row.orders===1)?ok("dashboard performans",`ziyaret=${row.visits} sipariş=${row.orders} oran=${row.orderRatio}`):no("dashboard",JSON.stringify(row));

const total=R.length, pass=R.reduce((a,b)=>a+b,0);
console.log(`\n${pass}/${total} adım geçti`);
process.exit(pass===total?0:1);
