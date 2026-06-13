// Faz 6/7 güvenlik doğrulama — H-19 (mal kabul race) + H-21 (bayat atama)
// production, dağıtıcı 31600000001 + saha eleman 31600000078
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env={};for(const l of readFileSync(".env.local","utf-8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,"")}
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE="https://retailai.upudev.nl";
const jars={admin:"",rep:""};
const R=[]; const ok=(n,d="")=>{R.push(1);console.log(`  ✓ ${n}${d?" — "+d:""}`)}; const no=(n,d="")=>{R.push(0);console.log(`  ✗ ${n}${d?" — "+d:""}`)};
async function api(p,o={},jar="admin"){const r=await fetch(BASE+p,{...o,headers:{"Content-Type":"application/json",...(jars[jar]?{Cookie:jars[jar]}:{}),...(o.headers||{})}});for(const c of r.headers.getSetCookie?.()||[])if(c.startsWith("upu_session="))jars[jar]=c.split(";")[0];let j=null;try{j=await r.json()}catch{}return{s:r.status,j}}
async function login(phone,jar){await sb.from("otp_codes").insert({phone,code:"112233",purpose:"login",expires_at:new Date(Date.now()+600000).toISOString()});return api("/api/auth/otp/verify",{method:"POST",body:JSON.stringify({phone,code:"112233",purpose:"login",locale:"tr"})},jar);}

console.log("Faz 6/7 Güvenlik Doğrulama\n");
const v=await login("31600000001","admin");
v.s===200&&jars.admin?ok("dağıtıcı login"):no("login",JSON.stringify(v.j));
const me=await api("/api/bayi/me",{},"admin"); const tenantId=me.j.tenant.id;

// ── H-19: mal kabul over-receive race ──
console.log("\n[H-19] Mal kabul eşzamanlı over-receive yarışı");
const dl=await api("/api/dagitici/depo",{},"admin");
let whId=(dl.j.items||[])[0]?.id;
if(!whId){const w=await api("/api/dagitici/depo",{method:"POST",body:JSON.stringify({name:"SEC Depo"})});whId=w.j.id;}
const pc=await api("/api/dagitici/urunler",{method:"POST",body:JSON.stringify({code:"SEC-RACE-"+String(Date.now()).slice(-5),name:"SEC Race Ürün",base_price:5,low_stock_threshold:5})});
const pid=pc.j.id;
const sup=await api("/api/dagitici/satinalma/tedarikci",{method:"POST",body:JSON.stringify({name:"SEC Tedarikçi "+String(Date.now()).slice(-5)})});
const po=await api("/api/dagitici/satinalma",{method:"POST",body:JSON.stringify({supplier_id:sup.j.id,lines:[{product_id:pid,quantity:100,unit_price:5}]})});
await api(`/api/dagitici/satinalma/${po.j.id}`,{method:"PATCH",body:JSON.stringify({status:"sent"})});
const det=await api(`/api/dagitici/satinalma/${po.j.id}`,{},"admin");
const lineId=det.j.lines[0].id;
// baseline stok
const base=(await sb.from("bayi_warehouse_stock").select("quantity").eq("warehouse_id",whId).eq("product_id",pid).maybeSingle()).data;
const before=Number(base?.quantity)||0;
// 10 eşzamanlı mal kabul, her biri 100 (toplam talep 1000, ama PO=100)
const reqs=Array.from({length:10},()=>api(`/api/dagitici/satinalma/${po.j.id}/mal-kabul`,{method:"POST",body:JSON.stringify({warehouse_id:whId,lines:[{line_id:lineId,received_qty:100}]})},"admin"));
await Promise.all(reqs);
await new Promise(r=>setTimeout(r,500));
const after=Number((await sb.from("bayi_warehouse_stock").select("quantity").eq("warehouse_id",whId).eq("product_id",pid).maybeSingle()).data?.quantity)||0;
const delta=after-before;
const lineRow=(await sb.from("bayi_purchase_order_lines").select("received_qty").eq("id",lineId).maybeSingle()).data;
(delta===100)?ok("stok tam +100 arttı (over-receive YOK)",`Δ=${delta} (önce ${before}→${after})`):no("over-receive!",`Δ=${delta} (beklenen 100; düzeltme öncesi 1000 olurdu)`);
(Number(lineRow?.received_qty)===100)?ok("received_qty=100 (≤quantity)"):no("received_qty",`=${lineRow?.received_qty}`);
const poF=await api(`/api/dagitici/satinalma/${po.j.id}`,{},"admin");
poF.j.po.status==="received"?ok("PO durumu received (tutarlı)"):no("PO durum",poF.j.po.status);
// idempotent tekrar: 1 daha gönder → applied 0
const again=await api(`/api/dagitici/satinalma/${po.j.id}/mal-kabul`,{method:"POST",body:JSON.stringify({warehouse_id:whId,lines:[{line_id:lineId,received_qty:100}]})},"admin");
const after2=Number((await sb.from("bayi_warehouse_stock").select("quantity").eq("warehouse_id",whId).eq("product_id",pid).maybeSingle()).data?.quantity)||0;
(after2===after)?ok("idempotent: tekrar mal kabul stok değiştirmedi",`stok=${after2}`):no("idempotent değil",`${after}→${after2}`);

// ── H-21: bayat atama — de-assign sonrası sipariş ──
console.log("\n[H-21] Bayat yetki: atama kaldırıldıktan sonra sipariş");
const REP="31600000078";
const bl=await api("/api/dagitici/bayiler?pageSize=2",{},"admin");
let dealerId=(bl.j.items||[])[0]?.id;
if(!dealerId){const{data:nd}=await sb.from("bayi_dealers").insert({tenant_id:tenantId,name:"SEC Bayi",company_name:"SEC Bayi",phone:"+90555"+String(Date.now()).slice(-7),email:"sec"+Date.now()+"@t.co",segment:"B",is_active:true,status:"active"}).select("id").single();dealerId=nd.id;}
const rep=await api("/api/dagitici/saha",{method:"POST",body:JSON.stringify({name:"SEC Saha",phone:REP,region:"Test",dealer_ids:[dealerId]})},"admin");
const repId=rep.j.id;
const{data:ti}=await sb.from("admin_test_identities").select("id").eq("virtual_phone",REP).maybeSingle();
if(!ti){const{data:ap}=await sb.from("profiles").select("auth_user_id,id").eq("whatsapp_phone","31600000001").eq("tenant_id",tenantId).maybeSingle();await sb.from("admin_test_identities").insert({virtual_phone:REP,display_name:"SEC Saha",target_tenant:"bayi",admin_user_id:ap?.auth_user_id||ap?.id});}
await login(REP,"rep");
// check-in (atama geçerliyken)
const ci=await api("/api/saha/visits",{method:"POST",body:JSON.stringify({dealer_id:dealerId,client_uuid:crypto.randomUUID()})},"rep");
const visitId=ci.j.id;
ci.j?.success?ok("check-in (atama geçerli)"):no("check-in",JSON.stringify(ci.j));
// admin atamayı kaldır (dealer_ids=[])
await api(`/api/dagitici/saha/${repId}`,{method:"PATCH",body:JSON.stringify({dealer_ids:[]})},"admin");
// rep eski ziyaret üzerinden sipariş dener → 403 beklenir
const ord=await api(`/api/saha/visits/${visitId}/order`,{method:"POST",body:JSON.stringify({lines:[{product_id:pid,quantity:1}]})},"rep");
(ord.s===403)?ok("de-assign sonrası sipariş 403 (bayat yetki kapatıldı)",`status=${ord.s}`):no("bayat yetki açık!",`status=${ord.s} ${JSON.stringify(ord.j)}`);
// atamayı geri ver (temizlik) + ziyaret kapat
await api(`/api/dagitici/saha/${repId}`,{method:"PATCH",body:JSON.stringify({dealer_ids:[dealerId]})},"admin");

const total=R.length, pass=R.reduce((a,b)=>a+b,0);
console.log(`\n${pass}/${total} güvenlik kontrolü geçti`);
process.exit(pass===total?0:1);
