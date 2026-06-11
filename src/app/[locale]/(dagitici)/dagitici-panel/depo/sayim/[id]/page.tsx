"use client";

/**
 * Dağıtıcı — Sayım detay: satır satır sayılan gir + kapat (fark düzeltme).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

interface Item {
  productId: string;
  code: string;
  name: string;
  unit: string;
  expected: number;
  counted: number | null;
  diff: number | null;
}

export default function SayimDetailPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";
  if (!isBayiFeatureEnabled("bayi.depo")) notFound();

  const [title, setTitle] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [status, setStatus] = useState("open");
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dagitici/depo/sayim/${id}`, { credentials: "same-origin" });
      const d = await res.json();
      if (d.success) {
        setTitle(d.session.title);
        setWarehouse(d.session.warehouse);
        setStatus(d.session.status);
        setItems(d.items);
        const c: Record<string, string> = {};
        for (const it of d.items as Item[]) if (it.counted != null) c[it.productId] = String(it.counted);
        setCounts(c);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCounts = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const payload = items.map((it) => ({
        product_id: it.productId,
        counted_qty: counts[it.productId] === undefined || counts[it.productId] === "" ? null : Number(counts[it.productId]),
      }));
      const res = await fetch(`/api/dagitici/depo/sayim/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const d = await res.json();
      setMsg(res.ok && d.success ? { ok: true, text: "Kaydedildi." } : { ok: false, text: d.error || "Kaydedilemedi." });
      if (res.ok) void load();
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (!confirm("Sayım kapatılacak ve farklar stoğa düzeltme olarak işlenecek. Onaylıyor musun?")) return;
    setBusy(true);
    setMsg(null);
    try {
      await saveCountsInternal();
      const res = await fetch(`/api/dagitici/depo/sayim/${id}/kapat`, { method: "POST", credentials: "same-origin" });
      const d = await res.json();
      setMsg(res.ok && d.success ? { ok: true, text: `Sayım kapandı, ${d.corrections} düzeltme uygulandı.` } : { ok: false, text: d.error || "Kapatılamadı." });
      if (res.ok) void load();
    } finally {
      setBusy(false);
    }
  };

  const saveCountsInternal = async () => {
    const payload = items.map((it) => ({
      product_id: it.productId,
      counted_qty: counts[it.productId] === undefined || counts[it.productId] === "" ? null : Number(counts[it.productId]),
    }));
    await fetch(`/api/dagitici/depo/sayim/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload }),
    });
  };

  const diffPreview = useMemo(() => {
    return items.map((it) => {
      const c = counts[it.productId];
      const counted = c === undefined || c === "" ? null : Number(c);
      return { ...it, liveDiff: counted == null ? null : counted - it.expected };
    });
  }, [items, counts]);

  const closed = status !== "open";

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/${locale}/dagitici-panel/depo/sayim`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Sayımlar
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title || "Sayım"}</h1>
        <p className="text-sm text-slate-500">{warehouse} · {closed ? "Kapalı" : "Açık"}</p>
      </div>

      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Ürün</th>
                <th className="px-4 py-2.5 text-right">Sistem</th>
                <th className="px-4 py-2.5 text-right">Sayılan</th>
                <th className="px-4 py-2.5 text-right">Fark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diffPreview.map((it) => (
                <tr key={it.productId}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-900">{it.name}</div>
                    <div className="text-xs text-slate-400">{it.code}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{it.expected}</td>
                  <td className="px-4 py-2.5 text-right">
                    <input
                      type="number"
                      min={0}
                      disabled={closed}
                      value={counts[it.productId] ?? ""}
                      onChange={(e) => setCounts((c) => ({ ...c, [it.productId]: e.target.value }))}
                      className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-right tabular-nums disabled:bg-slate-50"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {it.liveDiff == null ? (
                      <span className="text-slate-300">—</span>
                    ) : it.liveDiff === 0 ? (
                      <span className="text-slate-400">0</span>
                    ) : (
                      <span className={it.liveDiff > 0 ? "text-emerald-600" : "text-rose-600"}>
                        {it.liveDiff > 0 ? "+" : ""}{it.liveDiff}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {diffPreview.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Bu sayımda ürün yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!closed && !loading && (
        <div className="flex gap-2">
          <button onClick={saveCounts} disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Save className="h-4 w-4" /> Kaydet
          </button>
          <button onClick={close} disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Sayımı Kapat + Düzelt
          </button>
        </div>
      )}
    </div>
  );
}
