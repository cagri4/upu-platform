"use client";

/**
 * Mobil sayım (Faz 5) — bayi portalında depo personeli için.
 *
 * PWA DEĞİL (bayi CLAUDE.md): service worker / manifest / install YOK.
 * Sadece mobile-optimized sayfa + kamera barkod (html5-qrcode) + IndexedDB
 * taslak kuyruğu (sayım kaybolmaz, online olunca senkronlanır).
 *
 * Akış: açık sayım seç → kamera ile barkod tara (offline item listesinde
 * eşleşir) → adet gir → IndexedDB'ye yaz → "Senkronize Et" ile server'a push.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notFound } from "next/navigation";
import { Camera, CameraOff, RefreshCw, Check, Search, WifiOff } from "lucide-react";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";
import { saveDraft, listDrafts, listUnsynced, clearSynced } from "@/lib/sayim-store";

interface Session { id: string; title: string; warehouse: string }
interface Item {
  productId: string;
  code: string;
  name: string;
  unit: string;
  barcode: string | null;
  expected: number;
  counted: number | null;
}

export default function MobilSayimPage() {
  if (!isBayiFeatureEnabled("bayi.depo")) notFound();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [active, setActive] = useState<Item | null>(null);
  const [qty, setQty] = useState("");
  const [manual, setManual] = useState("");
  const [online, setOnline] = useState(true);
  const [syncMsg, setSyncMsg] = useState("");
  const scannerRef = useRef<unknown>(null);

  // Açık sayımları yükle
  useEffect(() => {
    (async () => {
      const d = await fetch("/api/bayi/sayim", { credentials: "same-origin" }).then((r) => r.json()).catch(() => null);
      if (d?.success) setSessions(d.sessions);
    })();
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Oturum seç → item + IndexedDB taslak
  const loadSession = useCallback(async (id: string) => {
    setLoading(true);
    setActive(null);
    try {
      const d = await fetch(`/api/bayi/sayim/${id}`, { credentials: "same-origin" }).then((r) => r.json());
      if (d.success) {
        setItems(d.items);
        const c: Record<string, number> = {};
        for (const it of d.items as Item[]) if (it.counted != null) c[it.productId] = it.counted;
        // IndexedDB taslakları server üzerine bindir (lokal en güncel)
        try {
          const drafts = await listDrafts(id);
          for (const dr of drafts) c[dr.productId] = dr.countedQty;
        } catch { /* IndexedDB yoksa geç */ }
        setCounts(c);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const selectSession = (id: string) => {
    setSessionId(id);
    if (id) void loadSession(id);
    else setItems([]);
  };

  const stopScan = useCallback(async () => {
    const s = scannerRef.current as { stop?: () => Promise<void>; clear?: () => void } | null;
    if (s?.stop) {
      try { await s.stop(); s.clear?.(); } catch { /* zaten durmuş */ }
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const matchBarcode = useCallback((code: string) => {
    const norm = code.trim();
    const found = items.find((it) => it.barcode && it.barcode === norm) || items.find((it) => it.code === norm);
    if (found) {
      setActive(found);
      setQty(counts[found.productId] != null ? String(counts[found.productId]) : "");
    } else {
      setSyncMsg(`Barkod eşleşmedi: ${norm}`);
      setTimeout(() => setSyncMsg(""), 2500);
    }
  }, [items, counts]);

  const startScan = useCallback(async () => {
    setScanning(true);
    try {
      const mod = await import("html5-qrcode");
      const Html5Qrcode = mod.Html5Qrcode;
      const scanner = new Html5Qrcode("sayim-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 160 } },
        (decoded: string) => {
          matchBarcode(decoded);
          void stopScan();
        },
        () => { /* tek kare okunamadı — sessiz */ },
      );
    } catch (err) {
      console.error("[sayim:scan]", err);
      setSyncMsg("Kamera açılamadı — manuel kod gir.");
      setScanning(false);
    }
  }, [matchBarcode, stopScan]);

  useEffect(() => () => { void stopScan(); }, [stopScan]);

  const saveCount = async () => {
    if (!active) return;
    const n = Math.max(0, Math.floor(Number(qty)));
    if (!Number.isFinite(n)) return;
    setCounts((c) => ({ ...c, [active.productId]: n }));
    try { await saveDraft(sessionId, active.productId, n); } catch { /* IndexedDB yoksa state'te kalır */ }
    setActive(null);
    setQty("");
  };

  const sync = async () => {
    setSyncMsg("Senkronize ediliyor…");
    try {
      let unsynced: { productId: string; countedQty: number }[];
      try {
        unsynced = await listUnsynced(sessionId);
      } catch {
        // IndexedDB yoksa state'ten gönder
        unsynced = Object.entries(counts).map(([productId, countedQty]) => ({ productId, countedQty }));
      }
      if (unsynced.length === 0) {
        setSyncMsg("Senkronlanacak yeni sayım yok.");
        return;
      }
      const res = await fetch(`/api/bayi/sayim/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: unsynced.map((d) => ({ product_id: d.productId, counted_qty: d.countedQty })) }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        try { await clearSynced(sessionId, unsynced.map((u) => u.productId)); } catch { /* */ }
        setSyncMsg(`${d.synced} ürün senkronlandı ✓`);
      } else {
        setSyncMsg(d.error || "Senkronizasyon başarısız.");
      }
    } catch {
      setSyncMsg("Bağlantı yok — sayım lokalde saklandı, sonra dene.");
    }
  };

  const counted = useMemo(() => items.filter((it) => counts[it.productId] != null), [items, counts]);
  const remaining = useMemo(() => items.filter((it) => counts[it.productId] == null), [items, counts]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Mobil Sayım</h1>
        {!online && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            <WifiOff className="h-3.5 w-3.5" /> Çevrimdışı
          </span>
        )}
      </div>

      <select value={sessionId} onChange={(e) => selectSession(e.target.value)} className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-base">
        <option value="">Sayım seç…</option>
        {sessions.map((s) => <option key={s.id} value={s.id}>{s.title} — {s.warehouse}</option>)}
      </select>

      {sessionId && (
        <>
          {/* Tarayıcı */}
          {scanning ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
              <div id="sayim-reader" className="w-full" />
              <button onClick={stopScan} className="flex w-full items-center justify-center gap-1.5 bg-slate-900 py-3 text-sm font-medium text-white">
                <CameraOff className="h-4 w-4" /> Taramayı Durdur
              </button>
            </div>
          ) : (
            <button onClick={startScan} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-base font-semibold text-white hover:bg-indigo-700">
              <Camera className="h-5 w-5" /> Barkod Tara
            </button>
          )}

          {/* Manuel kod */}
          <div className="flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Kod/barkod elle gir" className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-base" />
            <button onClick={() => { matchBarcode(manual); setManual(""); }} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700">
              <Search className="h-4 w-4" /> Bul
            </button>
          </div>

          {syncMsg && <p className="text-center text-sm text-slate-600">{syncMsg}</p>}

          {/* Aktif ürün — adet gir */}
          {active && (
            <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4">
              <div className="text-sm font-semibold text-slate-900">{active.name}</div>
              <div className="text-xs text-slate-500">{active.code} · sistem {active.expected} {active.unit}</div>
              <div className="mt-3 flex gap-2">
                <input autoFocus type="number" inputMode="numeric" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Sayılan adet" className="h-12 flex-1 rounded-xl border border-slate-300 px-3 text-lg tabular-nums" />
                <button onClick={saveCount} className="inline-flex h-12 items-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-base font-semibold text-white">
                  <Check className="h-5 w-5" /> Kaydet
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
            </div>
          ) : (
            <>
              <button onClick={sync} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white text-base font-semibold text-indigo-700 hover:bg-indigo-50">
                <RefreshCw className="h-4 w-4" /> Senkronize Et ({counted.length}/{items.length})
              </button>

              <section>
                <h2 className="mb-1.5 text-xs font-semibold uppercase text-slate-400">Sayılmayan ({remaining.length})</h2>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {remaining.map((it) => (
                    <li key={it.productId} onClick={() => { setActive(it); setQty(""); }} className="flex cursor-pointer items-center justify-between px-3 py-2.5 active:bg-slate-50">
                      <span className="text-sm text-slate-700">{it.name}</span>
                      <span className="text-xs text-slate-400">{it.code}</span>
                    </li>
                  ))}
                  {remaining.length === 0 && <li className="px-3 py-3 text-center text-xs text-emerald-600">Tüm ürünler sayıldı ✓</li>}
                </ul>
              </section>

              <section>
                <h2 className="mb-1.5 text-xs font-semibold uppercase text-slate-400">Son Sayılan ({counted.length})</h2>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {counted.map((it) => {
                    const c = counts[it.productId];
                    const diff = c - it.expected;
                    return (
                      <li key={it.productId} onClick={() => { setActive(it); setQty(String(c)); }} className="flex cursor-pointer items-center justify-between px-3 py-2.5 active:bg-slate-50">
                        <span className="text-sm text-slate-700">{it.name}</span>
                        <span className="flex items-center gap-2 tabular-nums">
                          <span className="font-medium text-slate-900">{c}</span>
                          {diff !== 0 && <span className={`text-xs ${diff > 0 ? "text-emerald-600" : "text-rose-600"}`}>{diff > 0 ? "+" : ""}{diff}</span>}
                        </span>
                      </li>
                    );
                  })}
                  {counted.length === 0 && <li className="px-3 py-3 text-center text-xs text-slate-400">Henüz sayım yok.</li>}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
