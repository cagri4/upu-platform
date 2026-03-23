'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { getTenantByKey } from '@/tenants/config';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // For now, default to emlak tenant (will be dynamic from auth context later)
  const tenant = getTenantByKey('emlak');

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
