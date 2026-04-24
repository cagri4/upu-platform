"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "error";

interface Invoice {
  id: string;
  invoice_no: string;
  amount: number;
  is_paid: boolean;
  due_date: string;
  created_at: string;
  dealer_name: string | null;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

function daysUntil(due: string): number {
  return Math.floor((new Date(due).getTime() - Date.now()) / 86400000);
}

export default function BayiFaturaPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isOwnerView, setIsOwnerView] = useState(false);
  const [canMarkPaid, setCanMarkPaid] = useState(false);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("unpaid");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/bayi-fatura/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setInvoices(d.invoices || []);
        setIsOwnerView(!!d.isOwnerView);
        setCanMarkPaid(!!d.canMarkPaid);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  async function markPaid(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/bayi-fatura/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, invoice_id: id }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "İşaretlenemedi."); return; }
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, is_paid: true } : inv));
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusyId(null);
    }
  }

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div><h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  const visible = invoices.filter(inv => {
    if (filter === "unpaid") return !inv.is_paid;
    if (filter === "paid") return inv.is_paid;
    return true;
  });

  const totalDue = invoices.filter(i => !i.is_paid).reduce((s, i) => s + i.amount, 0);
  const overdue = invoices.filter(i => !i.is_paid && daysUntil(i.due_date) < 0).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">📄</div>
          <h1 className="text-xl font-bold">{isOwnerView ? "Tüm Faturalar" : "Faturalarım"}</h1>
          <p className="text-indigo-100 text-sm mt-1">
            {invoices.length} fatura · Bekleyen: {fmt(totalDue)} ₺ · Gecikmiş: {overdue}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["unpaid", "paid", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`py-2 rounded-lg text-sm font-medium border-2 ${filter === f ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-300"}`}>
              {f === "unpaid" ? "Ödenmedi" : f === "paid" ? "Ödendi" : "Tümü"}
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500">
            {filter === "unpaid" ? "✅ Bekleyen fatura yok!" : "Liste boş."}
          </div>
        )}

        <div className="space-y-3">
          {visible.map(inv => {
            const days = daysUntil(inv.due_date);
            const late = !inv.is_paid && days < 0;
            return (
              <div key={inv.id} className={`bg-white rounded-2xl p-4 shadow-sm ${late ? "border-2 border-red-200" : ""}`}>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <div className="font-bold text-slate-900">#{inv.invoice_no || inv.id.slice(0, 8)}</div>
                    {isOwnerView && inv.dealer_name && (
                      <div className="text-xs text-slate-500 mt-0.5">🏪 {inv.dealer_name}</div>
                    )}
                  </div>
                  {inv.is_paid ? (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 border border-green-300">✅ Ödendi</span>
                  ) : late ? (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 border border-red-300">⚠️ {Math.abs(days)} gün gecikti</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 border border-amber-300">⏳ {days} gün kaldı</span>
                  )}
                </div>

                <div className="text-sm text-slate-700 space-y-1 mb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tutar</span>
                    <span className="font-bold text-lg">{fmt(inv.amount)} ₺</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Vade</span>
                    <span>{new Date(inv.due_date).toLocaleDateString("tr-TR")}</span>
                  </div>
                </div>

                {!inv.is_paid && canMarkPaid && (
                  <button onClick={() => markPaid(inv.id)} disabled={busyId === inv.id}
                    className="w-full py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200 active:scale-95 disabled:opacity-60">
                    {busyId === inv.id ? "Kaydediliyor..." : "✅ Ödendi olarak işaretle"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {error && <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm shadow-lg">⚠️ {error}</div>}

        <div className="mt-8 text-center">
          <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-medium">💬 WhatsApp&apos;a Dön</a>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
