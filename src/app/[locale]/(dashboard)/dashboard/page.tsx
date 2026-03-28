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
  const common = [
    { title: 'Kullanıcılar', value: m.totalUsers, icon: Users, color: 'text-blue-500' },
    { title: 'Aktif Abonelik', value: m.activeSubscriptions, icon: Building2, color: 'text-green-500' },
    { title: 'Toplam Komut', value: m.totalCommands, icon: MessageSquare, color: 'text-purple-500' },
  ];

  switch (tenantKey) {
    case 'emlak':
      return [
        ...common,
        { title: 'Mülkler', value: m.propertyCount ?? '-', icon: Home, color: 'text-indigo-500' },
        { title: 'Müşteriler', value: m.customerCount ?? '-', icon: ClipboardList, color: 'text-orange-500' },
      ];
    case 'bayi':
      return [
        ...common,
        { title: 'Siparişler', value: m.orderCount ?? '-', icon: Package, color: 'text-orange-500' },
        { title: 'Kritik Stok', value: m.stockAlerts ?? '-', icon: AlertTriangle, color: 'text-red-500' },
        { title: 'Teslimatlar', value: '-', icon: Truck, color: 'text-cyan-500' },
      ];
    case 'muhasebe':
      return [
        ...common,
        { title: 'Faturalar', value: m.invoiceCount ?? '-', icon: FileText, color: 'text-orange-500' },
        { title: 'Mükellefler', value: '-', icon: CreditCard, color: 'text-teal-500' },
      ];
    case 'otel':
      return [
        ...common,
        { title: 'Rezervasyonlar', value: m.reservationCount ?? '-', icon: Hotel, color: 'text-orange-500' },
        { title: 'Odalar', value: m.roomCount ?? '-', icon: Building2, color: 'text-cyan-500' },
      ];
    case 'siteyonetim':
      return [
        ...common,
        { title: 'Arızalar', value: m.complaintCount ?? '-', icon: AlertTriangle, color: 'text-red-500' },
        { title: 'Raporlar', value: '-', icon: BarChart3, color: 'text-teal-500' },
      ];
    case 'market':
      return [
        ...common,
        { title: 'Ürünler', value: m.productCount ?? '-', icon: ShoppingCart, color: 'text-orange-500' },
        { title: 'Kritik Stok', value: m.stockAlerts ?? '-', icon: AlertTriangle, color: 'text-red-500' },
      ];
    default:
      return [
        ...common,
        { title: 'Bu Ay', value: '-', icon: TrendingUp, color: 'text-orange-500' },
      ];
  }
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [tenantKey, setTenantKey] = useState('emlak');

  useEffect(() => {
    const hostname = window.location.host;
    const tenant = getTenantByDomain(hostname) || getTenantByKey('emlak');
    if (tenant) setTenantKey(tenant.key);

    fetch('/api/dashboard/metrics')
      .then(res => res.json())
      .then(setMetrics)
      .catch(console.error);
  }, []);

  const tenant = getTenantByKey(tenantKey);
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
              <CardTitle className="text-sm font-medium text-slate-500">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Son Aktiviteler</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Henüz aktivite bulunmuyor.</p>
        </CardContent>
      </Card>
    </div>
  );
}
