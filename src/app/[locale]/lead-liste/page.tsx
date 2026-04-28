"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SahibindenLink } from "@/components/sahibinden-link";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "error";

interface Call {
  status: string;
  note: string | null;
  called_at: string;
}

interface Lead {
  source_id: string;
  source_url: string;
  title: string;
  type: string;
  listing_type: string;
  price: number | null;
  area: number | null;
  rooms: string | null;
  location_neighborhood: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  image_url: string | null;
  listing_date: string | null;
  call: Call | null;
}

const STATUS_META: Record<string, { label: string; emoji: string; color: string }> = {
  called: { label: "Aradım", emoji: "📞", color: "bg-blue-100 text-blue-700 border-blue-300" },
  no_answer: { label: "Cevap yok", emoji: "🔕", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  interested: { label: "İlgilendi", emoji: "👍", color: "bg-green-100 text-green-700 border-green-300" },
  not_interested: { label: "İlgilenmedi", emoji: "👎", color: "bg-slate-100 text-slate-600 border-slate-300" },
  listed: { label: "Portföye aldı", emoji: "🏆", color: "bg-purple-100 text-purple-700 border-purple-300" },
};

export default function LeadListePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/lead-liste/init?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setLeads(d.leads || []);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  async function markAction(sourceId: string, actionStatus: string) {
    setSavingId(sourceId);
    try {
      const res = await fetch(`/api/lead-liste/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, source_id: sourceId, status: actionStatus }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Kaydedilemedi."); return; }
      setLeads(prev => prev.map(l => l.source_id === sourceId
        ? { ...l, call: { status: actionStatus, note: null, called_at: new Date().toISOString() } }
        : l
      ));
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSavingId(null);
    }
  }

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div><h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp'a dön</a>
  </Center>;

  const visible = leads.filter(l => {
    if (filter === "pending") return !l.call;
    if (filter === "done") return !!l.call;
    return true;
  });

  const pendingCount = leads.filter(l => !l.call).length;
  const doneCount = leads.filter(l => !!l.call).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-orange-600 to-red-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">🔥</div>
          <h1 className="text-xl font-bold">Bugünün Lead'leri</h1>
          <p className="text-orange-100 text-sm mt-1">
            {leads.length} sahibi ilan • {pendingCount} aranacak • {doneCount} işaretlenmiş
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["pending", "done", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`py-2 rounded-lg text-sm font-medium border-2 ${filter === f ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-700 border-slate-300"}`}>
              {f === "pending" ? "Aranacak" : f === "done" ? "İşaretli" : "Tümü"}
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500">
            {filter === "pending" ? "✅ Tüm lead'ler işaretlenmiş. Aferin!" : "Liste boş."}
          </div>
        )}

        <div className="space-y-3">
          {visible.map(lead => (
            <LeadCard key={lead.source_id} lead={lead} saving={savingId === lead.source_id} onAction={s => markAction(lead.source_id, s)} />
          ))}
        </div>

        {error && <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm shadow-lg">⚠️ {error}</div>}

        <div className="mt-8 text-center">
          <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-medium">💬 WhatsApp'a Dön</a>
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead, saving, onAction }: { lead: Lead; saving: boolean; onAction: (s: string) => void }) {
  const priceStr = lead.price ? `${new Intl.NumberFormat("tr-TR").format(lead.price)} ₺` : "—";
  const callMeta = lead.call ? STATUS_META[lead.call.status] : null;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex justify-between items-start gap-2 mb-2">
        <h3 className="font-bold text-slate-900 leading-tight flex-1">{lead.title}</h3>
        {callMeta && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${callMeta.color} whitespace-nowrap`}>
            {callMeta.emoji} {callMeta.label}
          </span>
        )}
      </div>

      <div className="text-sm text-slate-600 space-y-1 mb-3">
        <div>📍 {lead.location_neighborhood || "Bodrum"}</div>
        <div className="flex gap-3 flex-wrap">
          {lead.rooms && <span>🏠 {lead.rooms}</span>}
          {lead.area && <span>📐 {lead.area} m²</span>}
          <span className="font-semibold text-slate-900">💰 {priceStr}</span>
        </div>
        {lead.owner_name && <div>👤 {lead.owner_name}</div>}
      </div>

      {lead.owner_phone ? (
        <a href={`tel:${lead.owner_phone.replace(/\s/g, "")}`}
          className="block bg-green-600 text-white py-2.5 rounded-lg text-center font-semibold mb-2 active:scale-95">
          📞 {lead.owner_phone}
        </a>
      ) : (
        <div className="bg-slate-100 text-slate-500 text-sm text-center py-2.5 rounded-lg mb-2">Telefon bulunamadı</div>
      )}

      <SahibindenLink href={lead.source_url} target="_blank" rel="noopener noreferrer"
        className="block text-xs text-blue-600 hover:underline mb-3 truncate">
        🔗 Sahibinden ilanına git
      </SahibindenLink>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onAction("called")} disabled={saving}
          className="py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 active:scale-95 disabled:opacity-50">
          📞 Aradım
        </button>
        <button onClick={() => onAction("no_answer")} disabled={saving}
          className="py-2 rounded-lg text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 active:scale-95 disabled:opacity-50">
          🔕 Cevap yok
        </button>
        <button onClick={() => onAction("interested")} disabled={saving}
          className="py-2 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 active:scale-95 disabled:opacity-50">
          👍 İlgilendi
        </button>
        <button onClick={() => onAction("not_interested")} disabled={saving}
          className="py-2 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 active:scale-95 disabled:opacity-50">
          👎 İlgilenmedi
        </button>
        <button onClick={() => onAction("listed")} disabled={saving}
          className="col-span-2 py-2 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 active:scale-95 disabled:opacity-50">
          🏆 Portföye aldım
        </button>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
