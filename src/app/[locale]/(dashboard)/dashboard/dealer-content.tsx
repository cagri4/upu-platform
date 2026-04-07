'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ShoppingCart, Package, Search, Plus, Minus, CreditCard,
  FileText, Clock, CheckCircle, XCircle, Truck,
} from 'lucide-react';

interface Product {
  id: string; name: string; description: string; base_price: number;
  unit_price: number; stock_quantity: number; category: string;
  unit: string; min_order: number; image_url: string; brand: string;
}

interface CartItem { product: Product; quantity: number; }

interface Order {
  id: string; status: string; total_amount: number; created_at: string; notes: string;
  items: Array<{ product_name: string; quantity: number; unit_price: number }>;
}

type Tab = 'catalog' | 'cart' | 'orders' | 'balance';

function fmt(n: number): string { return new Intl.NumberFormat("tr-TR").format(n); }

function statusBadge(s: string) {
  const map: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
    pending: { text: "Beklemede", color: "bg-yellow-100 text-yellow-700", icon: <Clock className="w-3 h-3" /> },
    beklemede: { text: "Beklemede", color: "bg-yellow-100 text-yellow-700", icon: <Clock className="w-3 h-3" /> },
    confirmed: { text: "Onaylandi", color: "bg-blue-100 text-blue-700", icon: <CheckCircle className="w-3 h-3" /> },
    shipped: { text: "Kargoda", color: "bg-purple-100 text-purple-700", icon: <Truck className="w-3 h-3" /> },
    completed: { text: "Tamamlandi", color: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3 h-3" /> },
    tamamlandi: { text: "Tamamlandi", color: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3 h-3" /> },
    cancelled: { text: "Iptal", color: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
  };
  return map[s] || { text: s, color: "bg-gray-100 text-gray-700", icon: null };
}

export default function DealerDashboardContent({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>('catalog');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState<{ balance: number; dealerName: string; invoices: unknown[]; payments: unknown[] } | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");

  useEffect(() => { loadCatalog(); }, []);

  async function loadCatalog() {
    setLoading(true);
    const res = await fetch(`/api/dashboard/dealer?userId=${userId}&section=catalog`);
    const data = await res.json();
    setProducts(data.products || []);
    setCategories(data.categories || []);
    setLoading(false);
  }

  async function loadOrders() {
    const res = await fetch(`/api/dashboard/dealer?userId=${userId}&section=orders`);
    const data = await res.json();
    setOrders(data.orders || []);
  }

  async function loadBalance() {
    const res = await fetch(`/api/dashboard/dealer?userId=${userId}&section=balance`);
    setBalance(await res.json());
  }

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + (product.min_order || 1) } : c);
      return [...prev, { product, quantity: product.min_order || 1 }];
    });
  }

  function updateCartQty(productId: string, delta: number) {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c;
      const newQty = c.quantity + delta;
      return newQty <= 0 ? c : { ...c, quantity: newQty };
    }).filter(c => c.quantity > 0));
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(c => c.product.id !== productId));
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    setOrdering(true);
    try {
      const res = await fetch('/api/dashboard/dealer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          items: cart.map(c => ({ productId: c.product.id, quantity: c.quantity })),
          notes: orderNotes || null,
        }),
      });
      if (res.ok) {
        setCart([]);
        setOrderNotes("");
        setTab('orders');
        loadOrders();
      }
    } catch (e) { console.error(e); }
    finally { setOrdering(false); }
  }

  const cartTotal = cart.reduce((sum, c) => sum + (c.product.unit_price || c.product.base_price) * c.quantity, 0);
  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat && p.category !== filterCat) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {([
          { key: 'catalog' as Tab, label: 'Katalog', icon: <Package className="w-4 h-4" /> },
          { key: 'cart' as Tab, label: `Sepet (${cart.length})`, icon: <ShoppingCart className="w-4 h-4" /> },
          { key: 'orders' as Tab, label: 'Siparislerim', icon: <FileText className="w-4 h-4" /> },
          { key: 'balance' as Tab, label: 'Bakiye', icon: <CreditCard className="w-4 h-4" /> },
        ]).map(t => (
          <button key={t.key}
            onClick={() => { setTab(t.key); if (t.key === 'orders') loadOrders(); if (t.key === 'balance') loadBalance(); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t.key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >{t.icon} {t.label}</button>
        ))}
      </div>

      {/* CATALOG */}
      {tab === 'catalog' && (
        <div>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input placeholder="Urun ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Tum Kategoriler</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading ? <p className="text-slate-500 py-4">Yukleniyor...</p> : filtered.length === 0 ? (
            <p className="text-slate-500 py-4">Urun bulunamadi.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(p => {
                const inCart = cart.find(c => c.product.id === p.id);
                return (
                  <Card key={p.id} className="overflow-hidden hover:shadow-md transition">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 bg-slate-100 flex items-center justify-center">
                        <Package className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                    <CardContent className="p-3">
                      {p.category && <p className="text-xs text-indigo-500 mb-0.5">{p.category}</p>}
                      <h3 className="font-medium text-sm mb-1">{p.name}</h3>
                      {p.brand && <p className="text-xs text-slate-400 mb-1">{p.brand}</p>}
                      <p className="text-lg font-bold text-slate-900 mb-2">{fmt(p.unit_price || p.base_price)} TL <span className="text-xs text-slate-400 font-normal">/ {p.unit || "adet"}</span></p>
                      {inCart ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateCartQty(p.id, -1)} className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-medium w-8 text-center">{inCart.quantity}</span>
                          <button onClick={() => updateCartQty(p.id, 1)} className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                            <Plus className="w-3 h-3" />
                          </button>
                          <button onClick={() => removeFromCart(p.id)} className="ml-auto text-xs text-red-500 hover:underline">Kaldir</button>
                        </div>
                      ) : (
                        <Button size="sm" className="w-full" onClick={() => addToCart(p)}>
                          <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Sepete Ekle
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CART */}
      {tab === 'cart' && (
        <div>
          {cart.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-slate-500">Sepetiniz bos. Katalogdan urun ekleyin.</CardContent></Card>
          ) : (
            <>
              <div className="space-y-2">
                {cart.map(c => (
                  <Card key={c.product.id}>
                    <CardContent className="py-3 px-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {c.product.image_url ? (
                          <img src={c.product.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center"><Package className="w-4 h-4 text-slate-300" /></div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{c.product.name}</p>
                          <p className="text-xs text-slate-400">{fmt(c.product.unit_price || c.product.base_price)} TL x {c.quantity}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateCartQty(c.product.id, -1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                          <span className="text-sm font-medium w-6 text-center">{c.quantity}</span>
                          <button onClick={() => updateCartQty(c.product.id, 1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                        </div>
                        <p className="font-bold text-sm w-24 text-right">{fmt((c.product.unit_price || c.product.base_price) * c.quantity)} TL</p>
                        <button onClick={() => removeFromCart(c.product.id)} className="text-red-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="mt-4">
                <CardContent className="py-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-slate-500">Toplam</span>
                    <span className="text-xl font-bold">{fmt(cartTotal)} TL</span>
                  </div>
                  <Input placeholder="Siparis notu (opsiyonel)" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} className="mb-3" />
                  <Button className="w-full" onClick={placeOrder} disabled={ordering}>
                    {ordering ? "Siparis Olusturuluyor..." : `Siparis Ver (${fmt(cartTotal)} TL)`}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ORDERS */}
      {tab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-slate-500">Henuz siparisiniz yok.</CardContent></Card>
          ) : orders.map(o => {
            const st = statusBadge(o.status);
            return (
              <Card key={o.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.icon} {st.text}</span>
                    <span className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString("tr-TR")}</span>
                  </div>
                  {o.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-0.5">
                      <span className="text-slate-600">{item.product_name} x{item.quantity}</span>
                      <span className="text-slate-500">{fmt(item.unit_price * item.quantity)} TL</span>
                    </div>
                  ))}
                  <div className="flex justify-between mt-2 pt-2 border-t border-slate-100">
                    <span className="font-medium text-sm">Toplam</span>
                    <span className="font-bold">{fmt(o.total_amount)} TL</span>
                  </div>
                  {o.notes && <p className="text-xs text-slate-400 mt-1">Not: {o.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* BALANCE */}
      {tab === 'balance' && (
        <div>
          {!balance ? <p className="text-slate-500 py-4">Yukleniyor...</p> : (
            <div className="space-y-4">
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-sm text-slate-500 mb-1">Guncel Bakiye</p>
                  <p className={`text-3xl font-bold ${balance.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {fmt(Math.abs(balance.balance))} TL
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{balance.balance > 0 ? "Borc" : balance.balance < 0 ? "Alacak" : "Temiz"}</p>
                </CardContent>
              </Card>

              {(balance.invoices as Array<{ id: string; invoice_no: string; amount: number; status: string; created_at: string }>).length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Son Faturalar</CardTitle></CardHeader>
                  <CardContent>
                    {(balance.invoices as Array<{ id: string; invoice_no: string; amount: number; status: string; created_at: string }>).map(inv => (
                      <div key={inv.id} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0 text-sm">
                        <span>{inv.invoice_no || "—"}</span>
                        <span className="font-medium">{fmt(inv.amount)} TL</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
