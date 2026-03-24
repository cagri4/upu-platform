'use client';

import { useEffect, useState } from 'react';
import { UserPlus, ExternalLink, Copy, Check, Users, Layers, Activity } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  saas_type: string;
  is_active: boolean;
  created_at: string;
}

interface Stats {
  tenants: Tenant[];
  userCounts: Record<string, number>;
  totalUsers: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '' });
  const [creating, setCreating] = useState(false);
  const [lastResult, setLastResult] = useState<{ code: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) setStats(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function createInvite(tenantId: string) {
    if (!inviteForm.name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...inviteForm }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastResult({ code: data.inviteCode, name: data.name });
        setInviteForm({ name: '', email: '', phone: '' });
        fetchStats();
      }
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Yükleniyor...</p>
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

      <main className="max-w-7xl mx-auto px-6 py-8">
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
              <p className="text-sm text-slate-400">Toplam Kullanıcı</p>
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
                  <span className="text-slate-500">Kullanıcı: {stats.userCounts[tenant.id] || 0}</span>
                  <a href={`https://${tenant.slug}.upudev.nl`} target="_blank" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5" /> Aç
                  </a>
                </div>
                <button
                  onClick={() => { setShowInvite(showInvite === tenant.id ? null : tenant.id); setLastResult(null); }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition text-sm"
                >
                  <UserPlus className="w-4 h-4" /> Kullanıcı Ekle
                </button>
              </div>

              {/* Invite form */}
              {showInvite === tenant.id && (
                <div className="border-t border-slate-700 p-5 bg-slate-850">
                  <div className="space-y-3">
                    <input
                      placeholder="Ad Soyad *"
                      value={inviteForm.name}
                      onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      placeholder="E-posta"
                      value={inviteForm.email}
                      onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      placeholder="Telefon"
                      value={inviteForm.phone}
                      onChange={e => setInviteForm({ ...inviteForm, phone: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => createInvite(tenant.id)}
                      disabled={creating || !inviteForm.name}
                      className="w-full py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition disabled:opacity-50"
                    >
                      {creating ? 'Oluşturuluyor...' : 'Oluştur'}
                    </button>

                    {lastResult && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-2">
                        <p className="text-sm text-green-400">{lastResult.name} oluşturuldu!</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Kod:</span>
                          <span className="font-mono text-lg font-bold text-green-300">{lastResult.code}</span>
                          <button onClick={() => copyToClipboard(lastResult.code)} className="text-green-400 hover:text-green-300">
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400">WhatsApp Davet Linki:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <a
                              href={`https://wa.me/31644967207?text=${encodeURIComponent(`Kayit Kodu: ${lastResult.code}`)}`}
                              target="_blank"
                              className="text-sm text-indigo-400 hover:text-indigo-300 underline break-all"
                            >
                              wa.me link
                            </a>
                            <button
                              onClick={() => copyToClipboard(`https://wa.me/31644967207?text=${encodeURIComponent(`Kayit Kodu: ${lastResult.code}`)}`)}
                              className="text-indigo-400 hover:text-indigo-300"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
