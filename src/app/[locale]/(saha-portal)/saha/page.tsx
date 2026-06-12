"use client";

/**
 * Saha satış elemanı mobil portalı (Faz 6) — /tr/saha.
 *
 * PWA DEĞİL (bayi CLAUDE.md): service worker / manifest / install YOK.
 * Sadece mobile-optimized sayfa + IndexedDB offline check-in kuyruğu
 * (saha-store). Telefon + OTP login (mevcut /api/auth/otp akışı).
 *
 * Akış: login → bugünün ziyaretleri → kart seç → check-in (GPS ops.) →
 * not + sipariş → check-out. Çevrimdışı check-in IndexedDB'ye kuyruklanır,
 * online olunca client_uuid ile idempotent senkronlanır.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { MapPin, LogIn, RefreshCw, WifiOff, Check, ShoppingCart, Navigation, Plus, Minus } from "lucide-react";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";
import { queueCheckIn, listPendingCheckIns, clearSyncedCheckIn } from "@/lib/saha-store";

interface Me { salesRepId: string; repName: string; region: string | null; dealerCount: number; tenantName: string }
interface PlanCard {
  planId: string; dealerId: string; dealerName: string; dealerAddress: string | null;
  plannedTime: string | null; planStatus: string;
  visitId: string | null; visitStatus: string | null;
}
interface Prod { id: string; code: string; name: string; basePrice: number }

type View = "loading" | "login" | "ready";

function genUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export default function SahaPortalPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  if (!isBayiFeatureEnabled("bayi.saha")) notFound();

  const [view, setView] = useState<View>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  // login state
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loginMsg, setLoginMsg] = useState("");

  // visits
  const [cards, setCards] = useState<PlanCard[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [active, setActive] = useState<PlanCard | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  // order mini-form
  const [showOrder, setShowOrder] = useState(false);
  const [prods, setProds] = useState<Prod[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");

  const loadMe = useCallback(async () => {
    const r = await fetch("/api/saha/me", { credentials: "same-origin" }).then((x) => x.json()).catch(() => null);
    if (r?.success) { setMe(r); setView("ready"); return true; }
    setView("login");
    return false;
  }, []);

  const loadVisits = useCallback(async () => {
    const r = await fetch("/api/saha/visits", { credentials: "same-origin" }).then((x) => x.json()).catch(() => null);
    if (r?.success) setCards(r.plans);
    try { setPendingCount((await listPendingCheckIns()).length); } catch { /* */ }
  }, []);

  useEffect(() => {
    (async () => { await loadMe(); })();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [loadMe]);

  useEffect(() => {
    if (view !== "ready") return;
    (async () => { await loadVisits(); })();
  }, [view, loadVisits]);

  // ── Login ──
  const requestOtp = async () => {
    setLoginMsg("Kod gönderiliyor…");
    const r = await fetch("/api/auth/otp/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, purpose: "login", locale }),
    });
    const d = await r.json();
    if (r.ok && d.ok) { setOtpSent(true); setLoginMsg("Kod telefonuna gönderildi."); }
    else setLoginMsg(d.error === "rate_limited" ? "Çok fazla deneme, biraz bekle." : "Kod gönderilemedi (kayıtlı telefon mu?).");
  };
  const verifyOtp = async () => {
    setLoginMsg("Doğrulanıyor…");
    const r = await fetch("/api/auth/otp/verify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code, purpose: "login", locale }),
    });
    const d = await r.json();
    if (r.ok && d.ok) { const ok = await loadMe(); if (!ok) setLoginMsg("Saha elemanı yetkisi yok."); }
    else setLoginMsg(d.error === "invalid_code" ? "Kod hatalı." : "Doğrulama başarısız.");
  };

  // ── Check-in ──
  const getGps = (): Promise<{ lat: number | null; lng: number | null }> =>
    new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({ lat: null, lng: null });
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { timeout: 5000 },
      );
    });

  const checkIn = async (card: PlanCard) => {
    setMsg("Check-in yapılıyor…");
    const gps = await getGps();
    const clientUuid = genUuid();
    const payload = { dealer_id: card.dealerId, plan_id: card.planId, gps_lat: gps.lat ?? undefined, gps_lng: gps.lng ?? undefined, client_uuid: clientUuid };

    if (!navigator.onLine) {
      try {
        await queueCheckIn({ clientUuid, dealerId: card.dealerId, dealerName: card.dealerName, planId: card.planId, note: null, gpsLat: gps.lat, gpsLng: gps.lng });
        setPendingCount((c) => c + 1);
        setMsg("Çevrimdışı — check-in kaydedildi, senkron bekliyor.");
      } catch { setMsg("Çevrimdışı kayıt başarısız."); }
      return;
    }
    const r = await fetch("/api/saha/visits", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (r.ok && d.success) { setMsg("Check-in tamam."); await loadVisits(); setActive({ ...card, visitId: d.id, visitStatus: "open" }); }
    else setMsg(d.error || "Check-in başarısız.");
  };

  const syncPending = async () => {
    setMsg("Senkronize ediliyor…");
    let pending;
    try { pending = await listPendingCheckIns(); } catch { setMsg("IndexedDB yok."); return; }
    let done = 0;
    for (const p of pending) {
      const r = await fetch("/api/saha/visits", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealer_id: p.dealerId, plan_id: p.planId ?? undefined, gps_lat: p.gpsLat ?? undefined, gps_lng: p.gpsLng ?? undefined, note: p.note ?? undefined, client_uuid: p.clientUuid }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.success) { try { await clearSyncedCheckIn(p.clientUuid); } catch { /* */ } done++; }
    }
    setPendingCount((await listPendingCheckIns().catch(() => [])).length);
    setMsg(`${done} check-in senkronlandı.`);
    await loadVisits();
  };

  const saveNote = async () => {
    if (!active?.visitId) return;
    await fetch(`/api/saha/visits/${active.visitId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }),
    });
    setMsg("Not kaydedildi.");
  };

  const checkOut = async () => {
    if (!active?.visitId) return;
    await fetch(`/api/saha/visits/${active.visitId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note, check_out: true }),
    });
    setMsg("Ziyaret tamamlandı.");
    setActive(null); setNote(""); setShowOrder(false); setCart({});
    await loadVisits();
  };

  // ── Order ──
  const openOrder = async () => {
    setShowOrder(true);
    const r = await fetch("/api/saha/products", { credentials: "same-origin" }).then((x) => x.json()).catch(() => null);
    if (r?.success) setProds(r.items);
  };
  const searchProd = async (q: string) => {
    setSearch(q);
    const r = await fetch(`/api/saha/products?q=${encodeURIComponent(q)}`, { credentials: "same-origin" }).then((x) => x.json()).catch(() => null);
    if (r?.success) setProds(r.items);
  };
  const setQty = (pid: string, delta: number) => {
    setCart((c) => { const next = { ...c }; const v = (next[pid] || 0) + delta; if (v <= 0) delete next[pid]; else next[pid] = v; return next; });
  };
  const submitOrder = async () => {
    if (!active?.visitId) return;
    const lines = Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }));
    if (lines.length === 0) { setMsg("Sepet boş."); return; }
    setMsg("Sipariş oluşturuluyor…");
    const r = await fetch(`/api/saha/visits/${active.visitId}/order`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines }),
    });
    const d = await r.json();
    if (r.ok && d.success) { setMsg(`Sipariş alındı: #${d.orderNumber} (${d.finalTotal.toLocaleString("tr-TR")} ₺)`); setShowOrder(false); setCart({}); await loadVisits(); }
    else setMsg(d.error || "Sipariş başarısız.");
  };

  // ── Render: loading ──
  if (view === "loading") {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" /></div>;
  }

  // ── Render: login ──
  if (view === "login") {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-5">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600"><MapPin className="h-7 w-7 text-white" /></div>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Saha Satış Girişi</h1>
          <p className="text-sm text-slate-500">Telefon numaranla giriş yap.</p>
        </div>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (+90...)" className="h-12 rounded-xl border border-slate-200 px-4 text-base" inputMode="tel" />
        {otpSent && (
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 haneli kod" className="h-12 rounded-xl border border-slate-200 px-4 text-center text-lg tracking-widest tabular-nums" inputMode="numeric" maxLength={6} />
        )}
        {loginMsg && <p className="text-center text-sm text-slate-600">{loginMsg}</p>}
        {!otpSent ? (
          <button onClick={requestOtp} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700"><LogIn className="h-5 w-5" /> Kod Gönder</button>
        ) : (
          <button onClick={verifyOtp} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700"><Check className="h-5 w-5" /> Giriş Yap</button>
        )}
      </div>
    );
  }

  // ── Render: ready ──
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-5 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Merhaba, {me?.repName}</h1>
          <p className="text-xs text-slate-500">{me?.region || "Saha"} · {me?.tenantName}</p>
        </div>
        {!online && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"><WifiOff className="h-3.5 w-3.5" /> Çevrimdışı</span>}
      </div>

      {pendingCount > 0 && (
        <button onClick={syncPending} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-700">
          <RefreshCw className="h-4 w-4" /> {pendingCount} bekleyen check-in — Senkronize Et
        </button>
      )}

      {msg && <p className="rounded-lg bg-slate-100 px-3 py-2 text-center text-sm text-slate-600">{msg}</p>}

      {/* Aktif ziyaret paneli */}
      {active && (
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
          <div className="text-base font-semibold text-slate-900">{active.dealerName}</div>
          {active.dealerAddress && <div className="text-xs text-slate-500">{active.dealerAddress}</div>}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ziyaret notu…" rows={2} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <div className="mt-2 flex gap-2">
            <button onClick={saveNote} className="h-10 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700">Notu Kaydet</button>
            <button onClick={openOrder} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white"><ShoppingCart className="h-4 w-4" /> Sipariş Al</button>
          </div>
          <button onClick={checkOut} className="mt-2 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-base font-semibold text-white"><Check className="h-5 w-5" /> Check-out (Bitir)</button>

          {showOrder && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <input value={search} onChange={(e) => searchProd(e.target.value)} placeholder="Ürün ara…" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto">
                {prods.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0"><div className="truncate text-sm text-slate-700">{p.name}</div><div className="text-xs text-slate-400">{p.code} · {p.basePrice.toLocaleString("tr-TR")} ₺</div></div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(p.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-6 text-center text-sm tabular-nums">{cart[p.id] || 0}</span>
                      <button onClick={() => setQty(p.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </li>
                ))}
                {prods.length === 0 && <li className="py-3 text-center text-xs text-slate-400">Ürün yok.</li>}
              </ul>
              <button onClick={submitOrder} className="mt-2 h-11 w-full rounded-xl bg-indigo-600 text-sm font-semibold text-white">Siparişi Gönder ({Object.values(cart).reduce((a, b) => a + b, 0)} adet)</button>
            </div>
          )}
        </div>
      )}

      {/* Bugünün ziyaretleri */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase text-slate-400">Bugünün Ziyaretleri ({cards.length})</h2>
        <ul className="flex flex-col gap-2">
          {cards.map((c) => {
            const done = c.visitStatus === "completed";
            const open = c.visitStatus === "open";
            return (
              <li key={c.planId} className={`rounded-2xl border p-4 ${done ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-slate-900">{c.dealerName}</div>
                    <div className="truncate text-xs text-slate-500">{c.dealerAddress || c.dealerName}{c.plannedTime ? ` · ${c.plannedTime}` : ""}</div>
                  </div>
                  {done ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">Tamamlandı</span>
                    : open ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">Açık</span>
                    : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">Planlı</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  {!c.visitId && (
                    <button onClick={() => checkIn(c)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white"><Navigation className="h-4 w-4" /> Check-in</button>
                  )}
                  {open && c.visitId && (
                    <button onClick={() => { setActive({ ...c }); setNote(""); setMsg(""); }} className="h-10 flex-1 rounded-xl bg-indigo-600 text-sm font-semibold text-white">Ziyareti Aç</button>
                  )}
                  {done && <span className="flex h-10 flex-1 items-center justify-center text-sm text-slate-400">Ziyaret tamamlandı</span>}
                </div>
              </li>
            );
          })}
          {cards.length === 0 && <li className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">Bugün için planlı ziyaret yok.</li>}
        </ul>
      </section>
    </div>
  );
}
