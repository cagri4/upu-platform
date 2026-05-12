"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  Building2,
  MapPin,
  Wrench,
  FileText,
  Camera,
  Loader2,
  AlertTriangle,
  Check,
  Sparkles,
  Plus,
  MessageCircle,
  X,
  Info,
} from "lucide-react";
import { ChromeSuggest, ChromeOpenInlineLink } from "./chrome-suggest";
import { useIsInAppBrowser } from "./use-in-app-browser";

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

const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition";

export default function MulkEkleFormPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const editId = searchParams.get("id");
  const isEdit = !!editId;

  const { isInAppBrowser } = useIsInAppBrowser();

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

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
    const tokenQs = token ? `&t=${encodeURIComponent(token)}` : "";

    if (isEdit) {
      fetch(`/api/mulklerim/get?id=${encodeURIComponent(editId!)}${tokenQs}`, { credentials: "same-origin" })
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

    const setupQs = token ? `?token=${encodeURIComponent(token)}` : "";
    fetch(`/api/setup/init${setupQs}`, { credentials: "same-origin" })
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
    if (files.length === 0) {
      setPhotoError(
        isInAppBrowser
          ? "Galeri foto seçemedi (mobil tarayıcı sınırı). Tek seferde 4 max foto deneyin veya yukarıdaki Chrome'da Aç butonunu kullanın."
          : "Galeri foto seçemedi. Lütfen tekrar deneyin.",
      );
      return;
    }
    const remaining = 15 - photoUrls.length;
    if (remaining <= 0) { setPhotoError("Maksimum 15 fotoğraf."); return; }

    const cap = isInAppBrowser ? 4 : remaining;
    const toUpload = files.slice(0, Math.min(remaining, cap));
    if (isInAppBrowser && files.length > cap) {
      setPhotoError(`${files.length} foto seçtiniz — sadece ilk ${cap}'ünü yüklüyorum. Geri kalanını "Fotoğraf Ekle"ye tekrar basıp ekleyin.`);
    } else if (files.length > remaining) {
      setPhotoError(`${files.length} foto seçtiniz — kalan ${remaining} slot için sadece ilk ${remaining}'ü yüklüyorum.`);
    }
    setPhotoUploading(true);
    setPhotoError("");
    setPhotoProgress({ done: 0, total: toUpload.length });
    try {
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        try {
          const fd = new FormData();
          fd.append("token", token || "");
          fd.append("file", file);
          const res = await fetch("/api/mulkekle/upload-photo", { method: "POST", body: fd, credentials: "same-origin" });
          const data = await res.json().catch(() => ({ error: "Sunucu cevabı okunamadı." }));
          if (!res.ok) {
            setPhotoError(`Fotoğraf ${i + 1}: ${data.error || `Hata ${res.status}`}`);
            break;
          }
          if (data.url) {
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
        credentials: "same-origin",
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

  if (status === "loading") {
    return (
      <Center>
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400">Link doğrulanıyor...</p>
      </Center>
    );
  }
  if (status === "error") {
    return (
      <Center>
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Hata</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
        <a
          href={`https://wa.me/${BOT_WA_NUMBER}`}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition"
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp&apos;a dön
        </a>
      </Center>
    );
  }
  if (status === "done") {
    return (
      <DoneState
        isEdit={isEdit}
        panelHref={token ? `/tr/panel?t=${encodeURIComponent(token)}` : "/tr/panel"}
        addMoreHref={token ? `/api/panel/start?cmd=mulkekle&t=${encodeURIComponent(token)}` : "/api/panel/start?cmd=mulkekle"}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <div className="max-w-md mx-auto p-4 space-y-5">
        {/* Hero */}
        <div className="flex items-center gap-3">
          <a
            href={token ? `/tr/panel?t=${encodeURIComponent(token)}` : "/tr/panel"}
            className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
          </a>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isEdit ? "Mülk Düzenle" : "Yeni Mülk"}
          </h1>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
          {isEdit ? "Bilgileri güncelleyin ve kaydedin." : "Ne kadar bilgi girerseniz AI o kadar iyi sunum yazar."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Section title="Temel Bilgiler" Icon={ClipboardList}>
            <Field label="Başlık *">
              <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Yalıkavak 2+1 Deniz Manzaralı" className={inputCls} />
            </Field>
            <Pills label="İlan Tipi *" value={listingType} options={[{id:"satilik",label:"Satılık"},{id:"kiralik",label:"Kiralık"}]} onPick={setListingType} />
            <Pills label="Mülk Tipi *" value={type} options={TYPE_OPTIONS} onPick={setType} cols={3} />
            <Field label="Fiyat (TL) *">
              <input
                required
                type="text"
                inputMode="numeric"
                value={price ? Number(price).toLocaleString("tr-TR") : ""}
                onChange={e => setPrice(e.target.value.replace(/\D/g, ""))}
                placeholder="4.500.000"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="m² Brüt"><input type="number" value={area} onChange={e => setArea(e.target.value)} className={inputCls} /></Field>
              <Field label="m² Net"><input type="number" value={netArea} onChange={e => setNetArea(e.target.value)} className={inputCls} /></Field>
            </div>
            <Pills label="Oda" value={rooms} options={ROOMS_OPTIONS.map(r => ({id:r,label:r}))} onPick={setRooms} cols={3} />
          </Section>

          <Section title="Bina" Icon={Building2}>
            <Pills label="Kat" value={floor} options={FLOOR_OPTIONS.map(f => ({id:f,label:f}))} onPick={setFloor} cols={3} />
            <Pills label="Toplam Kat" value={totalFloors} options={TOTAL_FLOORS.map(f => ({id:f,label:f}))} onPick={setTotalFloors} cols={3} />
            <Pills label="Bina Yaşı" value={buildingAge} options={BUILDING_AGE.map(a => ({id:a,label:a}))} onPick={setBuildingAge} cols={3} />
          </Section>

          <Section title="Konum" Icon={MapPin}>
            <GeoPicker city={city} district={district} neighborhood={neighborhood}
              onCity={setCity} onDistrict={setDistrict} onNeighborhood={setNeighborhood} />
          </Section>

          <Section title="Detaylar" Icon={Wrench}>
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

          <Section title="Açıklama" Icon={FileText}>
            <Field label="İlan Açıklaması">
              <textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Serbest metin veya boş bırak, AI sonra yazar" className={`${inputCls} resize-none`} />
            </Field>
          </Section>

          <Section title="Fotoğraflar" Icon={Camera}>
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
                <span
                  className={`flex items-center justify-center gap-2 w-full text-center py-3 rounded-xl font-medium border-2 border-dashed cursor-pointer transition ${
                    photoUploading
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 animate-pulse"
                      : photoUrls.length >= 15
                        ? "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                        : "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                  }`}
                >
                  {photoUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {photoProgress ? `Yükleniyor... ${photoProgress.done}/${photoProgress.total}` : "Yükleniyor..."}
                    </>
                  ) : photoUrls.length >= 15 ? (
                    "Maksimum 15 fotoğraf doldu"
                  ) : (
                    <>
                      <Camera className="w-4 h-4" strokeWidth={2.2} />
                      Fotoğraf Ekle ({photoUrls.length}/15)
                    </>
                  )}
                </span>
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sunumda otomatik kullanılacak. İlk fotoğraf kapak olur.</p>
              {isInAppBrowser && (
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2 flex items-start gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
                  <span>
                    Tek seferde en fazla <strong>4 fotoğraf</strong> ekleyin, ya da <ChromeOpenInlineLink /> ve hepsini birden ekleyin.
                  </span>
                </p>
              )}
              <ChromeSuggest />

              {photoError && (
                <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-3 py-2 rounded-xl text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {photoError}
                </div>
              )}

              {photoUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photoUrls.map((url, idx) => (
                    <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Fotoğraf ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md transition active:scale-90"
                        aria-label="Sil"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </button>
                      {idx === 0 && (
                        <div className="absolute bottom-0 inset-x-0 bg-emerald-600 text-white text-xs text-center py-0.5 font-medium">
                          Kapak
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
            </div>
          )}
        </form>
      </div>

      <StickyBottom>
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={status === "saving"}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition"
        >
          <Check className="w-5 h-5" strokeWidth={2.5} />
          {status === "saving" ? "Kaydediliyor..." : (isEdit ? "Güncelle" : "Kaydet")}
        </button>
      </StickyBottom>
    </div>
  );
}

function Section({ title, Icon, children }: { title: string; Icon: typeof Building2; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
      <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function StickyBottom({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-3 z-10">
      <div className="max-w-md mx-auto flex gap-2">{children}</div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        {children}
      </div>
    </div>
  );
}

function DoneState({ isEdit, panelHref, addMoreHref }: { isEdit: boolean; panelHref: string; addMoreHref: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-sm w-full shadow-sm border border-slate-200/70 dark:border-slate-800 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
          {isEdit ? (
            <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
          ) : (
            <Sparkles className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">
          {isEdit ? "Mülk güncellendi" : "Mülk eklendi"}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
          {isEdit
            ? "Değişiklikler kaydedildi."
            : "Bu mülke ait sunumu sizin için hazırlamaya başladım. Birazdan panel > Sunumlarım bölümünden inceleyebilirsiniz."}
        </p>
        <div className="w-full space-y-2">
          <a href={panelHref} className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white text-center font-semibold py-4 rounded-2xl shadow-sm active:scale-[0.98] transition">
            Panele Dön
          </a>
          {!isEdit && (
            <a href={addMoreHref} className="flex items-center justify-center gap-2 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-center font-semibold py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition">
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Yeni Mülk Ekle
            </a>
          )}
          <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="flex items-center justify-center gap-2 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-center font-semibold py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition">
            <MessageCircle className="w-4 h-4" /> WhatsApp&apos;a Dön
          </a>
        </div>
      </div>
    </div>
  );
}

function Pills({ label, value, options, onPick, cols = 2 }: { label: string; value: string; options: {id:string;label:string}[]; onPick: (v:string)=>void; cols?: number }) {
  const colClass = cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <div className={`grid ${colClass} gap-2`}>
        {options.map(o => (
          <button
            type="button"
            key={o.id}
            onClick={() => onPick(value === o.id ? "" : o.id)}
            className={`px-3 py-2.5 rounded-xl text-sm font-medium transition active:scale-[0.97] ${
              value === o.id
                ? "bg-emerald-600 text-white border border-emerald-600"
                : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400 dark:hover:border-emerald-500"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiPills({ label, values, options, onToggle, cols = 2 }: { label: string; values: string[]; options: string[]; onToggle: (v:string)=>void; cols?: number }) {
  const colClass = cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label} <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">({values.length} seçili)</span>
      </label>
      <div className={`grid ${colClass} gap-2`}>
        {options.map(o => (
          <button
            type="button"
            key={o}
            onClick={() => onToggle(o)}
            className={`px-3 py-2.5 rounded-xl text-xs font-medium transition active:scale-[0.97] ${
              values.includes(o)
                ? "bg-emerald-600 text-white border border-emerald-600"
                : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400 dark:hover:border-emerald-500"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
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

  return (
    <div className="space-y-3">
      <Field label="Şehir">
        <select value={city} onChange={e => { onCity(e.target.value); onDistrict(""); onNeighborhood(""); }} className={inputCls}>
          <option value="">— Seç —</option>
          {iller.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </Field>
      <Field label="İlçe">
        <select value={district} onChange={e => { onDistrict(e.target.value); onNeighborhood(""); }} disabled={!city} className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`}>
          <option value="">— Seç —</option>
          {ilceler.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </Field>
      <Field label="Mahalle">
        <select value={neighborhood} onChange={e => onNeighborhood(e.target.value)} disabled={!district} className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`}>
          <option value="">— Seç —</option>
          {mahalleler.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
    </div>
  );
}

function YesNo({ label, value, onPick }: { label: string; value: boolean | null; onPick: (v: boolean | null) => void }) {
  const opts: [string, boolean | null][] = [["Evet", true], ["Hayır", false], ["Belirtme", null]];
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {opts.map(([lbl, v]) => (
          <button
            key={lbl}
            type="button"
            onClick={() => onPick(v)}
            className={`px-3 py-2.5 rounded-xl text-sm font-medium transition active:scale-[0.97] ${
              value === v
                ? "bg-emerald-600 text-white border border-emerald-600"
                : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400 dark:hover:border-emerald-500"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
