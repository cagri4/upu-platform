"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Users, UserPlus, Copy, Check, ChevronDown, ChevronRight, Trash2 } from "lucide-react";

interface Category {
  key: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string;
  whatsappPhone: string;
}

interface TenantUser {
  id: string;
  display_name: string | null;
  role: string | null;
  whatsapp_phone: string | null;
  email: string | null;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  userCount: number;
  is_demo: boolean;
  users: TenantUser[];
}

interface Resp {
  category: Category;
  tenants: TenantRow[];
}

export default function SaasDetailPage() {
  const params = useParams();
  const key = (params?.key as string) || "";
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteLinks, setInviteLinks] = useState<Record<string, { code: string; usedCount: number; maxUses: number | null }>>({});
  const [linkLoading, setLinkLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapsed = (id: string) => setCollapsed((p) => ({ ...p, [id]: !p[id] }));

  useEffect(() => {
    fetch(`/api/admin/saas/${key}/tenants`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d.error || "Liste alınamadı.");
          return;
        }
        setData(d);
      })
      .catch(() => setError("Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [key]);

  async function getOrCreateLink(tenantId: string) {
    setLinkLoading(tenantId);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, type: "link" }),
      });
      const d = await res.json();
      if (res.ok) {
        setInviteLinks((prev) => ({
          ...prev,
          [tenantId]: { code: d.code, usedCount: d.usedCount, maxUses: d.maxUses },
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLinkLoading(null);
    }
  }

  function copy(text: string, k: string) {
    navigator.clipboard.writeText(text);
    setCopied(k);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Yükleniyor…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-8">
        <Link href="/admin" className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Tüm SaaS&apos;lar
        </Link>
        <div className="max-w-md mx-auto bg-slate-800 border border-rose-500/40 rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold mb-2">Hata</h1>
          <p className="text-sm text-slate-400">{error || "Bulunamadı."}</p>
        </div>
      </div>
    );
  }

  const cat = data.category;
  const tenants = data.tenants;
  const activeCount = tenants.filter((t) => t.is_active).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <Link href="/admin" className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-sm mb-3">
            <ArrowLeft className="w-4 h-4" /> Tüm SaaS&apos;lar
          </Link>
          <div className="flex items-start gap-4">
            <span className="text-4xl" aria-hidden>{cat.icon}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {cat.name}
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: cat.color }} aria-hidden />
              </h1>
              <p className="text-sm text-slate-400 mt-1">{cat.slug}.upudev.nl</p>
              <p className="text-xs text-slate-500 mt-2 max-w-2xl">{cat.description}</p>
              <div className="flex gap-4 mt-3 text-sm">
                <span className="text-slate-400">
                  <strong className="text-white">{tenants.length}</strong> müşteri
                </span>
                <span className="text-slate-400">
                  <strong className="text-emerald-400">{activeCount}</strong> aktif
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold mb-4">Müşteri Tenant&apos;ları</h2>

        {tenants.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
            <p className="text-slate-400 text-sm">
              Bu kategoride henüz müşteri yok. İlk signup buradan eklenecek.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((t) => (
              <div
                key={t.id}
                data-testid={`tenant-card-${t.id}`}
                className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h3 className="font-semibold truncate flex-1">{t.name}</h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {t.is_demo && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono uppercase tracking-wide"
                          title="Config DEMO tenant'ı — silinmez"
                        >
                          🏷 DEMO
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          t.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                        }`}
                      >
                        {t.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 font-mono">{t.slug}</p>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-slate-400 inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {t.userCount} kullanıcı
                    </span>
                    <span className="text-slate-500">
                      {new Date(t.created_at).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                  <a
                    href={`https://${cat.slug}.upudev.nl`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs mb-3"
                  >
                    <ExternalLink className="w-3 h-3" /> Panel aç
                  </a>

                  {(() => {
                    const isCollapsed = collapsed[t.id] ?? (t.users.length > 4);
                    return (
                      <div className="mb-3 border border-slate-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleCollapsed(t.id)}
                          className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-900/40 hover:bg-slate-900/60 text-xs text-slate-300"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            Kullanıcılar ({t.users.length})
                          </span>
                          {t.users.length === 0 && (
                            <span className="text-[10px] text-rose-400/80">boş</span>
                          )}
                        </button>
                        {!isCollapsed && (
                          <div className="divide-y divide-slate-700/60">
                            {t.users.length === 0 ? (
                              <div className="px-3 py-2 text-[11px] text-slate-500 italic">
                                Bu firmada henüz kullanıcı yok.
                              </div>
                            ) : (
                              t.users.map((u) => (
                                <div key={u.id} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                                  <span aria-hidden>👤</span>
                                  <span className="text-slate-200 truncate flex-1">
                                    {u.display_name || "—"}
                                  </span>
                                  {u.role && (
                                    <span className="text-[10px] text-slate-500 font-mono uppercase">{u.role}</span>
                                  )}
                                  {u.whatsapp_phone && (
                                    <span className="text-[10px] text-emerald-400/80 font-mono whitespace-nowrap">
                                      {u.whatsapp_phone}
                                    </span>
                                  )}
                                  <button
                                    className="text-rose-400/70 hover:text-rose-300 p-0.5"
                                    title="Sil (yakında)"
                                    disabled
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {!inviteLinks[t.id] ? (
                    <button
                      onClick={() => getOrCreateLink(t.id)}
                      disabled={linkLoading === t.id}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition text-sm disabled:opacity-50"
                    >
                      <UserPlus className="w-4 h-4" />
                      {linkLoading === t.id ? "Oluşturuluyor…" : "Davet Linki Oluştur"}
                    </button>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Davet Kodu:</span>
                        <span className="font-mono font-bold text-emerald-300">{inviteLinks[t.id].code}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Kullanım: {inviteLinks[t.id].usedCount}
                        {inviteLinks[t.id].maxUses ? `/${inviteLinks[t.id].maxUses}` : " (sınırsız)"}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const waLink = `https://wa.me/${cat.whatsappPhone}?text=${encodeURIComponent(`Merhaba! Sisteme kayıt olmak istiyorum. Davet kodum: ${inviteLinks[t.id].code}`)}`;
                            copy(waLink, `wa-${t.id}`);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs"
                        >
                          {copied === `wa-${t.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copied === `wa-${t.id}` ? "Kopyalandı" : "wa.me"}
                        </button>
                        <button
                          onClick={() => copy(inviteLinks[t.id].code, `code-${t.id}`)}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs"
                        >
                          {copied === `code-${t.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          Kod
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
