"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "uploading" | "saving" | "done" | "error";

interface InitResponse {
  reservation: {
    id: string;
    guest_name: string;
    guest_phone: string;
    check_in: string;
    check_out: string;
    room_name: string | null;
    pre_checkin_complete: boolean;
  };
  hotel: { name: string; location: string } | null;
  profile: { display_name: string } | null;
  existing: {
    id_photo_url: string | null;
    preferences: Record<string, string>;
    marketing_opt_in: boolean;
    completed_at: string | null;
  } | null;
}

export default function OtelCekinPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [init, setInit] = useState<InitResponse | null>(null);

  // Form alanları
  const [idPhotoUrl, setIdPhotoUrl] = useState<string>("");
  const [eta, setEta] = useState("");
  const [breakfastDiet, setBreakfastDiet] = useState("");
  const [allergies, setAllergies] = useState("");
  const [pillow, setPillow] = useState("");
  const [smoking, setSmoking] = useState<"" | "yes" | "no">("");
  const [kvkk, setKvkk] = useState(false);
  const [marketing, setMarketing] = useState(false);
  // FAZ 3 — KBS kimlik alanları
  const [idType, setIdType] = useState<"tc" | "passport">("tc");
  const [tcNo, setTcNo] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("TR");
  const [motherName, setMotherName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [gender, setGender] = useState<"" | "M" | "F">("");

  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-cekin/init${qs}`, { credentials: "same-origin" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setInit(d);
        if (d.existing) {
          setIdPhotoUrl(d.existing.id_photo_url || "");
          const prefs = d.existing.preferences || {};
          setEta((prefs.eta as string) || "");
          setBreakfastDiet((prefs.breakfast_diet as string) || "");
          setAllergies((prefs.allergies as string) || "");
          setPillow((prefs.pillow as string) || "");
          setSmoking(((prefs.smoking as string) || "") as "" | "yes" | "no");
          setMarketing(d.existing.marketing_opt_in || false);
        }
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  async function uploadIdPhoto(file: File) {
    setStatus("uploading");
    setError("");
    try {
      const fd = new FormData();
      fd.append("token", token!);
      fd.append("file", file);
      const res = await fetch("/api/otel-cekin/upload-id", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) {
        setStatus("ready");
        setError(d.error || "Yükleme başarısız.");
        return;
      }
      setIdPhotoUrl(d.url || "");
      setStatus("ready");
    } catch {
      setStatus("ready");
      setError("Yükleme bağlantı hatası.");
    }
  }

  async function save() {
    if (!idPhotoUrl) { setError("Kimlik fotoğrafı gerekli."); return; }
    if (!kvkk) { setError("Devam etmek için KVKK onayı gerekli."); return; }
    if (idType === "tc" && tcNo && !/^\d{11}$/.test(tcNo)) {
      setError("TC kimlik numarası 11 haneli olmalı.");
      return;
    }
    setError("");
    setStatus("saving");
    try {
      const res = await fetch("/api/otel-cekin/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          id_photo_url: idPhotoUrl,
          preferences: {
            eta: eta || null,
            breakfast_diet: breakfastDiet || null,
            allergies: allergies || null,
            pillow: pillow || null,
            smoking: smoking || null,
          },
          kvkk_accepted: kvkk,
          marketing_opt_in: marketing,
          id_type: idType,
          tc_no: idType === "tc" ? tcNo.trim() || undefined : undefined,
          id_number: idType === "passport" ? idNumber.trim() || undefined : undefined,
          birth_date: birthDate || undefined,
          nationality: nationality || undefined,
          mother_name: motherName.trim() || undefined,
          father_name: fatherName.trim() || undefined,
          gender: gender || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setStatus("ready");
        setError(d.error || "Kaydedilemedi.");
        return;
      }
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
    <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-rose-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  if (status === "done") return <Center>
    <div className="text-4xl mb-3">✅</div>
    <h1 className="text-xl font-bold mb-2">Online check-in tamamlandı!</h1>
    <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">Otele geldiğinizde anahtar kartınız hazır olacak. İyi konaklamalar.</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-rose-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  if (!init) return null;

  const ci = new Date(init.reservation.check_in).toLocaleDateString("tr-TR");
  const co = new Date(init.reservation.check_out).toLocaleDateString("tr-TR");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-rose-600 to-amber-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">🏨</div>
          <h1 className="text-xl font-bold">Online Check-in</h1>
          <p className="text-rose-100 text-sm mt-1">
            {init.hotel?.name || "Otel"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-4 text-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Rezervasyon</div>
          <div className="space-y-1">
            <div>👤 <strong>{init.reservation.guest_name || "Misafir"}</strong></div>
            <div>📅 {ci} → {co}</div>
            {init.reservation.room_name && <div>🚪 {init.reservation.room_name}</div>}
            {init.existing?.completed_at && <div className="text-emerald-700 mt-2">✅ Daha önce tamamlandı — düzenliyorsunuz.</div>}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Kimlik Fotoğrafı *</h2>
          {idPhotoUrl ? (
            <div className="space-y-2">
              <img src={idPhotoUrl} alt="Kimlik" className="w-full rounded-lg border border-slate-200 dark:border-slate-800/50" />
              <button onClick={() => setIdPhotoUrl("")} className="text-xs text-rose-700 hover:underline">Değiştir</button>
            </div>
          ) : (
            <label className="block">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadIdPhoto(f);
                }}
                className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
              />
              <p className="text-[11px] text-slate-500 mt-2">TC kimlik veya pasaport. Bilgileriniz şifreli saklanır, sadece resepsiyon görür.</p>
            </label>
          )}
          {status === "uploading" && <p className="text-xs text-slate-500 mt-2">⏳ Yükleniyor...</p>}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Kimlik Bilgileri (KBS için)</h2>
          <p className="text-[11px] text-slate-500">Yasal konaklama bildirimi için zorunlu alanlardır. Veriler güvenli saklanır.</p>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Kimlik tipi</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setIdType("tc")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border ${idType === "tc" ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800/50"}`}>
                TC Kimlik
              </button>
              <button type="button" onClick={() => setIdType("passport")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border ${idType === "passport" ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800/50"}`}>
                Pasaport
              </button>
            </div>
          </div>

          {idType === "tc" ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">TC Kimlik No</label>
              <input value={tcNo} onChange={e => setTcNo(e.target.value.replace(/\D/g, "").slice(0, 11))}
                inputMode="numeric" maxLength={11}
                placeholder="11 haneli"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Pasaport / Yabancı Kimlik No</label>
              <input value={idNumber} onChange={e => setIdNumber(e.target.value.toUpperCase())}
                placeholder="Belge numarası"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Doğum tarihi</label>
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Uyruk</label>
              <input value={nationality} onChange={e => setNationality(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="TR" maxLength={3}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Anne adı</label>
              <input value={motherName} onChange={e => setMotherName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Baba adı</label>
              <input value={fatherName} onChange={e => setFatherName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Cinsiyet</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setGender(gender === "M" ? "" : "M")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border ${gender === "M" ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800/50"}`}>
                Erkek
              </button>
              <button type="button" onClick={() => setGender(gender === "F" ? "" : "F")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border ${gender === "F" ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800/50"}`}>
                Kadın
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Tercihleriniz (opsiyonel)</h2>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tahmini varış saati</label>
            <input value={eta} onChange={e => setEta(e.target.value)}
              placeholder="Örn. 16:30 — uçaktan sonra"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Kahvaltı tercihi</label>
            <select value={breakfastDiet} onChange={e => setBreakfastDiet(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm">
              <option value="">— Seçilmedi —</option>
              <option value="standard">Standart</option>
              <option value="vegetarian">Vejetaryen</option>
              <option value="vegan">Vegan</option>
              <option value="gluten_free">Glütensiz</option>
              <option value="halal">Helal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Alerjiler</label>
            <input value={allergies} onChange={e => setAllergies(e.target.value)}
              placeholder="Örn. fıstık, deniz ürünü"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Yastık tercihi</label>
            <input value={pillow} onChange={e => setPillow(e.target.value)}
              placeholder="Örn. yumuşak / sert / hipoalerjenik"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Sigara</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSmoking(smoking === "no" ? "" : "no")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border ${smoking === "no" ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800/50"}`}>
                Sigarasız oda
              </button>
              <button type="button" onClick={() => setSmoking(smoking === "yes" ? "" : "yes")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border ${smoking === "yes" ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800/50"}`}>
                Sigara serbest
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-4 space-y-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={kvkk} onChange={e => setKvkk(e.target.checked)} className="w-4 h-4 mt-0.5 accent-rose-600" />
            <span className="flex-1">
              <strong>KVKK Aydınlatma + Konaklama Sözleşmesi</strong>: Kimlik bilgilerimin yasal süreyle ({init.hotel?.name || "otel"}'in yükümlülüğü dahilinde) saklanmasına ve konaklama sözleşmesi koşullarına onay veriyorum. *
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} className="w-4 h-4 mt-0.5 accent-rose-600" />
            <span className="flex-1 text-slate-600 dark:text-slate-400">
              {init.hotel?.name || "Otel"}'in özel kampanya ve sezon fırsatlarından WhatsApp üzerinden haberdar olmak istiyorum (opsiyonel — istediğiniz an iptal edebilirsiniz).
            </span>
          </label>
        </div>

        <button onClick={save} disabled={status === "saving" || status === "uploading"}
          className="w-full bg-rose-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60 active:scale-95">
          {status === "saving" ? "Kaydediliyor..." : "✅ Tamamla"}
        </button>

        {error && <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 px-4 py-3 rounded-lg text-sm shadow-lg">⚠️ {error}</div>}

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
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
