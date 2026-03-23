'use client';

import { useEffect, useState } from 'react';

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

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-xl font-bold">UPU Super Admin</h1>
          <span className="text-sm text-slate-400">adminpanel.upudev.nl</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-sm text-slate-400 mb-1">Toplam SaaS</p>
            <p className="text-3xl font-bold">{stats?.tenants.length || 0}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-sm text-slate-400 mb-1">Toplam Kullanıcı</p>
            <p className="text-3xl font-bold">{stats?.totalUsers || 0}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-sm text-slate-400 mb-1">Aktif SaaS</p>
            <p className="text-3xl font-bold">{stats?.tenants.filter(t => t.is_active).length || 0}</p>
          </div>
        </div>

        {/* Tenant List */}
        <h2 className="text-lg font-semibold mb-4">SaaS Projeleri</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats?.tenants.map((tenant) => (
            <div key={tenant.id} className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-500 transition">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{tenant.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${tenant.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {tenant.is_active ? 'Aktif' : 'Pasif'}
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-2">{tenant.slug}.upudev.nl</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Kullanıcı: {stats.userCounts[tenant.id] || 0}</span>
                <a
                  href={`https://${tenant.slug}.upudev.nl`}
                  target="_blank"
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  Aç →
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
