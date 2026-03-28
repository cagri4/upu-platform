'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { getTenantByDomain, getTenantByKey, type TenantConfig } from '@/tenants/config';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenant, setTenant] = useState<TenantConfig | null>(null);

  useEffect(() => {
    const hostname = window.location.host;
    const resolved = getTenantByDomain(hostname) || getTenantByKey('emlak');
    setTenant(resolved);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        tenant={tenant}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
