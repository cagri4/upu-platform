'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTenantByDomain, getTenantByKey } from '@/tenants/config';
import {
  Users, Building2, MessageSquare, TrendingUp,
  Home, Package, FileText, Hotel,
  ShoppingCart, ClipboardList, AlertTriangle,
  Truck, CreditCard, BarChart3,
} from 'lucide-react';
import BayiDashboardContent from './bayi-content';
import DealerDashboardContent from './dealer-content';

interface DashboardMetrics {
  totalUsers: number;
  activeSubscriptions: number;
  totalCommands: number;
  tenantName: string;
  // Tenant-specific
  propertyCount?: number;
  customerCount?: number;
  orderCount?: number;
  stockAlerts?: number;
  invoiceCount?: number;
  reservationCount?: number;
  roomCount?: number;
  complaintCount?: number;
  productCount?: number;
}

function getTenantCards(tenantKey: string, m: DashboardMetrics) {
  switch (tenantKey) {
    case 'emlak':
      return [
        { title: 'Mülklerim', value: m.propertyCount ?? 0, icon: Home, color: 'text-indigo-500' },
        { title: 'Müşterilerim', value: m.customerCount ?? 0, icon: ClipboardList, color: 'text-orange-500' },
        { title: 'Komutlarım', value: m.totalCommands, icon: MessageSquare, color: 'text-purple-500' },
      ];
    case 'bayi':
      return [
        { title: 'Siparişlerim', value: m.orderCount ?? 0, icon: Package, color: 'text-orange-500' },
        { title: 'Kritik Stok', value: m.stockAlerts ?? 0, icon: AlertTriangle, color: 'text-red-500' },
        { title: 'Komutlarım', value: m.totalCommands, icon: MessageSquare, color: 'text-purple-500' },
      ];
    case 'muhasebe':
      return [
        { title: 'Faturalarım', value: m.invoiceCount ?? 0, icon: FileText, color: 'text-orange-500' },
        { title: 'Komutlarım', value: m.totalCommands, icon: MessageSquare, color: 'text-purple-500' },
      ];
    case 'otel':
      return [
        { title: 'Rezervasyonlar', value: m.reservationCount ?? 0, icon: Hotel, color: 'text-orange-500' },
        { title: 'Odalar', value: m.roomCount ?? 0, icon: Building2, color: 'text-cyan-500' },
        { title: 'Komutlarım', value: m.totalCommands, icon: MessageSquare, color: 'text-purple-500' },
      ];
    case 'siteyonetim':
      return [
        { title: 'Arızalar', value: m.complaintCount ?? 0, icon: AlertTriangle, color: 'text-red-500' },
        { title: 'Komutlarım', value: m.totalCommands, icon: MessageSquare, color: 'text-purple-500' },
      ];
    case 'market':
      return [
        { title: 'Ürünlerim', value: m.productCount ?? 0, icon: ShoppingCart, color: 'text-orange-500' },
        { title: 'Kritik Stok', value: m.stockAlerts ?? 0, icon: AlertTriangle, color: 'text-red-500' },
        { title: 'Komutlarım', value: m.totalCommands, icon: MessageSquare, color: 'text-purple-500' },
      ];
    default:
      return [
        { title: 'Komutlarım', value: m.totalCommands, icon: MessageSquare, color: 'text-purple-500' },
      ];
  }
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [tenantKey, setTenantKey] = useState('emlak');
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const hostname = window.location.host;
    const tenant = getTenantByDomain(hostname) || getTenantByKey('emlak');
    if (tenant) setTenantKey(tenant.key);

    const storedUserId = localStorage.getItem('upu_user_id');
    if (storedUserId) {
      setUserId(storedUserId);
      // Fetch user role
      fetch(`/api/auth/user-role?userId=${storedUserId}`)
        .then(r => r.json())
        .then(d => { if (d.role) setUserRole(d.role); })
        .catch(() => {});
    }

    fetch('/api/dashboard/metrics')
      .then(res => res.json())
      .then(setMetrics)
      .catch(console.error);
  }, []);

  const tenant = getTenantByKey(tenantKey);

  // Dealer gets catalog/order dashboard
  if (tenantKey === 'bayi' && userId && userRole === 'dealer') {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          {tenant?.icon} Bayi Paneli
        </h1>
        <DealerDashboardContent userId={userId} />
      </div>
    );
  }

  // Bayi admin gets full dashboard
  if (tenantKey === 'bayi' && userId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          {tenant?.icon} {tenant?.name || 'Panel'}
        </h1>
        <BayiDashboardContent userId={userId} />
      </div>
    );
  }

  const cards = metrics ? getTenantCards(tenantKey, metrics) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        {tenant?.icon} {tenant?.name || 'Panel'}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Son Aktiviteler</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Henuz aktivite bulunmuyor.</p>
        </CardContent>
      </Card>
    </div>
  );
}
