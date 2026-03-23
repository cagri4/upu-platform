'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { TenantConfig } from '@/tenants/config';
import {
  LayoutDashboard, Settings, CreditCard, Users, X, ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  tenant: TenantConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_ITEMS = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/users', label: 'Kullanıcılar', icon: Users },
  { href: '/billing', label: 'Abonelik', icon: CreditCard },
  { href: '/settings', label: 'Ayarlar', icon: Settings },
];

export function Sidebar({ tenant, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const name = tenant?.name || 'UPU Platform';
  const icon = tenant?.icon || '🚀';

  function isActive(href: string) {
    return pathname.includes(href);
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white border-r border-slate-700
        transform transition-transform duration-200
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <span className="font-semibold text-sm">{name}</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 60px)' }}>
          {/* Common navigation */}
          {COMMON_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={`/tr${item.href}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                isActive(item.href) ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-300 hover:bg-slate-800'
              }`}
              onClick={onClose}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}

          {/* Virtual Employees */}
          {tenant?.employees && tenant.employees.length > 0 && (
            <>
              <div className="pt-4 pb-2 px-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Sanal Elemanlar</p>
              </div>
              {tenant.employees.map((emp) => (
                <div key={emp.key}>
                  <button
                    onClick={() => setExpandedEmployee(expandedEmployee === emp.key ? null : emp.key)}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition"
                  >
                    <span className="flex items-center gap-2">
                      <span>{emp.icon}</span>
                      <span>{emp.name}</span>
                    </span>
                    <ChevronRight
                      size={14}
                      className={`transition-transform ${expandedEmployee === emp.key ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {expandedEmployee === emp.key && (
                    <div className="ml-8 space-y-0.5 mb-1">
                      {emp.commands.map((cmd) => (
                        <div key={cmd} className="text-xs text-slate-500 px-2 py-1">
                          {cmd}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
