'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Layers, Activity, Trash2, BarChart3, TrendingUp, TrendingDown, Minus, ChevronRight, AlertTriangle, X, Lock } from 'lucide-react';
import Link from 'next/link';
import { getAllTenants } from '@/tenants/config';

// ── Types ──────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  slug: string;
  saas_type: string;
  is_active: boolean;
  created_at: string;
  whatsapp_phone: string;
  is_demo?: boolean;
}

interface UserProfile {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  whatsapp_phone: string;
  tenant_id: string;
  role: string;
  created_at: string;
}

interface Stats {
  tenants: Tenant[];
  userCounts: Record<string, number>;
  totalUsers: number;
  saasUserCount?: number;
  saasUserCounts?: Record<string, number>;
  systemAdmins?: number;
  systemBots?: number;
  currentUserId?: string | null;
  demoTenantIds?: string[];
  users: UserProfile[];
}

type BadgeKey = 'system-admin' | 'system-bot' | 'demo-seed' | 'user';
interface UserBadge {
  key: BadgeKey;
  label: string;
  icon: string;
  className: string;
  riskNote?: string;
}

function classifyUser(u: UserProfile, demoIds: Set<string>): UserBadge {
  if (u.role === 'system') {
    return {
      key: 'system-bot',
      label: 'Otomatik Hesap',
      icon: '🤖',
      className: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      riskNote: 'Scraping durur',
    };
  }
  if (!u.tenant_id && (u.role === 'admin' || u.role === 'super_admin')) {
    return {
      key: 'system-admin',
      label: 'Platform Yöneticisi',
      icon: '🔐',
      className: 'bg-red-500/20 text-red-300 border border-red-500/30',
      riskNote: 'Sistemden çıkarsın',
    };
  }
  if (u.tenant_id && demoIds.has(u.tenant_id)) {
    return {
      key: 'demo-seed',
      label: 'Demo Veri',
      icon: '🏷',
      className: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    };
  }
  return {
    key: 'user',
    label: 'Kullanıcı',
    icon: '👤',
    className: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  };
}

interface InsightData {
  activeUsers: { today: number; week: number; month: number };
  commands: { today: number; week: number; trend: number };
  errors: { today: number; week: number };
  sales: { total: number; sold: number; rented: number };
  presentations: number;
  feedback: { avgRating: number | null; count: number };
  topCommands: { name: string; count: number }[];
  tenantBreakdown: { key: string; count: number }[];
  topUsers: { id: string; name: string; count: number }[];
  totalUsers: number;
  dailyActivity: { date: string; commands: number; errors: number }[];
}

type Tab = 'genel' | 'sistem' | 'insight';

// ── Main Component ─────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('genel');
  const [stats, setStats] = useState<Stats | null>(null);
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => { fetchStats(); }, []);

  useEffect(() => {
    if (tab === 'insight' && !insight) fetchInsight();
  }, [tab]);

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) setStats(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function fetchInsight() {
    setInsightLoading(true);
    try {
      const res = await fetch('/api/admin/insight');
      if (res.ok) setInsight(await res.json());
    } catch (err) { console.error(err); }
    finally { setInsightLoading(false); }
  }

  const [riskPending, setRiskPending] = useState<{ userId: string; name: string; badge: UserBadge } | null>(null);

  async function performDelete(userId: string) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) fetchStats();
    } catch (err) { console.error(err); }
  }

  function requestDelete(userId: string, name: string, badge: UserBadge) {
    if (badge.key === 'system-admin' || badge.key === 'system-bot') {
      setRiskPending({ userId, name, badge });
      return;
    }
    const msg = badge.key === 'demo-seed'
      ? `Demo seed verisi silinecek, emin misin?\n\n"${name}"`
      : `Silmek istedigine emin misin?\n\n"${name}"`;
    if (!confirm(msg)) return;
    void performDelete(userId);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Yukleniyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            <h1 className="text-xl font-bold">UPU Super Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/admin/test-identities"
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
            >
              🧪 Test Hesapları
            </a>
            <a
              href="/admin/tickets"
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
            >
              🛟 Destek
            </a>
            <span className="text-sm text-slate-400 hidden md:inline">adminpanel.upudev.nl</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          <button
            onClick={() => setTab('genel')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              tab === 'genel'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4 inline mr-1.5" />
            Genel
          </button>
          <button
            onClick={() => setTab('sistem')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              tab === 'sistem'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Lock className="w-4 h-4 inline mr-1.5" />
            Sistem
          </button>
          <button
            onClick={() => setTab('insight')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              tab === 'insight'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1.5" />
            Insight
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'genel' && <GenelTab stats={stats} />}
        {tab === 'sistem' && <SistemTab stats={stats} requestDelete={requestDelete} />}
        {tab === 'insight' && <InsightTab data={insight} loading={insightLoading} onRefresh={fetchInsight} />}
      </main>

      {riskPending && (
        <RiskDeleteModal
          pending={riskPending}
          onCancel={() => setRiskPending(null)}
          onConfirm={async () => {
            const id = riskPending.userId;
            setRiskPending(null);
            await performDelete(id);
          }}
        />
      )}
    </div>
  );
}

// ── Risk-Aware Delete Modal ────────────────────────────────────────

function RiskDeleteModal({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: { userId: string; name: string; badge: UserBadge };
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-xl border border-red-500/50 overflow-hidden">
        <div className="px-5 py-4 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-base font-semibold text-red-300">Yüksek Riskli Silme</h3>
          <button onClick={onCancel} className="ml-auto text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full ${pending.badge.className}`}>
              {pending.badge.icon} {pending.badge.label}
            </span>
            <span className="text-sm text-slate-300 font-medium truncate">{pending.name}</span>
          </div>
          <p className="text-sm text-slate-300">
            <strong className="text-red-300">{pending.badge.riskNote}.</strong> Devam et?
          </p>
          {!armed ? (
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
              >
                İptal
              </button>
              <button
                onClick={() => setArmed(true)}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-500/30 hover:bg-red-500/40 text-red-200 font-medium"
              >
                Anladım, devam et
              </button>
            </div>
          ) : (
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
              >
                İptal
              </button>
              <button
                onClick={onConfirm}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                GERÇEKTEN SİL
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Genel Tab ──────────────────────────────────────────────────────

function GenelTab({ stats }: { stats: Stats | null }) {
  // SaaS kategori grid — 7 sabit (config). Her birinin altındaki tenant
  // sayısı DB'den groupby saas_type ile, DEMO ayrı sayılır. Kullanıcı sayısı
  // stats.saasUserCounts (Redesign A) — kart başında müşteri+kullanıcı çifti.
  const saasCategories = useMemo(() => {
    const all = getAllTenants();
    const tenants = stats?.tenants || [];
    const userCounts = stats?.saasUserCounts || {};
    return all.map((cfg) => {
      const matched = tenants.filter((t) => t.saas_type === cfg.saasType);
      const demoCount = matched.filter((t) => t.is_demo).length;
      const realCount = matched.length - demoCount;
      return {
        key: cfg.key,
        name: cfg.name,
        slug: cfg.slug,
        icon: cfg.icon,
        color: cfg.color,
        description: cfg.description,
        tenantCount: matched.length,
        realCount,
        demoCount,
        userCount: userCounts[cfg.saasType] || 0,
      };
    });
  }, [stats]);

  const tenantsAll = stats?.tenants || [];
  const realMusteri = tenantsAll.filter((t) => !t.is_demo).length;
  const demoMusteri = tenantsAll.filter((t) => t.is_demo).length;
  const aktifReal = tenantsAll.filter((t) => !t.is_demo && t.is_active).length;

  return (
    <>
      {/* Summary Cards (4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <p className="text-xs text-slate-400">SaaS Kategorisi</p>
          </div>
          <p className="text-3xl font-bold">{saasCategories.length}</p>
          <p className="text-[10px] text-slate-500 mt-1">sabit (config)</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <p className="text-xs text-slate-400">Toplam Müşteri</p>
          </div>
          <p className="text-3xl font-bold">{realMusteri + demoMusteri}</p>
          <p className="text-[10px] text-slate-500 mt-1">{realMusteri} gerçek + {demoMusteri} demo</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <p className="text-xs text-slate-400">Aktif Müşteri</p>
          </div>
          <p className="text-3xl font-bold">{aktifReal}</p>
          <p className="text-[10px] text-slate-500 mt-1">gerçek + is_active=true</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-green-400" />
            <p className="text-xs text-slate-400">Kullanıcı (kişi)</p>
          </div>
          <p className="text-3xl font-bold">{stats?.saasUserCount ?? 0}</p>
          <p className="text-[10px] text-slate-500 mt-1">SaaS&apos;a bağlı, sistem hesapları hariç</p>
        </div>
      </div>

      {/* SaaS Kategori Grid */}
      <h2 className="text-lg font-semibold mb-1">SaaS Kategorileri</h2>
      <p className="text-xs text-slate-500 mb-4">
        7 sabit ürün kategorisi. Her kategorinin altındaki müşteri (tenant) sayısı DB&apos;den okunur.
        Yeni signup mevcut bir SaaS&apos;ın altına eklenir — yeni kategori oluşmaz.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {saasCategories.map((s) => (
          <Link
            key={s.key}
            href={`/admin/saas/${s.key}`}
            data-testid={`saas-card-${s.key}`}
            className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-slate-500 transition group"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <h3 className="font-semibold leading-tight">{s.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{s.slug}.upudev.nl</p>
                  </div>
                </div>
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: s.color }}
                  aria-hidden
                />
              </div>
              <p className="text-xs text-slate-500 mb-4 line-clamp-2">{s.description}</p>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-2xl font-bold">{s.tenantCount}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">müşteri</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-2xl font-bold text-green-300">{s.userCount}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">kullanıcı</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {s.realCount} gerçek + {s.demoCount} demo müşteri
                  </div>
                </div>
                <span className="text-indigo-400 group-hover:text-indigo-300 text-sm font-medium flex items-center gap-1 flex-shrink-0">
                  Detay <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

    </>
  );
}

// ── Sistem Tab ─────────────────────────────────────────────────────

function SistemTab({ stats, requestDelete }: {
  stats: Stats | null;
  requestDelete: (userId: string, name: string, badge: UserBadge) => void;
}) {
  const demoIds = useMemo(() => new Set(stats?.demoTenantIds || []), [stats?.demoTenantIds]);
  const platformAdmins = (stats?.users || []).filter(
    (u) => !u.tenant_id && (u.role === 'admin' || u.role === 'super_admin'),
  );
  const autoAccounts = (stats?.users || []).filter((u) => u.role === 'system');
  const currentUserId = stats?.currentUserId ?? null;

  return (
    <>
      <p className="text-sm text-slate-400 mb-6">
        Platform-seviye hesaplar. SaaS müşterilerine ait kullanıcılar burada gözükmez — onlar SaaS detayında.
      </p>

      <SistemTable
        icon="🔐"
        title="Platform Yöneticileri"
        emptyMsg="Henüz platform yöneticisi yok."
        rows={platformAdmins}
        demoIds={demoIds}
        currentUserId={currentUserId}
        requestDelete={requestDelete}
      />

      <div className="mt-8">
        <SistemTable
          icon="🤖"
          title="Otomatik Hesaplar"
          emptyMsg="Henüz otomatik hesap yok."
          rows={autoAccounts}
          demoIds={demoIds}
          currentUserId={currentUserId}
          requestDelete={requestDelete}
        />
      </div>
    </>
  );
}

function SistemTable({
  icon,
  title,
  emptyMsg,
  rows,
  demoIds,
  currentUserId,
  requestDelete,
}: {
  icon: string;
  title: string;
  emptyMsg: string;
  rows: UserProfile[];
  demoIds: Set<string>;
  currentUserId: string | null;
  requestDelete: (userId: string, name: string, badge: UserBadge) => void;
}) {
  return (
    <>
      <h2 className="text-lg font-semibold mb-3">{icon} {title} ({rows.length})</h2>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-750 border-b border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-400">Ad</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">E-posta</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">WhatsApp</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">Kayit</th>
                <th className="text-right px-4 py-3 font-medium text-slate-400">Islem</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">{emptyMsg}</td></tr>
              ) : (
                rows.map((u) => {
                  const badge = classifyUser(u, demoIds);
                  const isSelf = currentUserId !== null && u.id === currentUserId;
                  return (
                    <tr key={u.id} className="border-b border-slate-700 hover:bg-slate-750">
                      <td className="px-4 py-3 font-medium text-white">{u.display_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}>
                          {badge.icon} {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{u.email || '-'}</td>
                      <td className="px-4 py-3">
                        {u.whatsapp_phone ? (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">{u.whatsapp_phone}</span>
                        ) : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{new Date(u.created_at).toLocaleDateString('tr-TR')}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => !isSelf && requestDelete(u.id, u.display_name || 'Kullanici', badge)}
                          disabled={isSelf}
                          className={`p-1 ${isSelf ? 'text-slate-600 cursor-not-allowed' : 'text-red-400 hover:text-red-300'}`}
                          title={isSelf ? 'Kendinizi silemezsiniz' : (badge.riskNote ? `Sil — ${badge.riskNote}` : 'Sil')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Insight Tab ────────────────────────────────────────────────────

function InsightTab({ data, loading, onRefresh }: { data: InsightData | null; loading: boolean; onRefresh: () => void }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400">Veriler yukleniyor...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500">Veri yuklenemedi.</p>
      </div>
    );
  }

  const TrendIcon = data.commands.trend > 0 ? TrendingUp : data.commands.trend < 0 ? TrendingDown : Minus;
  const trendColor = data.commands.trend > 0 ? 'text-green-400' : data.commands.trend < 0 ? 'text-red-400' : 'text-slate-400';
  const maxCmd = Math.max(...data.dailyActivity.map(d => d.commands), 1);

  return (
    <div className="space-y-6">
      {/* Refresh button */}
      <div className="flex justify-end">
        <button onClick={onRefresh} className="text-sm text-slate-400 hover:text-slate-300 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> Yenile
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Aktif Kullanici (Bugun)" value={data.activeUsers.today} icon={<Users className="w-5 h-5 text-green-400" />} />
        <MetricCard label="Aktif Kullanici (Hafta)" value={data.activeUsers.week} icon={<Users className="w-5 h-5 text-blue-400" />} />
        <MetricCard label="Komut (Bugun)" value={data.commands.today} icon={<Activity className="w-5 h-5 text-indigo-400" />} />
        <MetricCard label="Hata (Hafta)" value={data.errors.week} icon={<Activity className="w-5 h-5 text-red-400" />}
          highlight={data.errors.week > 10 ? 'red' : undefined} />
      </div>

      {/* Trend + Sales + Rating */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-2">Haftalik Trend</p>
          <div className="flex items-center gap-2">
            <TrendIcon className={`w-6 h-6 ${trendColor}`} />
            <span className={`text-2xl font-bold ${trendColor}`}>
              {data.commands.trend > 0 ? '+' : ''}{data.commands.trend}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Bu hafta: {data.commands.week} komut</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-2">Satis / Kiralama (30g)</p>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-green-400">{data.sales.total}</span>
            <span className="text-xs text-slate-500">
              {data.sales.sold > 0 && `${data.sales.sold} satis`}
              {data.sales.sold > 0 && data.sales.rented > 0 && ' + '}
              {data.sales.rented > 0 && `${data.sales.rented} kira`}
            </span>
          </div>
          {data.presentations > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              {data.presentations} sunum — donusum ~%{data.sales.total > 0 ? Math.round((data.sales.total / data.presentations) * 100) : 0}
            </p>
          )}
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-2">Sistem Puani</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">
              {data.feedback.avgRating !== null ? `${data.feedback.avgRating}/10` : '—'}
            </span>
            <span className="text-xs text-slate-500">{data.feedback.count} degerlendirme</span>
          </div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <p className="text-sm text-slate-400 mb-4">Gunluk Aktivite (Son 14 Gun)</p>
        <div className="flex items-end gap-1 h-32">
          {data.dailyActivity.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col-reverse" style={{ height: '100px' }}>
                <div
                  className="w-full bg-indigo-500/60 rounded-t"
                  style={{ height: `${Math.max((day.commands / maxCmd) * 100, 2)}%` }}
                  title={`${day.date}: ${day.commands} komut, ${day.errors} hata`}
                />
              </div>
              <span className="text-[9px] text-slate-500">{day.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom grid: Top Commands, Tenants, Users */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top Commands */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-3">En Cok Kullanilan Komutlar</p>
          <div className="space-y-2">
            {data.topCommands.map((cmd) => (
              <div key={cmd.name} className="flex justify-between items-center">
                <span className="text-sm text-slate-300">{cmd.name}</span>
                <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">{cmd.count}</span>
              </div>
            ))}
            {data.topCommands.length === 0 && <p className="text-xs text-slate-500">Henuz veri yok</p>}
          </div>
        </div>

        {/* Tenant Breakdown */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-3">Tenant Dagilimi (Hafta)</p>
          <div className="space-y-2">
            {data.tenantBreakdown.map((t) => (
              <div key={t.key} className="flex justify-between items-center">
                <span className="text-sm text-slate-300">{t.key}</span>
                <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">{t.count}</span>
              </div>
            ))}
            {data.tenantBreakdown.length === 0 && <p className="text-xs text-slate-500">Henuz veri yok</p>}
          </div>
        </div>

        {/* Top Users */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 mb-3">En Aktif Kullanicilar (30g)</p>
          <div className="space-y-2">
            {data.topUsers.map((u, i) => (
              <div key={u.id} className="flex justify-between items-center">
                <span className="text-sm text-slate-300">
                  <span className="text-slate-500 mr-1.5">{i + 1}.</span>
                  {u.name}
                </span>
                <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">{u.count}</span>
              </div>
            ))}
            {data.topUsers.length === 0 && <p className="text-xs text-slate-500">Henuz veri yok</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Metric Card ────────────────────────────────────────────────────

function MetricCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: 'red' }) {
  return (
    <div className={`bg-slate-800 rounded-xl p-5 border ${highlight === 'red' ? 'border-red-500/50' : 'border-slate-700'}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs text-slate-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${highlight === 'red' ? 'text-red-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}
