"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BedDouble, Calendar, Users, Loader2, Check, ChevronLeft } from "lucide-react";

interface AvailRoom {
  id: string;
  name: string;
  room_type: string;
  bed_type: string | null;
  max_occupancy: number;
  nights: number;
  total_price: number;
  avg_per_night: number;
}

interface ByType {
  room_type: string;
  min_price: number;
  count: number;
  sample_room_id: string;
  bed_type: string | null;
  max_occupancy: number;
  nights: number;
}

export default function BookingPage() {
  const params = useParams<{ locale: string; slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const locale = params.locale;

  // Step 1: dates
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guests, setGuests] = useState(2);

  // Step 2: availability
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [byType, setByType] = useState<ByType[]>([]);
  const [allRooms, setAllRooms] = useState<AvailRoom[]>([]);

  // Step 3: guest info
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const selectedRoom = allRooms.find(r => r.id === selectedRoomId) || null;

  const search = async () => {
    setError(null);
    setSearching(true);
    try {
      const url = `/api/public/otel/${slug}/availability?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}`;
      const r = await fetch(url);
      const d = await r.json();
      if (d?.error) {
        setError(d.error);
        setByType([]);
        setAllRooms([]);
      } else {
        setByType(d.by_type || []);
        setAllRooms(d.rooms || []);
      }
      setSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/public/otel/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: selectedRoom.id,
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim(),
          guest_email: guestEmail.trim() || undefined,
          check_in: checkIn,
          check_out: checkOut,
          guests,
          notes: notes.trim() || undefined,
          kvkk_accepted: kvkk,
        }),
      });
      const d = await r.json();
      if (d?.error) {
        setError(d.error);
      } else {
        router.push(`/${locale}/o/${slug}/onay/${d.reservation_id}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href={`/${locale}/o/${slug}`} className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900 mb-4">
          <ChevronLeft className="w-4 h-4" /> Otel ana sayfa
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">Rezervasyon</h1>
        <p className="text-sm text-slate-600 mb-6">Tarihinizi seçin, oda seçin, bilgilerinizi girin.</p>

        {/* Step 1: Date selection */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" /> Tarih ve Kişi Sayısı
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Giriş tarihi</span>
              <input type="date" min={today} value={checkIn} onChange={e => setCheckIn(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Çıkış tarihi</span>
              <input type="date" min={checkIn} value={checkOut} onChange={e => setCheckOut(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Kişi sayısı</span>
            <select value={guests} onChange={e => setGuests(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} kişi</option>)}
            </select>
          </label>
          <button onClick={search} disabled={searching}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Müsait Odaları Göster
          </button>
        </section>

        {/* Step 2: Available rooms */}
        {searched && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-emerald-600" /> Müsait Odalar
            </h2>
            {byType.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Seçilen tarihte müsait oda bulunamadı. Tarihleri değiştirip tekrar deneyin.</p>
            ) : (
              <div className="space-y-2">
                {byType.map(t => {
                  const isSelected = selectedRoom?.room_type === t.room_type;
                  return (
                    <button
                      type="button"
                      key={t.room_type}
                      onClick={() => setSelectedRoomId(t.sample_room_id)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition ${
                        isSelected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900 capitalize">{t.room_type}</div>
                          <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                            <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {t.max_occupancy} kişi</span>
                            {t.bed_type && <span>· {t.bed_type}</span>}
                            <span>· {t.count} müsait</span>
                            <span>· {t.nights} gece</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-slate-900">{t.min_price.toLocaleString("tr-TR")} ₺</div>
                          <div className="text-[10px] text-slate-500">toplam</div>
                        </div>
                      </div>
                      {isSelected && <div className="mt-2 text-xs font-medium text-emerald-700 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Seçildi</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Step 3: Guest info */}
        {selectedRoom && (
          <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Misafir Bilgileri</h2>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Ad Soyad *</span>
              <input type="text" required value={guestName} onChange={e => setGuestName(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Telefon *</span>
                <input type="tel" required value={guestPhone} onChange={e => setGuestPhone(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="+90 5xx xxx xx xx" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">E-posta</span>
                <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Not (opsiyonel)</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Erken giriş, özel tercih..." />
            </label>

            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" required checked={kvkk} onChange={e => setKvkk(e.target.checked)} className="mt-0.5" />
              <span>
                <a href="/tr/kvkk?tenant=otel" target="_blank" className="text-emerald-700 underline">KVKK Aydınlatma Metni</a>&apos;ni okudum ve verilerimin rezervasyon süreci için işlenmesini kabul ediyorum.
              </span>
            </label>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-xs text-slate-500 uppercase">Toplam</div>
                  <div className="text-2xl font-bold text-slate-900">{selectedRoom.total_price.toLocaleString("tr-TR")} ₺</div>
                  <div className="text-xs text-slate-500">{selectedRoom.nights} gece · {selectedRoom.avg_per_night.toLocaleString("tr-TR")} ₺/gece</div>
                </div>
              </div>
              <button type="submit" disabled={submitting || !kvkk}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Rezervasyon Talebi Gönder
              </button>
              <p className="text-[10px] text-slate-500 mt-2 text-center">Rezervasyon talep statüsünde kaydedilir, otel sizi onay için arar.</p>
            </div>
          </form>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
