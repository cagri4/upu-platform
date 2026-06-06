'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Layers, Activity, Trash2, BarChart3, TrendingUp, TrendingDown, Minus, ChevronRight, Shield } from 'lucide-react';
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
  orphanAdmins?: number;
  demoTenantIds?: string[];
  users: UserProfile[];
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

type Tab = 'genel' | 'insight';

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

  async function deleteUser(userId: string, name: string) {
    if (!confirm(`"${name}" silinecek. Emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) fetchStats();
    } catch (err) { console.error(err); }
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
        {tab === 'genel' && <GenelTab stats={stats} deleteUser={deleteUser} />}
        {tab === 'insight' && <InsightTab data={insight} loading={insightLoading} onRefresh={fetchInsight} />}
      </main>
    </div>
  );
}

// ── Genel Tab ──────────────────────────────────────────────────────

function GenelTab({ stats, deleteUser }: {
  stats: Stats | null;
  deleteUser: (userId: string, name: string) => void;
}) {
  // SaaS kategori grid — 7 sabit (config). Her birinin altındaki tenant
  // (müşteri) sayısı DB'den groupby saas_type ile, DEMO ayrı sayılır
  // (KATMAN C2 2026-06-06).
  const saasCategories = useMemo(() => {
    const all = getAllTenants();
    const tenants = stats?.tenants || [];
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
      };
    });
  }, [stats]);

  const tenantsAll = stats?.tenants || [];
  const realMusteri = tenantsAll.filter((t) => !t.is_demo).length;
  const demoMusteri = tenantsAll.filter((t) => t.is_demo).length;
  const aktifReal = tenantsAll.filter((t) => !t.is_demo && t.is_active).length;
  const orphanAdmins = stats?.orphanAdmins ?? 0;

  return (
    <>
      {/* Summary Cards (5) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
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
            <p className="text-xs text-slate-400">Toplam Kullanıcı</p>
          </div>
          <p className="text-3xl font-bold">{stats?.totalUsers || 0}</p>
          <p className="text-[10px] text-slate-500 mt-1">sistem hariç</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <p className="text-xs text-slate-400">Sistem Adminleri</p>
          </div>
          <p className="text-3xl font-bold">{orphanAdmins}</p>
          <p className="text-[10px] text-slate-500 mt-1">tabloda gizli, silinme koruması</p>
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
                <div>
                  <div className="text-2xl font-bold">{s.tenantCount}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                    müşteri ({s.realCount} gerçek + {s.demoCount} demo)
                  </div>
                </div>
                <span className="text-indigo-400 group-hover:text-indigo-300 text-sm font-medium flex items-center gap-1">
                  Detay <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* All Users Table — backend totalUsers ile birebir filter (KATMAN C3) */}
      <h2 className="text-lg font-semibold mt-10 mb-4">Tum Kullanicilar ({stats?.totalUsers ?? 0})</h2>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-750 border-b border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-400">Ad</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">E-posta</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">WhatsApp</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">Müşteri (Tenant)</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">Kayit</th>
                <th className="text-right px-4 py-3 font-medium text-slate-400">Islem</th>
              </tr>
            </thead>
            <tbody>
              {(!stats?.users || stats.users.length === 0) ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Henuz kullanici yok</td></tr>
              ) : (
                stats.users.filter((u) => u.role !== 'system' && u.tenant_id !== null).map((u) => {
                  const tenantName = stats.tenants.find(t => t.id === u.tenant_id)?.name || '-';
                  return (
                    <tr key={u.id} className="border-b border-slate-700 hover:bg-slate-750">
                      <td className="px-4 py-3 font-medium text-white">{u.display_name || '-'}</td>
                      <td className="px-4 py-3 text-slate-400">{u.email || '-'}</td>
                      <td className="px-4 py-3">
                        {u.whatsapp_phone ? (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">{u.whatsapp_phone}</span>
                        ) : <span className="text-slate-600 dark:text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{tenantName}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(u.created_at).toLocaleDateString('tr-TR')}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteUser(u.id, u.display_name || 'Kullanici')}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Sil"
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
