"use client";

/**
 * /tr/site-yonetim-rolleri — Yönetici rol atama sayfası (Sprint 1).
 *
 * Yönetici binasındaki kullanıcıları listeler + her satırda rol seçici
 * (sakin / yonetici / denetci / muhasebeci_site). Değişiklik anında
 * POST /api/site/yonetim-rolleri ile kaydedilir.
 *
 * Yalnızca yönetici (manager_id) erişebilir. Sakin rol policy'leri henüz
 * canlı değil (Sprint 2 başı), ancak rol ataması şimdiden yapılabilir.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Users, ShieldCheck, AlertCircle } from "lucide-react";
import { HeroBanner, ListCard, Skeleton, InfoChip } from "@/components/banking";

interface Member {
  user_id: string;
  profile_id: string | null;
  full_name: string;
  phone: string | null;
  unit_number: string;
  is_active: boolean;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  sakin: "Sakin",
  yonetici: "Yönetici",
  denetci: "Denetçi",
  muhasebeci_site: "Muhasebeci",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  sakin: "Kendi dairesi + bildirim",
  yonetici: "Tüm bina yetkisi",
  denetci: "Mali okuma-only",
  muhasebeci_site: "Gelir/gider yazar",
};

const ALL_ROLES = ["sakin", "yonetici", "denetci", "muhasebeci_site"];

export default function SiteYonetimRolleriPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState<{ id: string; name: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/site/yonetim-rolleri${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) {
          setError(d.error);
          return;
        }
        setBuilding(d.building ?? null);
        setMembers(d.members ?? []);
      })
      .catch(() => setError("Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [token]);

  async function updateRole(member: Member, newRole: string) {
    if (!member.profile_id) {
      setToast({ kind: "err", text: "Bu kullanıcının profili henüz oluşmamış." });
      return;
    }
    if (newRole === member.role) return;

    setSavingId(member.user_id);
    setToast(null);

    try {
      const res = await fetch("/api/site/yonetim-rolleri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ profile_id: member.profile_id, role: newRole }),
      });
      const d = await res.json();

      if (!res.ok) {
        setToast({ kind: "err", text: d.error || "Güncelleme başarısız." });
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.user_id === member.user_id ? { ...m, role: newRole } : m)),
        );
        setToast({ kind: "ok", text: `${member.full_name} → ${ROLE_LABELS[newRole]}` });
        window.setTimeout(() => setToast(null), 3000);
      }
    } catch {
      setToast({ kind: "err", text: "Bağlantı hatası." });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={ShieldCheck}
        title="Yönetim & Roller"
        subtitle={
          building
            ? `${building.name} — kullanıcı yetkilerini buradan yönetin`
            : "Bina kullanıcılarına rol atama"
        }
      />

      <InfoChip
        Icon={AlertCircle}
        text="Sakin rolü için ayrıntılı erişim Sprint 2 başında devreye girecek. Yönetici/Denetçi/Muhasebeci rolleri şu an aktif."
      />

      {toast && (
        <div
          className={`rounded-2xl p-3 text-sm ${
            toast.kind === "ok"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Binadaki Kullanıcılar
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="h-20" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-sm">
            ⚠ {error}
          </div>
        ) : members.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center space-y-2">
            <div className="text-4xl">🏢</div>
            <div className="font-semibold text-slate-900 dark:text-white">
              Henüz bağlı kullanıcı yok
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sakinler bina kodunu girip kayıt olduktan sonra burada görünür.
            </p>
          </div>
        ) : (
          members.map((m) => (
            <div
              key={m.user_id}
              className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3.5 border border-slate-200/70 dark:border-slate-800 shadow-sm flex items-center gap-3 flex-wrap"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {m.full_name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Daire {m.unit_number}
                  {m.phone ? ` · ${m.phone}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={m.role}
                  onChange={(e) => updateRole(m, e.target.value)}
                  disabled={savingId === m.user_id || !m.profile_id}
                  className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:opacity-50"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              {savingId === m.user_id && (
                <span className="text-xs text-slate-500 dark:text-slate-400">Kaydediliyor…</span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Rol açıklamaları
        </div>
        {ALL_ROLES.map((r) => (
          <div key={r} className="flex items-start gap-3 text-sm">
            <span className="font-semibold text-slate-900 dark:text-white min-w-[100px]">
              {ROLE_LABELS[r]}
            </span>
            <span className="text-slate-600 dark:text-slate-400">{ROLE_DESCRIPTIONS[r]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
