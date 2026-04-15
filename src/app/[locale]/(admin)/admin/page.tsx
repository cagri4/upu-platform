'use client';

import { useEffect, useState } from 'react';
import { UserPlus, ExternalLink, Copy, Check, Users, Layers, Activity, Trash2, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  slug: string;
  saas_type: string;
  is_active: boolean;
  created_at: string;
  whatsapp_phone: string;
}

interface UserProfile {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  whatsapp_phone: string;
  tenant_id: string;
  created_at: string;
}

interface Stats {
  tenants: Tenant[];
  userCounts: Record<string, number>;
  totalUsers: number;
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
  const [inviteLinks, setInviteLinks] = useState<Record<string, { code: string; usedCount: number; maxUses: number | null }>>({});
  const [linkLoading, setLinkLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  async function getOrCreateLink(tenantId: string) {
    setLinkLoading(tenantId);
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, type: 'link' }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteLinks(prev => ({ ...prev, [tenantId]: { code: data.code, usedCount: data.usedCount, maxUses: data.maxUses } }));
      }
    } catch (err) { console.error(err); }
    finally { setLinkLoading(null); }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
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
          <span className="text-sm text-slate-400">adminpanel.upudev.nl</span>
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
        {tab === 'genel' && <GenelTab stats={stats} inviteLinks={inviteLinks}
          linkLoading={linkLoading} getOrCreateLink={getOrCreateLink}
          copied={copied} copyToClipboard={copyToClipboard} deleteUser={deleteUser} />}
        {tab === 'insight' && <InsightTab data={insight} loading={insightLoading} onRefresh={fetchInsight} />}
      </main>
    </div>
  );
}

// ── Genel Tab ──────────────────────────────────────────────────────

function GenelTab({ stats, inviteLinks, linkLoading, getOrCreateLink, copied, copyToClipboard, deleteUser }: {
  stats: Stats | null;
  inviteLinks: Record<string, { code: string; usedCount: number; maxUses: number | null }>;
  linkLoading: string | null;
  getOrCreateLink: (tenantId: string) => void;
  copied: string | null;
  copyToClipboard: (text: string, key: string) => void;
  deleteUser: (userId: string, name: string) => void;
}) {
  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <p className="text-sm text-slate-400">Toplam SaaS</p>
          </div>
          <p className="text-3xl font-bold">{stats?.tenants.length || 0}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-green-400" />
            <p className="text-sm text-slate-400">Toplam Kullanici</p>
          </div>
          <p className="text-3xl font-bold">{stats?.totalUsers || 0}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-slate-400">Aktif SaaS</p>
          </div>
          <p className="text-3xl font-bold">{stats?.tenants.filter(t => t.is_active).length || 0}</p>
        </div>
      </div>

      {/* Tenant Cards */}
      <h2 className="text-lg font-semibold mb-4">SaaS Projeleri</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats?.tenants.map((tenant) => (
          <div key={tenant.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{tenant.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${tenant.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {tenant.is_active ? 'Aktif' : 'Pasif'}
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-3">{tenant.slug}.upudev.nl</p>
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-slate-500">Kullanici: {stats.userCounts[tenant.id] || 0}</span>
                <a href={`https://${tenant.slug}.upudev.nl`} target="_blank" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" /> Ac
                </a>
              </div>
              {!inviteLinks[tenant.id] ? (
                <button
                  onClick={() => getOrCreateLink(tenant.id)}
                  disabled={linkLoading === tenant.id}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition text-sm disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  {linkLoading === tenant.id ? 'Olusturuluyor...' : 'Davet Linki Olustur'}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Davet Kodu:</span>
                      <span className="font-mono text-sm font-bold text-green-300">{inviteLinks[tenant.id].code}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Kullanim: {inviteLinks[tenant.id].usedCount}{inviteLinks[tenant.id].maxUses ? `/${inviteLinks[tenant.id].maxUses}` : ' (sinirsiz)'}</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => {
                          const waLink = `https://wa.me/${tenant.whatsapp_phone}?text=${encodeURIComponent(inviteLinks[tenant.id].code)}`;
                          copyToClipboard(waLink, `wa-${tenant.id}`);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition text-xs"
                      >
                        {copied === `wa-${tenant.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === `wa-${tenant.id}` ? 'Kopyalandi!' : 'wa.me Linki Kopyala'}
                      </button>
                      <button
                        onClick={() => copyToClipboard(inviteLinks[tenant.id].code, `code-${tenant.id}`)}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition text-xs"
                      >
                        {copied === `code-${tenant.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        Kod
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* All Users Table */}
      <h2 className="text-lg font-semibold mt-10 mb-4">Tum Kullanicilar ({stats?.users?.length || 0})</h2>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-750 border-b border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-400">Ad</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">E-posta</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">WhatsApp</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">SaaS</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">Kayit</th>
                <th className="text-right px-4 py-3 font-medium text-slate-400">Islem</th>
              </tr>
            </thead>
            <tbody>
              {(!stats?.users || stats.users.length === 0) ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Henuz kullanici yok</td></tr>
              ) : (
                stats.users.map((u) => {
                  const tenantName = stats.tenants.find(t => t.id === u.tenant_id)?.name || '-';
                  return (
                    <tr key={u.id} className="border-b border-slate-700 hover:bg-slate-750">
                      <td className="px-4 py-3 font-medium text-white">{u.display_name || '-'}</td>
                      <td className="px-4 py-3 text-slate-400">{u.email || '-'}</td>
                      <td className="px-4 py-3">
                        {u.whatsapp_phone ? (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">{u.whatsapp_phone}</span>
                        ) : <span className="text-slate-600">-</span>}
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
