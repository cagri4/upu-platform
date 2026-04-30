"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "saving" | "done" | "error";

interface Group {
  [groupName: string]: { id: string; label: string }[];
}

interface PositionPreset {
  id: string;
  label: string;
  capabilities: string[];
}

interface HotelOption {
  id: string;
  name: string;
  location: string;
}

interface InitResponse {
  ownerName: string;
  groups: Group;
  positions: PositionPreset[];
  hotels: HotelOption[];
}

export default function OtelCalisanDavetPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [init, setInit] = useState<InitResponse | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function applyPositionPreset(positionKey: string) {
    setPosition(positionKey);
    if (!positionKey) {
      setSelected(new Set());
      return;
    }
    const preset = init?.positions.find(p => p.id === positionKey);
    if (preset) {
      setSelected(new Set(preset.capabilities));
    }
  }

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/otel-calisan-davet/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setInit(d);
        // Tek otel varsa otomatik seç
        if (d.hotels && d.hotels.length === 1) setHotelId(d.hotels[0].id);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllInGroup(items: { id: string }[]) {
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = items.every(it => next.has(it.id));
      if (allSelected) {
        for (const it of items) next.delete(it.id);
      } else {
        for (const it of items) next.add(it.id);
      }
      return next;
    });
  }

  async function save() {
    if (!name.trim()) { setError("İsim boş olamaz."); return; }
    if (!phone.trim()) { setError("Telefon boş olamaz."); return; }
    if (selected.size === 0) { setError("En az bir yetki seçin."); return; }
    if (init && init.hotels.length > 1 && !hotelId) {
      setError("Hangi otele atanacağını seçin."); return;
    }
    setError("");
    setStatus("saving");

    try {
      const res = await fetch(`/api/otel-calisan-davet/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          phone: phone.trim(),
          position: position.trim(),
          hotel_id: hotelId || null,
          capabilities: Array.from(selected),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("ready"); setError(d.error || "Kaydedilemedi."); return; }
      setStatus("done");
    } catch {
      setStatus("ready");
      setError("Bağlantı hatası.");
    }
  }

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;

  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-rose-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  if (status === "done") return <Center>
    <div className="text-4xl mb-3">✅</div>
    <h1 className="text-xl font-bold mb-2">Davet gönderildi!</h1>
    <p className="text-slate-600 text-sm mb-4">{name} kişisine kayıt kodu WhatsApp&apos;tan gitti. Çalışan kodu yazınca sisteme girecek.</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-rose-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-rose-600 to-amber-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">🏨</div>
          <h1 className="text-xl font-bold">Çalışan Davet</h1>
          <p className="text-rose-100 text-sm mt-1">
            Yeni çalışanı ekle — hangi işlemleri yapabileceğini sen seç.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">İsim Soyisim *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Örn. Ayşe Demir"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Telefon (WhatsApp) *</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="Örn. 5321234567"
              type="tel"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <p className="text-[11px] text-slate-500 mt-1">Başında 0 veya ülke kodu olsun, boşluk önemli değil.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Pozisyon (rol)</label>
            <select value={position} onChange={e => applyPositionPreset(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Özel — yetkileri sen seç</option>
              {init?.positions.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Pozisyon seçince yetkiler otomatik dolar — istersen aşağıdan ekleyip çıkarabilirsin.
            </p>
          </div>
          {init && init.hotels.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Otel *</label>
              <select value={hotelId} onChange={e => setHotelId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">— Seçin —</option>
                {init.hotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}{h.location ? ` (${h.location})` : ""}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Çalışan sadece seçilen otelde aktif olacak.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-800">Yetkiler</h2>
            <span className="text-xs text-slate-500">{selected.size} seçili</span>
          </div>

          {init && Object.entries(init.groups).map(([groupName, items]) => {
            const allSelected = items.every(it => selected.has(it.id));
            return (
              <div key={groupName} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{groupName}</h3>
                  <button type="button" onClick={() => selectAllInGroup(items)}
                    className="text-[11px] text-rose-700 hover:underline">
                    {allSelected ? "Temizle" : "Tümünü seç"}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {items.map(it => (
                    <label key={it.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${
                        selected.has(it.id)
                          ? "bg-rose-50 border-rose-300"
                          : "bg-white border-slate-200"
                      }`}>
                      <input type="checkbox"
                        checked={selected.has(it.id)}
                        onChange={() => toggle(it.id)}
                        className="w-4 h-4 accent-rose-600" />
                      <span className="flex-1">{it.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={save} disabled={status === "saving"}
          className="w-full bg-rose-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60 active:scale-95">
          {status === "saving" ? "Kaydediliyor..." : "📤 Davet Gönder"}
        </button>

        {error && <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm shadow-lg">⚠️ {error}</div>}

        <div className="mt-6 text-center">
          <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="text-xs text-slate-500 hover:underline">
            WhatsApp&apos;a geri dön
          </a>
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
