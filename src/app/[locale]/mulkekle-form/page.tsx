"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "form" | "saving" | "done" | "error";

const ROOMS_OPTIONS = ["1+0", "1+1", "2+1", "3+1", "3+2", "4+1", "4+2", "5+1", "6+"];
const TYPE_OPTIONS = [
  { id: "daire", label: "Daire" },
  { id: "villa", label: "Villa" },
  { id: "mustakil", label: "Müstakil" },
  { id: "rezidans", label: "Rezidans" },
  { id: "arsa", label: "Arsa" },
  { id: "dukkan", label: "Dükkan" },
  { id: "buro_ofis", label: "Büro/Ofis" },
];
const HEATING_OPTIONS = ["Kombi (Doğalgaz)", "Merkezi", "Yerden Isıtma", "Klima", "Soba", "Yok"];
const PARKING_OPTIONS = ["Açık Otopark", "Kapalı Otopark", "Açık & Kapalı", "Yok"];
const FACADE_OPTIONS = ["Kuzey", "Güney", "Doğu", "Batı"];
const HOUSING_TYPE_OPTIONS = ["Ara Kat", "En Üst Kat", "Dubleks", "Bahçe Dubleksi", "Çatı Dubleksi", "Tripleks"];
const BATHROOM_OPTIONS = ["1", "2", "3", "4+"];
const KITCHEN_OPTIONS = ["Açık (Amerikan)", "Kapalı"];
const DEED_OPTIONS = ["Kat Mülkiyetli", "Kat İrtifaklı", "Hisseli Tapu", "Müstakil Tapulu"];
const USAGE_OPTIONS = ["Boş", "Kiracılı", "Mülk Sahibi"];
const BUILDING_AGE = ["0 (Yeni)", "1", "2", "3", "4", "5-10", "11-15", "16-20", "21+"];
const FLOOR_OPTIONS = ["Bodrum Kat", "Zemin Kat", "1", "2", "3", "4", "5", "6-10", "11+"];
const TOTAL_FLOORS = ["1", "2", "3", "4", "5", "6-10", "11-15", "16-20", "21+"];

export default function MulkEkleFormPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const editId = searchParams.get("id");
  const isEdit = !!editId;

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [listingType, setListingType] = useState("satilik");
  const [type, setType] = useState("daire");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [netArea, setNetArea] = useState("");
  const [rooms, setRooms] = useState("");
  const [floor, setFloor] = useState("");
  const [totalFloors, setTotalFloors] = useState("");
  const [buildingAge, setBuildingAge] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [heating, setHeating] = useState<string[]>([]);
  const [parking, setParking] = useState<string[]>([]);
  const [facade, setFacade] = useState<string[]>([]);
  const [housingType, setHousingType] = useState<string[]>([]);
  const [bathroom, setBathroom] = useState("");
  const [kitchen, setKitchen] = useState("");
  const [elevator, setElevator] = useState<boolean | null>(null);
  const [balcony, setBalcony] = useState<boolean | null>(null);
  const [deedType, setDeedType] = useState("");
  const [usageStatus, setUsageStatus] = useState("");
  const [swap, setSwap] = useState<boolean | null>(null);
  const [description, setDescription] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Link geçersiz.");
      return;
    }

    // Düzenleme modu: mevcut mülkün verilerini yükle
    if (isEdit) {
      fetch(`/api/mulklerim/get?id=${encodeURIComponent(editId!)}&t=${encodeURIComponent(token)}`)
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) { setStatus("error"); setError(data.error || "Mülk yüklenemedi."); return; }
          const p = data.property as Record<string, unknown>;
          setTitle(String(p.title || ""));
          setListingType(String(p.listing_type || "satilik"));
          setType(String(p.type || "daire"));
          setPrice(p.price != null ? String(p.price) : "");
          setArea(p.area != null ? String(p.area) : "");
          setNetArea(p.net_area != null ? String(p.net_area) : "");
          setRooms(String(p.rooms || ""));
          setFloor(String(p.floor || ""));
          setTotalFloors(String(p.total_floors || ""));
          setBuildingAge(String(p.building_age || ""));
          setCity(String(p.location_city || ""));
          setDistrict(String(p.location_district || ""));
          setNeighborhood(String(p.location_neighborhood || ""));
          if (typeof p.heating === "string" && p.heating) setHeating(p.heating.split(",").map(s => s.trim()).filter(Boolean));
          if (typeof p.parking === "string" && p.parking) setParking(p.parking.split(",").map(s => s.trim()).filter(Boolean));
          if (Array.isArray(p.facade)) setFacade(p.facade as string[]);
          if (Array.isArray(p.housing_type)) setHousingType(p.housing_type as string[]);
          setBathroom(String(p.bathroom_count || ""));
          setKitchen(String(p.kitchen_type || ""));
          setElevator(typeof p.elevator === "boolean" ? p.elevator : null);
          setBalcony(typeof p.balcony === "boolean" ? p.balcony : null);
          setDeedType(String(p.deed_type || ""));
          setUsageStatus(String(p.usage_status || ""));
          setSwap(typeof p.swap === "boolean" ? p.swap : null);
          setDescription(String(p.description || ""));
          setPhotoUrls(Array.isArray(data.photo_urls) ? data.photo_urls : []);
          setStatus("form");
        })
        .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
      return;
    }

    fetch(`/api/setup/init?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) { setStatus("error"); setError(data.error || "Link doğrulanamadı."); return; }
        setStatus("form");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token, isEdit, editId]);

  function toggleArr(arr: string[], val: string, set: (x: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  async function handlePhotoInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remaining = 15 - photoUrls.length;
    if (remaining <= 0) { setPhotoError("Maksimum 15 fotoğraf."); return; }
    const toUpload = files.slice(0, remaining);
    setPhotoUploading(true);
    setPhotoError("");
    setPhotoProgress({ done: 0, total: toUpload.length });
    const uploaded: string[] = [];
    try {
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        try {
          const fd = new FormData();
          fd.append("token", token || "");
          fd.append("file", file);
          const res = await fetch("/api/mulkekle/upload-photo", { method: "POST", body: fd });
          const data = await res.json().catch(() => ({ error: "Sunucu cevabı okunamadı." }));
          if (!res.ok) {
            setPhotoError(`Fotoğraf ${i + 1}: ${data.error || `Hata ${res.status}`}`);
            break;
          }
          if (data.url) {
            uploaded.push(data.url);
            setPhotoUrls(prev => [...prev, data.url]);
          }
        } catch (err) {
          setPhotoError(`Fotoğraf ${i + 1}: Bağlantı hatası. ${err instanceof Error ? err.message : ""}`);
          break;
        }
        setPhotoProgress({ done: i + 1, total: toUpload.length });
      }
    } finally {
      setPhotoUploading(false);
      setPhotoProgress(null);
      e.target.value = "";
    }
  }

  function removePhoto(idx: number) {
    setPhotoUrls(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) { setError("Başlık en az 3 karakter."); return; }
    if (!price || Number(price) <= 0) { setError("Geçerli fiyat gerekli."); return; }
    setStatus("saving"); setError("");

    const endpoint = isEdit ? "/api/mulklerim/update" : "/api/mulkekle/save";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          ...(isEdit ? { id: editId } : {}),
          title: title.trim(),
          listing_type: listingType,
          type,
          price: Number(price),
          area: area ? Number(area) : null,
          net_area: netArea ? Number(netArea) : null,
          rooms,
          floor,
          total_floors: totalFloors,
          building_age: buildingAge,
          location_city: city,
          location_district: district,
          location_neighborhood: neighborhood,
          heating: heating.join(", ") || null,
          parking: parking.join(", ") || null,
          facade,
          housing_type: housingType,
          bathroom_count: bathroom,
          kitchen_type: kitchen,
          elevator,
          balcony,
          deed_type: deedType,
          usage_status: usageStatus,
          swap,
          description: description.trim() || null,
          photo_urls: photoUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus("form"); setError(data.error || "Kaydedilemedi."); return; }
      setStatus("done");
    } catch {
      setStatus("form"); setError("Bağlantı hatası. Tekrar deneyin.");
    }
  }

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Link doğrulanıyor...</p></Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp'a dön</a>
  </Center>;
  if (status === "done") return <Center>
    <div className="text-5xl mb-3">{isEdit ? "✅" : "🎉"}</div>
    <h1 className="text-xl font-bold mb-2">{isEdit ? "Mülk güncellendi!" : "Mülk eklendi!"}</h1>
    <p className="text-slate-600 text-sm mb-6">
      {isEdit
        ? "Değişiklikler kaydedildi. Mülklerim sayfasına geri dönebilirsiniz."
        : "Sunum birkaç saniye içinde WhatsApp'ınıza düşecek. WhatsApp'a dönüp bekleyebilirsiniz."}
    </p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}?text=${encodeURIComponent("devam")}`}
      className="block bg-green-600 text-white px-6 py-4 rounded-xl font-semibold text-lg">💬 WhatsApp'a Dön</a>
  </Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">{isEdit ? "✏️" : "🏠"}</div>
          <h1 className="text-xl font-bold">{isEdit ? "Mülkü Düzenle" : "Mülk Ekle"}</h1>
          <p className="text-blue-100 text-sm mt-1">
            {isEdit ? "Bilgileri güncelleyin ve kaydedin." : "Ne kadar bilgi girerseniz AI o kadar iyi sunum yazar."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Section title="📋 Temel Bilgiler">
            <Field label="Başlık *">
              <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Yalıkavak 2+1 Deniz Manzaralı" className={inputCls} />
            </Field>
            <Pills label="İlan Tipi *" value={listingType} options={[{id:"satilik",label:"Satılık"},{id:"kiralik",label:"Kiralık"}]} onPick={setListingType} />
            <Pills label="Mülk Tipi *" value={type} options={TYPE_OPTIONS} onPick={setType} cols={3} />
            <Field label="Fiyat (TL) *">
              <input required type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="4500000" className={inputCls} />
            </Field>
            <Row>
              <Field label="m² Brüt"><input type="number" value={area} onChange={e => setArea(e.target.value)} className={inputCls} /></Field>
              <Field label="m² Net"><input type="number" value={netArea} onChange={e => setNetArea(e.target.value)} className={inputCls} /></Field>
            </Row>
            <Pills label="Oda" value={rooms} options={ROOMS_OPTIONS.map(r => ({id:r,label:r}))} onPick={setRooms} cols={3} />
          </Section>

          <Section title="🏢 Bina">
            <Pills label="Kat" value={floor} options={FLOOR_OPTIONS.map(f => ({id:f,label:f}))} onPick={setFloor} cols={3} />
            <Pills label="Toplam Kat" value={totalFloors} options={TOTAL_FLOORS.map(f => ({id:f,label:f}))} onPick={setTotalFloors} cols={3} />
            <Pills label="Bina Yaşı" value={buildingAge} options={BUILDING_AGE.map(a => ({id:a,label:a}))} onPick={setBuildingAge} cols={3} />
          </Section>

          <Section title="📍 Konum">
            <GeoPicker city={city} district={district} neighborhood={neighborhood}
              onCity={setCity} onDistrict={setDistrict} onNeighborhood={setNeighborhood} />
          </Section>

          <Section title="🔧 Detaylar">
            <MultiPills label="Isıtma (birden fazla)" values={heating} options={HEATING_OPTIONS} onToggle={v => toggleArr(heating, v, setHeating)} cols={2} />
            <MultiPills label="Otopark (birden fazla)" values={parking} options={PARKING_OPTIONS} onToggle={v => toggleArr(parking, v, setParking)} cols={2} />
            <MultiPills label="Cephe (birden fazla)" values={facade} options={FACADE_OPTIONS} onToggle={v => toggleArr(facade, v, setFacade)} cols={4} />
            <MultiPills label="Konut Tipi (birden fazla)" values={housingType} options={HOUSING_TYPE_OPTIONS} onToggle={v => toggleArr(housingType, v, setHousingType)} cols={2} />
            <Pills label="Banyo" value={bathroom} options={BATHROOM_OPTIONS.map(b => ({id:b,label:b}))} onPick={setBathroom} cols={4} />
            <Pills label="Mutfak" value={kitchen} options={KITCHEN_OPTIONS.map(k => ({id:k,label:k}))} onPick={setKitchen} cols={2} />
            <YesNo label="Asansör" value={elevator} onPick={setElevator} />
            <YesNo label="Balkon" value={balcony} onPick={setBalcony} />
            <Pills label="Tapu" value={deedType} options={DEED_OPTIONS.map(d => ({id:d,label:d}))} onPick={setDeedType} cols={2} />
            <Pills label="Kullanım" value={usageStatus} options={USAGE_OPTIONS.map(u => ({id:u,label:u}))} onPick={setUsageStatus} cols={3} />
            <YesNo label="Takas" value={swap} onPick={setSwap} />
          </Section>

          <Section title="📝 Açıklama">
            <Field label="İlan Açıklaması">
              <textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Serbest metin veya boş bırak, AI sonra yazar" className={inputCls} />
            </Field>
          </Section>

          <Section title="📷 Fotoğraflar">
            <div className="space-y-3">
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoInput}
                  disabled={photoUploading || photoUrls.length >= 15}
                  className="hidden"
                />
                <span className={`block w-full text-center py-3 rounded-lg font-medium border-2 border-dashed cursor-pointer ${photoUploading ? "border-amber-400 bg-amber-50 text-amber-800 animate-pulse" : photoUrls.length >= 15 ? "border-slate-300 bg-slate-100 text-slate-400" : "border-indigo-400 bg-indigo-50 text-indigo-700 active:bg-indigo-100"}`}>
                  {photoUploading
                    ? photoProgress
                      ? `⏳ Yükleniyor... ${photoProgress.done}/${photoProgress.total}`
                      : "⏳ Yükleniyor..."
                    : photoUrls.length >= 15
                      ? "Maksimum 15 fotoğraf doldu"
                      : `📷 Fotoğraf Ekle (${photoUrls.length}/15)`}
                </span>
              </label>
              <p className="text-xs text-slate-500">Sunumda otomatik kullanılacak. İlk fotoğraf kapak olur.</p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                💡 <strong>Mobilde ipucu:</strong> Bazı tarayıcılarda 5+ foto seçince galeri sessizce başarısız olabiliyor. <strong>Tek seferde 4 foto</strong> seçip yüklemenizi, sonra tekrar &quot;Fotoğraf Ekle&quot;ye basıp yenisini eklemenizi öneririm. (Toplam 15&apos;e kadar.)
              </p>

              {photoError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  ⚠️ {photoError}
                </div>
              )}

              {photoUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photoUrls.map((url, idx) => (
                    <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Fotoğraf ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs font-bold shadow"
                        aria-label="Sil">
                        ×
                      </button>
                      {idx === 0 && (
                        <div className="absolute bottom-0 inset-x-0 bg-indigo-600 text-white text-xs text-center py-0.5 font-medium">
                          Kapak
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}

          <button type="submit" disabled={status === "saving"}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg disabled:opacity-60 active:scale-95 transition">
            {status === "saving" ? "Kaydediliyor..." : (isEdit ? "✅ Değişiklikleri Kaydet" : "✅ Kaydet ve WhatsApp'a Dön")}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-slate-300 rounded-lg px-3 py-3 text-base text-slate-900 placeholder:text-slate-400";

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
    <h2 className="font-bold text-slate-900">{title}</h2>
    {children}
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
    {children}
  </div>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Pills({ label, value, options, onPick, cols = 2 }: { label: string; value: string; options: {id:string;label:string}[]; onPick: (v:string)=>void; cols?: number }) {
  const colClass = cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
    <div className={`grid ${colClass} gap-2`}>
      {options.map(o => (
        <button type="button" key={o.id} onClick={() => onPick(value === o.id ? "" : o.id)}
          className={`py-2 rounded-lg text-sm font-medium border-2 ${value === o.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-900 border-slate-300"}`}>
          {o.label}
        </button>
      ))}
    </div>
  </div>;
}

function MultiPills({ label, values, options, onToggle, cols = 2 }: { label: string; values: string[]; options: string[]; onToggle: (v:string)=>void; cols?: number }) {
  const colClass = cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
    <div className={`grid ${colClass} gap-2`}>
      {options.map(o => (
        <button type="button" key={o} onClick={() => onToggle(o)}
          className={`py-2 rounded-lg text-xs font-medium border-2 ${values.includes(o) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-900 border-slate-300"}`}>
          {o}
        </button>
      ))}
    </div>
  </div>;
}

function GeoPicker({ city, district, neighborhood, onCity, onDistrict, onNeighborhood }:
  { city: string; district: string; neighborhood: string;
    onCity: (v: string) => void; onDistrict: (v: string) => void; onNeighborhood: (v: string) => void }) {
  const [iller, setIller] = useState<string[]>([]);
  const [ilceler, setIlceler] = useState<string[]>([]);
  const [mahalleler, setMahalleler] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/geography`).then(r => r.json()).then(d => setIller(d.iller || []));
  }, []);

  useEffect(() => {
    if (!city) { setIlceler([]); return; }
    fetch(`/api/geography?il=${encodeURIComponent(city)}`).then(r => r.json()).then(d => setIlceler(d.ilceler || []));
  }, [city]);

  useEffect(() => {
    if (!city || !district) { setMahalleler([]); return; }
    fetch(`/api/geography?il=${encodeURIComponent(city)}&ilce=${encodeURIComponent(district)}`)
      .then(r => r.json()).then(d => setMahalleler(d.mahalleler || []));
  }, [city, district]);

  const sel = "w-full border border-slate-300 rounded-lg px-3 py-3 mb-4 text-base text-slate-900 bg-white";
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Şehir</label>
        <select value={city} onChange={e => { onCity(e.target.value); onDistrict(""); onNeighborhood(""); }} className={sel}>
          <option value="">— Seç —</option>
          {iller.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">İlçe</label>
        <select value={district} onChange={e => { onDistrict(e.target.value); onNeighborhood(""); }} disabled={!city} className={sel}>
          <option value="">— Seç —</option>
          {ilceler.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Mahalle</label>
        <select value={neighborhood} onChange={e => onNeighborhood(e.target.value)} disabled={!district} className={sel}>
          <option value="">— Seç —</option>
          {mahalleler.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </>
  );
}

function YesNo({ label, value, onPick }: { label: string; value: boolean | null; onPick: (v: boolean | null) => void }) {
  return <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
    <div className="grid grid-cols-3 gap-2">
      <button type="button" onClick={() => onPick(true)}
        className={`py-2 rounded-lg text-sm font-medium border-2 ${value === true ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-900 border-slate-300"}`}>Evet</button>
      <button type="button" onClick={() => onPick(false)}
        className={`py-2 rounded-lg text-sm font-medium border-2 ${value === false ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-900 border-slate-300"}`}>Hayır</button>
      <button type="button" onClick={() => onPick(null)}
        className={`py-2 rounded-lg text-sm font-medium border-2 ${value === null ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-900 border-slate-300"}`}>Belirtme</button>
    </div>
  </div>;
}
