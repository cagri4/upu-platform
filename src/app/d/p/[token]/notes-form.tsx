"use client";

import { useState } from "react";

interface NotesFormProps {
  token: string;
  propertyTitles: string[];
  existingNotes?: string | null;
}

export default function NotesForm({ token, propertyTitles, existingNotes }: NotesFormProps) {
  const [notes, setNotes] = useState(existingNotes || "");
  const [reaction, setReaction] = useState<number | null>(null);
  const [interestedProp, setInterestedProp] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [saleStatus, setSaleStatus] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!notes.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/presentations/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          notes: notes.trim(),
          customer_reaction: reaction,
          interested_property: interestedProp || null,
          next_step: nextStep || null,
          sale_status: saleStatus || null,
        }),
      });
      setSaved(true);
    } catch {
      alert("Kaydetme hatasi");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <p className="text-green-600 font-medium text-lg mb-2">✓ Notlar kaydedildi</p>
        <p className="text-sm text-gray-500">Sunum takibi guncellendi.</p>
        <button
          onClick={() => setSaved(false)}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Duzenle
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h3 className="text-lg font-bold text-gray-900 mb-1">Sunum Notlari</h3>
      <p className="text-xs text-gray-400 mb-6">Sunum sonrasi notlarinizi buraya yazin. Sadece siz gorebilirsiniz.</p>

      {/* Customer Reaction */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Musteri Tepkisi</label>
        <div className="flex gap-2">
          {[
            { value: 1, label: "Ilgisiz", emoji: "😐" },
            { value: 2, label: "Biraz Ilgili", emoji: "🤔" },
            { value: 3, label: "Ilgili", emoji: "😊" },
            { value: 4, label: "Cok Ilgili", emoji: "🤩" },
            { value: 5, label: "Almak Istiyor", emoji: "🔥" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setReaction(opt.value)}
              className={`flex-1 py-2 px-1 rounded-lg border text-center transition text-xs ${
                reaction === opt.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
            >
              <span className="text-lg block">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interested Property */}
      {propertyTitles.length > 1 && (
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Hangi Mulku Begendi?</label>
          <select
            value={interestedProp}
            onChange={(e) => setInterestedProp(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">Secin (opsiyonel)</option>
            {propertyTitles.map((t, i) => (
              <option key={i} value={t}>{t}</option>
            ))}
            <option value="hicbiri">Hicbiri</option>
          </select>
        </div>
      )}

      {/* Next Step */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Sonraki Adim</label>
        <div className="flex flex-wrap gap-2">
          {["Ikinci gorusme", "Fiyat teklifi", "Mulk gezisi", "Dusunecek", "Ilgilenmiyor"].map((step) => (
            <button
              key={step}
              onClick={() => setNextStep(step)}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                nextStep === step
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
            >
              {step}
            </button>
          ))}
        </div>
      </div>

      {/* Sale Status */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Satis Durumu</label>
        <div className="flex flex-wrap gap-2">
          {["Devam ediyor", "Teklif verildi", "Satis yapildi", "Kaybedildi"].map((status) => (
            <button
              key={status}
              onClick={() => setSaleStatus(status)}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                saleStatus === status
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Free text notes */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Musteri ne dedi, nasil bir izlenim birakti, ozel istekleri var mi..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !notes.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg text-sm transition"
      >
        {saving ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </div>
  );
}
