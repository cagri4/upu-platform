"use client";

/**
 * Dağıtıcı — Saha Elemanı detayı (Faz 6).
 * Atanmış bayiler (düzenle) + ziyaret planı (oluştur/sil) + ziyaret geçmişi.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/admin/v3-shell";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

interface Rep { id: string; name: string; phone: string; region: string | null; hasLogin: boolean; isActive: boolean }
interface Dealer { id: string; name: string; region: string | null }
interface Plan { id: string; dealerId: string; dealerName: string; plannedDate: string; plannedTime: string | null; status: string; note: string | null }
interface Visit { id: string; dealerName: string; status: string; checkInAt: string; checkOutAt: string | null; note: string | null }

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function SahaRepDetailPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";
  if (!isBayiFeatureEnabled("bayi.saha")) notFound();

  const [rep, setRep] = useState<Rep | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [allDealers, setAllDealers] = useState<Dealer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDealers, setEditDealers] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // plan form
  const [planDealer, setPlanDealer] = useState("");
  const [planDate, setPlanDate] = useState(todayStr());
  const [planTime, setPlanTime] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, all] = await Promise.all([
        fetch(`/api/dagitici/saha/${id}`, { credentials: "same-origin" }).then((x) => x.json()),
        fetch("/api/dagitici/bayiler?pageSize=200", { credentials: "same-origin" }).then((x) => x.json()),
      ]);
      if (d.success) {
        setRep(d.rep);
        setDealers(d.dealers);
        setPlans(d.plans);
        setVisits(d.visits);
        setPicked(new Set(d.dealers.map((x: Dealer) => x.id)));
      }
      if (all.items) setAllDealers(all.items.map((x: { id: string; name: string; region?: string }) => ({ id: x.id, name: x.name, region: x.region || null })));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const saveDealers = async () => {
    await fetch(`/api/dagitici/saha/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealer_ids: Array.from(picked) }),
    });
    setEditDealers(false);
    void load();
  };

  const addPlan = async () => {
    if (!planDealer || !planDate) { setMsg("Bayi ve tarih gerekli."); return; }
    const res = await fetch("/api/dagitici/saha/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sales_rep_id: id, dealer_id: planDealer, planned_date: planDate, planned_time: planTime || undefined, note: planNote || undefined }),
    });
    const d = await res.json();
    if (!res.ok || !d.success) { setMsg(d.error || "Plan eklenemedi."); return; }
    setPlanDealer(""); setPlanTime(""); setPlanNote(""); setMsg("");
    void load();
  };

  const delPlan = async (pid: string) => {
    await fetch(`/api/dagitici/saha/plan/${pid}`, { method: "DELETE" });
    void load();
  };

  const togglePick = (did: string) => {
    setPicked((prev) => { const n = new Set(prev); if (n.has(did)) n.delete(did); else n.add(did); return n; });
  };

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" /></div>;
  }
  if (!rep) return <div className="text-sm text-slate-500">Eleman bulunamadı.</div>;

  const statusTone = (s: string): "success" | "warning" | "neutral" => s === "completed" || s === "done" ? "success" : s === "skipped" ? "neutral" : "warning";

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/${locale}/dagitici-panel/saha`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Saha Satış
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100"><MapPin className="h-5 w-5 text-emerald-600" /></div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{rep.name}</h1>
          <p className="text-sm text-slate-500">{rep.region || "Bölge yok"} · {rep.phone} {rep.hasLogin ? "· portal girişi var" : "· giriş yok"}</p>
        </div>
      </div>

      {/* Atanmış bayiler */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Atanmış Bayiler ({dealers.length})</h2>
          <button onClick={() => setEditDealers((v) => !v)} className="text-xs font-medium text-emerald-700 hover:underline">{editDealers ? "Vazgeç" : "Düzenle"}</button>
        </div>
        {editDealers ? (
          <>
            <div className="mt-3 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-slate-100 p-2">
              {allDealers.map((d) => (
                <button key={d.id} onClick={() => togglePick(d.id)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${picked.has(d.id) ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{d.name}</button>
              ))}
            </div>
            <button onClick={saveDealers} className="mt-3 h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">Kaydet ({picked.size})</button>
          </>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dealers.map((d) => <span key={d.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{d.name}</span>)}
            {dealers.length === 0 && <span className="text-xs text-slate-400">Henüz bayi atanmamış.</span>}
          </div>
        )}
      </section>

      {/* Ziyaret planı */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Ziyaret Planı</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <select value={planDealer} onChange={(e) => setPlanDealer(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm">
            <option value="">Bayi seç…</option>
            {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm" />
          <input type="time" value={planTime} onChange={(e) => setPlanTime(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm" />
          <button onClick={addPlan} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"><Plus className="h-4 w-4" /> Ekle</button>
        </div>
        <input value={planNote} onChange={(e) => setPlanNote(e.target.value)} placeholder="Plan notu (opsiyonel)" className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" />
        {msg && <p className="mt-2 text-xs text-rose-600">{msg}</p>}

        <ul className="mt-3 divide-y divide-slate-100">
          {plans.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <StatusBadge tone={statusTone(p.status)}>{p.status === "done" ? "Yapıldı" : p.status === "skipped" ? "Atlandı" : "Planlı"}</StatusBadge>
                <span className="text-sm text-slate-700">{p.dealerName}</span>
                <span className="text-xs text-slate-400">{p.plannedDate}{p.plannedTime ? ` ${p.plannedTime}` : ""}</span>
              </div>
              <button onClick={() => delPlan(p.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
          {plans.length === 0 && <li className="py-3 text-center text-xs text-slate-400">Henüz plan yok.</li>}
        </ul>
      </section>

      {/* Ziyaret geçmişi */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Ziyaret Geçmişi ({visits.length})</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {visits.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <StatusBadge tone={statusTone(v.status)}>{v.status === "completed" ? "Tamamlandı" : "Açık"}</StatusBadge>
                <span className="text-sm text-slate-700">{v.dealerName}</span>
              </div>
              <span className="text-xs text-slate-400">{new Date(v.checkInAt).toLocaleString("tr-TR")}</span>
            </li>
          ))}
          {visits.length === 0 && <li className="py-3 text-center text-xs text-slate-400">Henüz ziyaret yok.</li>}
        </ul>
      </section>
    </div>
  );
}
