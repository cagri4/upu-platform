'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { TenantConfig } from '@/tenants/config';
import {
  LayoutDashboard, Settings, X, ChevronRight, User, Building2, Phone, MapPin,
  Home, Users, Target, Clock, BarChart3, FileText, UserCog,
} from 'lucide-react';

interface SidebarProps {
  tenant: TenantConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_ITEMS = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/settings', label: 'Ayarlar', icon: Settings },
];

// Tenant-specific nav items — emlak gets the full panel
const EMLAK_ITEMS = [
  { href: '/dashboard',  label: 'Panel',         icon: LayoutDashboard },
  { href: '/quest',      label: 'Görevlerim',    icon: Target },
  { href: '/properties', label: 'Mülklerim',     icon: Home },
  { href: '/customers',  label: 'Müşterilerim',  icon: Users },
  { href: '/reminders',  label: 'Hatırlatmalar', icon: Clock },
  { href: '/contracts',  label: 'Sözleşmeler',   icon: FileText },
  { href: '/reports',    label: 'Rapor',         icon: BarChart3 },
  { href: '/agents',     label: 'Elemanlarım',   icon: UserCog },
  { href: '/settings',   label: 'Ayarlar',       icon: Settings },
];

interface DealerInfo {
  role: string;
  dealerName?: string;
  contactName?: string;
  city?: string;
  phone?: string;
}

export function Sidebar({ tenant, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [dealerInfo, setDealerInfo] = useState<DealerInfo | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem('upu_user_id');
    if (userId) {
      fetch(`/api/auth/user-role?userId=${userId}`)
        .then(r => r.json())
        .then(data => {
          if (data.role === 'dealer' && data.dealerId) {
            // Fetch dealer details
            fetch(`/api/dashboard/dealer?userId=${userId}&section=balance`)
              .then(r => r.json())
              .then(bal => {
                setDealerInfo({
                  role: 'dealer',
                  dealerName: bal.dealerName || '',
                  city: '',
                  phone: '',
                });
              })
              .catch(() => setDealerInfo({ role: 'dealer' }));
          } else {
            setDealerInfo({ role: data.role || 'admin' });
          }
        })
        .catch(() => {});
    }
  }, []);

  const isDealer = dealerInfo?.role === 'dealer';
  const name = isDealer ? (dealerInfo?.dealerName || 'Bayi Paneli') : (tenant?.name || 'UPU Platform');
  const icon = isDealer ? '🏪' : (tenant?.icon || '🚀');

  function isActive(href: string) {
    return pathname.includes(href);
  }

  // Dealer: minimal. Emlak: full panel. Others: common.
  const navItems = isDealer
    ? [{ href: '/dashboard', label: 'Panel', icon: LayoutDashboard }]
    : tenant?.key === 'emlak'
      ? EMLAK_ITEMS
      : COMMON_ITEMS;

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
          {navItems.map((item) => (
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

          {/* Dealer: show dealer info instead of employees */}
          {isDealer && (
            <>
              <div className="pt-4 pb-2 px-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Bayi Bilgileri</p>
              </div>
              <div className="px-3 py-2 space-y-2">
                {dealerInfo?.dealerName && (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Building2 size={14} className="text-slate-500" />
                    <span>{dealerInfo.dealerName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <User size={14} className="text-slate-500" />
                  <span>{localStorage.getItem('upu_user_name') || 'Bayi'}</span>
                </div>
              </div>

              <div className="pt-3 pb-2 px-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Hizli Erisim</p>
              </div>
              {[
                { label: 'Katalog', tab: 'catalog', emoji: '📦' },
                { label: 'Sepetim', tab: 'cart', emoji: '🛒' },
                { label: 'Siparislerim', tab: 'orders', emoji: '📋' },
                { label: 'Bakiye', tab: 'balance', emoji: '💰' },
              ].map(item => (
                <Link
                  key={item.tab}
                  href={`/tr/dashboard`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition"
                  onClick={onClose}
                >
                  <span>{item.emoji}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}

          {/* Admin: Virtual Employees */}
          {!isDealer && tenant?.employees && tenant.employees.length > 0 && (
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
