"use client";

/**
 * Bayi Kullanıcı Yönetimi — Sprint 1, admin-only.
 *
 * 4 sekme:
 *   - Çalışanlar: iç tenant (admin/muhasebe/depocu/satış) rol editör + askıya al
 *   - Bayiler: dış bayi listesi (bayi_dealers) — display only (detay sayfası ayrı)
 *   - Bekleyen Davetler (Çalışan): user_invitations status='pending'
 *   - Bekleyen Davetler (Bayi): dealer_invitations status='pending'
 *
 * Admin değilse layout level Forbidden render eder (BAYI_ROLE_REQUIREMENTS).
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Employee {
  id: string;
  displayName: string | null;
  phone: string | null;
  role: string | null;
  capabilities: string[];
  suspended: boolean;
  suspendedAt: string | null;
  createdAt: string;
}

interface Dealer {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  city: string | null;
  balance: number;
  creditLimit: number;
  isActive: boolean;
  status: string;
  profileLinked: boolean;
  createdAt: string;
}

interface UserInvite {
  id: string;
  name: string | null;
  phone: string;
  role: string;
  inviteToken: string;
  createdAt: string;
  expiresAt: string;
}

interface DealerInvite {
  id: string;
  name: string;
  storeName: string;
  phone: string;
  inviteCode: string;
  createdAt: string;
  expiresAt: string;
}

interface ListResp {
  success: true;
  self: { id: string; role: string };
  employees: Employee[];
  dealers: Dealer[];
  pendingUserInvites: UserInvite[];
  pendingDealerInvites: DealerInvite[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  user: "Admin",
  muhasebe: "Muhasebe",
  depocu: "Depocu",
  satis: "Satış",
  employee: "Çalışan",
};

const ROLE_OPTIONS = [
  { value: "admin",    label: "Admin",    color: "bg-rose-100 text-rose-700" },
  { value: "muhasebe", label: "Muhasebe", color: "bg-amber-100 text-amber-700" },
  { value: "depocu",   label: "Depocu",   color: "bg-cyan-100 text-cyan-700" },
  { value: "satis",    label: "Satış",    color: "bg-indigo-100 text-indigo-700" },
];

type Tab = "employees" | "dealers" | "pending_user" | "pending_dealer";

const APP_BASE = typeof window === "undefined" ? "" : window.location.origin;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export default function BayiKullanicilarPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";

  const [data, setData] = useState<ListResp | null>(null);
  const [tab, setTab] = useState<Tab>("employees");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const r = await fetch(`/api/bayi-kullanicilar/list${qs}`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Liste alınamadı."); return; }
      setData(d);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function updateRole(userId: string, newRole: string) {
    setBusy(userId);
    try {
      const r = await fetch("/api/bayi-kullanicilar/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: token || undefined, target_user_id: userId, role: newRole }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "Rol güncellenemedi."); return; }
      await load();
    } finally { setBusy(null); }
  }

  async function toggleSuspend(userId: string) {
    if (!confirm("Bu kullanıcının erişimini askıya almak/aktifleştirmek istediğinize emin misiniz?")) return;
    setBusy(userId);
    try {
      const r = await fetch("/api/bayi-kullanicilar/toggle-suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: token || undefined, target_user_id: userId }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "İşlem başarısız."); return; }
      await load();
    } finally { setBusy(null); }
  }

  async function cancelInvite(inviteId: string, type: "user" | "dealer") {
    if (!confirm("Daveti iptal etmek istediğinize emin misiniz?")) return;
    setBusy(inviteId);
    try {
      const r = await fetch("/api/bayi-kullanicilar/cancel-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: token || undefined, invite_id: inviteId, type }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "İptal başarısız."); return; }
      await load();
    } finally { setBusy(null); }
  }

  function copyInviteLink(token: string, type: "user" | "dealer") {
    const path = type === "user" ? `/tr/kullanici-davet?t=${token}` : `/tr/bayi-davet?t=${token}`;
    const url = `${APP_BASE}${path}`;
    navigator.clipboard.writeText(url).then(
      () => alert("Davet linki kopyalandı."),
      () => prompt("Linki kopyalayın:", url),
    );
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-center text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl p-6 text-center">
          <p className="text-rose-700 font-medium">{error || "Veri alınamadı."}</p>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "employees",      label: "Çalışanlar",        count: data.employees.length },
    { id: "dealers",        label: "Bayiler",           count: data.dealers.length },
    { id: "pending_user",   label: "Bekleyen Çalışan",  count: data.pendingUserInvites.length },
    { id: "pending_dealer", label: "Bekleyen Bayi",     count: data.pendingDealerInvites.length },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">👥 Kullanıcı Yönetimi</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Şirket çalışanları, bağlı bayiler ve bekleyen davetler — tek panelden.
        </p>
      </header>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition flex items-center gap-2 ${
              tab === t.id
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800/50"
            }`}
          >
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-white/20" : "bg-slate-100 dark:bg-slate-900"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "employees" && (
        <div className="space-y-2">
          {data.employees.length === 0 ? (
            <EmptyState text="Henüz çalışan yok. /tr/kullanici-davet sayfasından davet edebilirsiniz." />
          ) : data.employees.map(emp => (
            <div key={emp.id} className={`bg-white dark:bg-slate-800 border rounded-xl p-4 ${emp.suspended ? "border-amber-300 bg-amber-50/30" : "border-slate-200 dark:border-slate-800/50"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {emp.displayName || emp.phone || "(isimsiz)"}
                    </h3>
                    {emp.suspended && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-medium">Askıda</span>
                    )}
                    {emp.id === data.self.id && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Sen</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {emp.phone && <span>📱 {emp.phone}</span>}
                    <span>📅 {fmtDate(emp.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={emp.role === "user" ? "admin" : (emp.role || "")}
                    onChange={(e) => void updateRole(emp.id, e.target.value)}
                    disabled={busy === emp.id || emp.id === data.self.id}
                    className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    {emp.role === "employee" && <option value="employee">Çalışan (legacy)</option>}
                  </select>
                  <button
                    onClick={() => void toggleSuspend(emp.id)}
                    disabled={busy === emp.id || emp.id === data.self.id}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50 ${
                      emp.suspended
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                    }`}
                  >
                    {emp.suspended ? "Aktifleştir" : "Askıya al"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "dealers" && (
        <div className="space-y-2">
          {data.dealers.length === 0 ? (
            <EmptyState text="Henüz bayi yok. Bayi ekleme için davet linki gönderin." />
          ) : data.dealers.map(d => {
            const href = token ? `/tr/bayiler/${d.id}?t=${encodeURIComponent(token)}` : `/tr/bayiler/${d.id}`;
            return (
              <a key={d.id} href={href} className="block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-4 hover:border-indigo-300 transition">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{d.name}</h3>
                      {!d.isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">Pasif</span>
                      )}
                      {d.profileLinked && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Hesap Bağlı</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {d.contactName && <span>👤 {d.contactName}</span>}
                      {d.phone && <span>📱 {d.phone}</span>}
                      {d.city && <span>📍 {d.city}</span>}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className={d.balance > 0 ? "text-rose-600 font-semibold" : "text-emerald-600 font-medium"}>
                      {d.balance.toLocaleString("tr-TR")} ₺
                    </div>
                    {d.creditLimit > 0 && (
                      <div className="text-slate-400">Limit: {d.creditLimit.toLocaleString("tr-TR")} ₺</div>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {tab === "pending_user" && (
        <div className="space-y-2">
          {data.pendingUserInvites.length === 0 ? (
            <EmptyState text="Bekleyen çalışan daveti yok." />
          ) : data.pendingUserInvites.map(inv => (
            <div key={inv.id} className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {inv.name || "(isimsiz)"}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {ROLE_LABELS[inv.role] || inv.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    📱 {inv.phone} · 📅 davet {fmtDate(inv.createdAt)} · ⏰ son {fmtDate(inv.expiresAt)}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => copyInviteLink(inv.inviteToken, "user")}
                    className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-medium"
                  >
                    Linki Kopyala
                  </button>
                  <button
                    onClick={() => void cancelInvite(inv.id, "user")}
                    disabled={busy === inv.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-medium disabled:opacity-50"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "pending_dealer" && (
        <div className="space-y-2">
          {data.pendingDealerInvites.length === 0 ? (
            <EmptyState text="Bekleyen bayi daveti yok." />
          ) : data.pendingDealerInvites.map(inv => (
            <div key={inv.id} className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{inv.storeName}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                      {inv.inviteCode}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    👤 {inv.name} · 📱 {inv.phone} · 📅 davet {fmtDate(inv.createdAt)} · ⏰ son {fmtDate(inv.expiresAt)}
                  </div>
                </div>
                <button
                  onClick={() => void cancelInvite(inv.id, "dealer")}
                  disabled={busy === inv.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-medium disabled:opacity-50"
                >
                  İptal
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-10 text-center">
      <div className="text-4xl mb-2">👥</div>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}
