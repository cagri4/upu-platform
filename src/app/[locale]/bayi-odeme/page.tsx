"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "saving" | "done" | "error";

interface Dealer { id: string; name: string; balance: number }

const METHODS = [
  { id: "transfer", label: "🏦 Havale/EFT" },
  { id: "cash", label: "💵 Nakit" },
  { id: "card", label: "💳 Kredi kartı" },
  { id: "check", label: "📜 Çek/Senet" },
];

function fmt(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

export default function BayiOdemePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  const [dealerId, setDealerId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transfer");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/bayi-odeme/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setDealers(d.dealers || []);
        setIsOwner(!!d.isOwner);
        if (d.presetDealerId) setDealerId(d.presetDealerId);
        else if (d.dealers.length === 1) setDealerId(d.dealers[0].id);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  async function save() {
    if (!dealerId) { setError("Bayi seçin."); return; }
    const n = Number(amount);
    if (!(n > 0)) { setError("Geçerli tutar girin."); return; }
    setError(""); setStatus("saving");
    try {
      const res = await fetch(`/api/bayi-odeme/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, dealer_id: dealerId, amount: n, method, note: note.trim() || null }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("ready"); setError(d.error || "Kaydedilemedi."); return; }
      setStatus("done");
    } catch {
      setStatus("ready"); setError("Bağlantı hatası.");
    }
  }

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div><h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;
  if (status === "done") return <Center>
    <div className="text-4xl mb-3">✅</div><h1 className="text-xl font-bold mb-2">Ödeme kaydedildi!</h1>
    <p className="text-slate-600 text-sm mb-4">Teyit mesajı WhatsApp&apos;a gitti.</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  const selectedDealer = dealers.find(d => d.id === dealerId);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-green-600 to-emerald-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">💳</div>
          <h1 className="text-xl font-bold">Ödeme Kaydet</h1>
          <p className="text-green-100 text-sm mt-1">
            {isOwner ? "Bayiden gelen ödemeyi kaydet." : "Yaptığın ödemeyi bildir."}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Bayi</label>
            {isOwner ? (
              <select value={dealerId} onChange={e => setDealerId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Bayi seçin...</option>
                {dealers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.balance < 0 ? ` (borç: ${fmt(Math.abs(d.balance))} ₺)` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm font-medium text-slate-800">{selectedDealer?.name || "—"}</div>
            )}
            {selectedDealer && (
              <div className="text-xs text-slate-500 mt-1">
                Mevcut bakiye: <span className={selectedDealer.balance < 0 ? "text-red-600 font-medium" : "text-emerald-700 font-medium"}>{fmt(selectedDealer.balance)} ₺</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tutar (₺)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              min={0.01} step={0.01}
              placeholder="Örn. 5000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-lg font-bold" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Yöntem</label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(m => (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                  className={`py-2 rounded-lg text-sm font-medium border-2 ${method === m.id ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-300"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Not (opsiyonel)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              rows={2} placeholder="Örn. Mart ayı faturası karşılığı"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
        </div>

        <button onClick={save} disabled={status === "saving"}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60 active:scale-95">
          {status === "saving" ? "Kaydediliyor..." : "💳 Ödemeyi Kaydet"}
        </button>

        {error && <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm shadow-lg">⚠️ {error}</div>}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
