'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, MessageSquare, TrendingUp } from 'lucide-react';

interface DashboardMetrics {
  totalUsers: number;
  activeSubscriptions: number;
  totalCommands: number;
  tenantName: string;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then(res => res.json())
      .then(setMetrics)
      .catch(console.error);
  }, []);

  const cards = [
    { title: 'Kullanıcılar', value: metrics?.totalUsers || 0, icon: Users, color: 'text-blue-500' },
    { title: 'Aktif Abonelik', value: metrics?.activeSubscriptions || 0, icon: Building2, color: 'text-green-500' },
    { title: 'Toplam Komut', value: metrics?.totalCommands || 0, icon: MessageSquare, color: 'text-purple-500' },
    { title: 'Bu Ay', value: '-', icon: TrendingUp, color: 'text-orange-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Panel</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
