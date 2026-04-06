'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, Package, AlertTriangle, TrendingUp,
  Truck, CreditCard, ShoppingCart, Clock,
} from 'lucide-react';

interface BayiData {
  summary: {
    totalDealers: number;
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    totalRevenue: number;
    criticalStockCount: number;
    totalDebt: number;
  };
  dealers: Array<{
    id: string; name: string; city: string; district: string;
    phone: string; status: string; balance: number; created_at: string;
  }>;
  recentOrders: Array<{
    id: string; dealer_name: string; status: string;
    total_amount: number; created_at: string; notes: string;
  }>;
  criticalStock: Array<{
    id: string; name: string; sku: string; stock_quantity: number;
    min_stock: number; unit_price: number; category: string;
  }>;
  collections: Array<{
    id: string; name: string; balance: number;
  }>;
  recentActivity: Array<{
    action: string; detail: string; created_at: string;
  }>;
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(n);
}

function statusLabel(s: string): { text: string; color: string } {
  const map: Record<string, { text: string; color: string }> = {
    pending: { text: "Beklemede", color: "bg-yellow-100 text-yellow-700" },
    beklemede: { text: "Beklemede", color: "bg-yellow-100 text-yellow-700" },
    confirmed: { text: "Onaylandı", color: "bg-blue-100 text-blue-700" },
    onaylandi: { text: "Onaylandı", color: "bg-blue-100 text-blue-700" },
    shipped: { text: "Kargoda", color: "bg-purple-100 text-purple-700" },
    completed: { text: "Tamamlandı", color: "bg-green-100 text-green-700" },
    tamamlandi: { text: "Tamamlandı", color: "bg-green-100 text-green-700" },
    cancelled: { text: "İptal", color: "bg-red-100 text-red-700" },
    active: { text: "Aktif", color: "bg-green-100 text-green-700" },
    aktif: { text: "Aktif", color: "bg-green-100 text-green-700" },
    passive: { text: "Pasif", color: "bg-gray-100 text-gray-700" },
  };
  return map[s] || { text: s, color: "bg-gray-100 text-gray-700" };
}

export default function BayiDashboardContent({ userId }: { userId: string }) {
  const [data, setData] = useState<BayiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dealers' | 'orders' | 'stock' | 'collections'>('dealers');

  useEffect(() => {
    fetch(`/api/dashboard/bayi?userId=${userId}`)
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="text-slate-500 py-8">Veriler yukleniyor...</p>;
  if (!data) return <p className="text-slate-500 py-8">Veri yuklenemedi.</p>;

  const s = data.summary;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryCard title="Bayiler" value={s.totalDealers} icon={Users} color="text-blue-500" />
        <SummaryCard title="Toplam Siparis" value={s.totalOrders} icon={Package} color="text-purple-500" />
        <SummaryCard title="Bekleyen" value={s.pendingOrders} icon={Clock} color="text-yellow-500" />
        <SummaryCard title="Tamamlanan" value={s.completedOrders} icon={ShoppingCart} color="text-green-500" />
        <SummaryCard title="Ciro" value={`${formatPrice(s.totalRevenue)} TL`} icon={TrendingUp} color="text-emerald-500" small />
        <SummaryCard title="Kritik Stok" value={s.criticalStockCount} icon={AlertTriangle} color="text-red-500" highlight={s.criticalStockCount > 0} />
        <SummaryCard title="Toplam Borc" value={`${formatPrice(s.totalDebt)} TL`} icon={CreditCard} color="text-orange-500" small />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'dealers' as const, label: 'Bayiler', count: data.dealers.length },
          { key: 'orders' as const, label: 'Son Siparisler', count: data.recentOrders.length },
          { key: 'stock' as const, label: 'Kritik Stok', count: data.criticalStock.length },
          { key: 'collections' as const, label: 'Tahsilat', count: data.collections.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label} {tab.count > 0 && <span className="ml-1 text-xs bg-slate-100 px-1.5 py-0.5 rounded-full">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dealers' && <DealersTable dealers={data.dealers} />}
      {activeTab === 'orders' && <OrdersTable orders={data.recentOrders} />}
      {activeTab === 'stock' && <StockTable items={data.criticalStock} />}
      {activeTab === 'collections' && <CollectionsTable items={data.collections} />}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Son Aktiviteler</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500">Henuz aktivite bulunmuyor.</p>
          ) : (
            <div className="space-y-2">
              {data.recentActivity.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                  <div>
                    <span className="font-medium text-slate-700">{a.action}</span>
                    {a.detail && <span className="text-slate-400 ml-2">{a.detail.substring(0, 60)}</span>}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub Components ──────────────────────────────────────────────────

function SummaryCard({ title, value, icon: Icon, color, small, highlight }: {
  title: string; value: number | string; icon: React.ComponentType<{ className?: string }>;
  color: string; small?: boolean; highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-red-200 bg-red-50/50" : ""}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-slate-500">{title}</p>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <p className={`font-bold ${small ? "text-lg" : "text-2xl"} ${highlight ? "text-red-600" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function DealersTable({ dealers }: { dealers: BayiData['dealers'] }) {
  if (dealers.length === 0) return <p className="text-sm text-slate-500 py-4">Henuz bayi eklenmemis.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Bayi Adi</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Sehir</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Telefon</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Durum</th>
            <th className="text-right px-4 py-3 font-medium text-slate-500">Bakiye</th>
          </tr>
        </thead>
        <tbody>
          {dealers.map(d => {
            const st = statusLabel(d.status || "aktif");
            return (
              <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-slate-500">{[d.district, d.city].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{d.phone || "—"}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.text}</span></td>
                <td className="px-4 py-3 text-right">{d.balance ? `${formatPrice(d.balance)} TL` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ orders }: { orders: BayiData['recentOrders'] }) {
  if (orders.length === 0) return <p className="text-sm text-slate-500 py-4">Henuz siparis yok.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Tarih</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Bayi</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Durum</th>
            <th className="text-right px-4 py-3 font-medium text-slate-500">Tutar</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Not</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const st = statusLabel(o.status || "pending");
            return (
              <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{new Date(o.created_at).toLocaleDateString("tr-TR")}</td>
                <td className="px-4 py-3 font-medium">{o.dealer_name}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.text}</span></td>
                <td className="px-4 py-3 text-right font-medium">{o.total_amount ? `${formatPrice(o.total_amount)} TL` : "—"}</td>
                <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{o.notes || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StockTable({ items }: { items: BayiData['criticalStock'] }) {
  if (items.length === 0) return <p className="text-sm text-green-600 py-4">Kritik stok yok — tum urunler yeterli seviyede.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Urun</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">SKU</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Kategori</th>
            <th className="text-right px-4 py-3 font-medium text-slate-500">Stok</th>
            <th className="text-right px-4 py-3 font-medium text-slate-500">Min</th>
            <th className="text-right px-4 py-3 font-medium text-slate-500">Fiyat</th>
          </tr>
        </thead>
        <tbody>
          {items.map(p => (
            <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3 text-slate-400 font-mono text-xs">{p.sku || "—"}</td>
              <td className="px-4 py-3 text-slate-500">{p.category || "—"}</td>
              <td className="px-4 py-3 text-right font-bold text-red-600">{p.stock_quantity}</td>
              <td className="px-4 py-3 text-right text-slate-400">{p.min_stock || "—"}</td>
              <td className="px-4 py-3 text-right">{p.unit_price ? `${formatPrice(p.unit_price)} TL` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollectionsTable({ items }: { items: BayiData['collections'] }) {
  if (items.length === 0) return <p className="text-sm text-green-600 py-4">Tahsilat bekleyen bayi yok.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Bayi</th>
            <th className="text-right px-4 py-3 font-medium text-slate-500">Borc</th>
          </tr>
        </thead>
        <tbody>
          {items.map(d => (
            <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">{d.name}</td>
              <td className="px-4 py-3 text-right font-bold text-orange-600">{formatPrice(d.balance)} TL</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
