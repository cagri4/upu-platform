"use client";

/**
 * /tr/site-profil — Site yöneticisi profil düzenleme.
 *
 * (site) route group içindeki sayfa: AdminLayout sidebar + topbar otomatik.
 * Field set siteyönetim-spesifik: ad, e-posta, telefon (read-only WA),
 * yönetici ünvanı, bina adı, bina adresi.
 *
 * Emlak'taki /profil-duzenle (agent_profile + web_slug) modelinden ayrı —
 * yönetici "kişisel landing page" üretmiyor, yönettiği bina meta'sını
 * düzenliyor.
 *
 * API: /api/site/profile/init + /api/site/profile/save (host-guard:
 * subdomain siteyonetim değilse 403).
 */

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  User,
  Phone,
  Building2,
  MapPin,
  Briefcase,
  Check,
  AlertTriangle,
  Loader2,
  Save,
} from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

type Status = "loading" | "form" | "saving" | "error";

const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition";

const readonlyCls =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-sm text-slate-600 dark:text-slate-400";

export default function SiteProfilPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [buildingAddress, setBuildingAddress] = useState("");
  const [hasBuilding, setHasBuilding] = useState(false);

  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/site/profile/init${qs}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || d?.error) {
          setStatus("error");
          setError(d.error || "Profil bilgileri alınamadı.");
          return;
        }
        const p = d.profile || {};
        const b = d.building || {};
        setDisplayName(p.display_name || "");
        setEmail(p.email || "");
        setPhone(p.whatsapp_phone || "");
        setRoleTitle(p.role_title || "");
        setBuildingName(b.name || "");
        setBuildingAddress(b.address || "");
        setHasBuilding(!!b.id);
        setStatus("form");
      })
      .catch(() => {
        setStatus("error");
        setError("Bağlantı hatası.");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (displayName.trim().length < 2) {
      setError("Ad soyad en az 2 karakter olmalı.");
      return;
    }
    setStatus("saving");
    setError("");
    setToast("");
    try {
      const res = await fetch("/api/site/profile/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          token,
          display_name: displayName.trim(),
          email: email.trim(),
          role_title: roleTitle.trim(),
          building_name: buildingName.trim(),
          building_address: buildingAddress.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok || d?.error) {
        setStatus("form");
        setError(d.error || "Kaydedilemedi.");
        return;
      }
      setStatus("form");
      setToast("Profil güncellendi.");
      setTimeout(() => setToast(""), 2500);
      // sidebar/topbar isim cache'i için soft refresh — Next.js router
      // re-fetch yapsın diye revalidate yerine push (Sidebar SSR data init'ten)
      router.refresh();
    } catch {
      setStatus("form");
      setError("Bağlantı hatası.");
    }
  }

  if (status === "loading") {
    return (
      <div className="space-y-5">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Hata</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-24">
      <HeroBanner
        Icon={User}
        title="Profil & Bina Bilgileri"
        subtitle="Yönetici bilgileriniz ve bina kayıtları"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Section title="Kişisel" Icon={User}>
          <Field label="Ad Soyad *">
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Mehmet Yıldız"
              className={inputCls}
            />
          </Field>
          <Field label="E-posta">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yonetici@ornek.com"
              className={inputCls}
            />
          </Field>
          <Field label="Telefon (WhatsApp — değiştirilemez)">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" />
              <span className={readonlyCls}>{phone || "—"}</span>
            </div>
          </Field>
          <Field label="Yönetici Ünvanı (opsiyonel)">
            <div className="relative">
              <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="örn. Yönetim Kurulu Başkanı"
                className={`${inputCls} pl-9`}
              />
            </div>
          </Field>
        </Section>

        <Section title="Yönetilen Bina" Icon={Building2}>
          {!hasBuilding ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              Henüz bağlı bir bina yok. WhatsApp&apos;tan <strong>binakodu</strong> komutu ile bina ekleyebilirsiniz.
            </p>
          ) : (
            <>
              <Field label="Bina Adı">
                <input
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  placeholder="örn. Yeşilköy Sitesi A Blok"
                  className={inputCls}
                />
              </Field>
              <Field label="Adres">
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <textarea
                    value={buildingAddress}
                    onChange={(e) => setBuildingAddress(e.target.value)}
                    placeholder="Mah. / Cad. / No"
                    rows={2}
                    className={`${inputCls} pl-9 resize-none`}
                  />
                </div>
              </Field>
            </>
          )}
        </Section>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        {toast && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" /> {toast}
          </div>
        )}

        <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-3 z-10 sm:static sm:bg-transparent sm:border-0 sm:p-0">
          <div className="max-w-3xl mx-auto flex justify-end">
            <button
              type="submit"
              disabled={status === "saving"}
              className="inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white py-3 px-6 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition w-full sm:w-auto"
            >
              {status === "saving" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor…</>
              ) : (
                <><Save className="w-4 h-4" /> Kaydet</>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Section({ title, Icon, children }: { title: string; Icon: typeof User; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
      <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Icon className="w-4 h-4 text-sky-600 dark:text-sky-400" strokeWidth={2.2} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

