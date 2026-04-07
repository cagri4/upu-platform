'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Plus, Pencil, Trash2, X, Search, Upload, Download } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  base_price: number;
  unit_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  category: string;
  sku: string;
  barcode: string;
  unit: string;
  min_order: number;
  brand: string;
  weight: number;
  image_url: string;
  images: string[];
  specs: Record<string, string>;
  is_active: boolean;
}

const UNITS = ["adet", "kg", "litre", "kutu", "paket", "metre", "ton", "koli"];

const emptyProduct: Partial<Product> = {
  name: "", description: "", base_price: 0, unit_price: 0,
  stock_quantity: 0, low_stock_threshold: 10, category: "",
  sku: "", barcode: "", unit: "adet", min_order: 1,
  brand: "", weight: 0, image_url: "", is_active: true,
};

export default function BayiProductsPanel({ userId }: { userId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Partial<Product>>(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<{ imported?: number; errors?: number; error?: string } | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/bayi-products?userId=${userId}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function saveProduct() {
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/bayi-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, product: editing }),
      });
      if (res.ok) {
        setShowForm(false);
        setEditing(emptyProduct);
        fetchProducts();
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Bu urunu silmek istediginize emin misiniz?")) return;
    await fetch('/api/dashboard/bayi-products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, productId: id }),
    });
    fetchProducts();
  }

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && p.category !== filterCategory) return false;
    return true;
  });

  if (loading) return <p className="text-slate-500 py-4">Urunler yukleniyor...</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Package className="w-5 h-5" /> Urun Yonetimi ({products.length})
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCsvImport(!showCsvImport)}>
            <Upload className="w-4 h-4 mr-1" /> CSV Yukle
          </Button>
          <Button onClick={() => { setEditing(emptyProduct); setShowForm(true); }} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Urun Ekle
          </Button>
        </div>
      </div>

      {/* CSV Import */}
      {showCsvImport && (
        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              CSV Toplu Urun Yukleme
              <button onClick={() => { setShowCsvImport(false); setCsvResult(null); }}><X className="w-4 h-4 text-slate-400" /></button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-2">
              CSV formatı (ilk satir baslik):<br/>
              <code className="bg-slate-100 px-1">ad,kategori,fiyat,stok,birim,marka,sku,barkod,aciklama</code><br/>
              Ayrac: virgul, noktali virgul veya tab. Minimum: ad ve fiyat.
            </p>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={"ad,kategori,fiyat,stok,birim,marka\nBoya 10L Beyaz,Ic Cephe,450,100,adet,Marshall\nVernik 2.5L,Vernik,280,50,adet,Polisan"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono resize-none mb-2"
              rows={5}
            />
            <div className="flex items-center gap-2">
              <input type="file" accept=".csv,.txt" className="text-xs" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) { const text = await file.text(); setCsvText(text); }
              }} />
              <Button size="sm" disabled={csvLoading || !csvText.trim()} onClick={async () => {
                setCsvLoading(true); setCsvResult(null);
                try {
                  const res = await fetch('/api/dashboard/bayi-products/csv', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, csvData: csvText }),
                  });
                  const data = await res.json();
                  setCsvResult(data);
                  if (data.ok) { fetchProducts(); setCsvText(""); }
                } catch { setCsvResult({ error: "Baglanti hatasi" }); }
                finally { setCsvLoading(false); }
              }}>
                {csvLoading ? "Yukleniyor..." : "Yukle"}
              </Button>
            </div>
            {csvResult && (
              <div className={`mt-2 text-xs p-2 rounded ${csvResult.error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {csvResult.error ? `Hata: ${csvResult.error}` : `${csvResult.imported} urun yuklendi${csvResult.errors ? `, ${csvResult.errors} hata` : ''}`}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input placeholder="Urun ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Tum Kategoriler</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Product Form */}
      {showForm && (
        <Card className="border-indigo-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              {editing.id ? "Urun Duzenle" : "Yeni Urun"}
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><Label>Urun Adi *</Label><Input value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Kategori</Label><Input value={editing.category || ""} onChange={e => setEditing({ ...editing, category: e.target.value })} placeholder="Ornek: Boya, Klima" /></div>
              <div><Label>Marka</Label><Input value={editing.brand || ""} onChange={e => setEditing({ ...editing, brand: e.target.value })} /></div>
              <div><Label>Fiyat (TL) *</Label><Input type="number" value={editing.base_price || ""} onChange={e => setEditing({ ...editing, base_price: Number(e.target.value), unit_price: Number(e.target.value) })} /></div>
              <div><Label>Stok Miktari</Label><Input type="number" value={editing.stock_quantity || ""} onChange={e => setEditing({ ...editing, stock_quantity: Number(e.target.value) })} /></div>
              <div><Label>Kritik Stok Seviyesi</Label><Input type="number" value={editing.low_stock_threshold || ""} onChange={e => setEditing({ ...editing, low_stock_threshold: Number(e.target.value) })} /></div>
              <div>
                <Label>Birim</Label>
                <select value={editing.unit || "adet"} onChange={e => setEditing({ ...editing, unit: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div><Label>Min. Siparis</Label><Input type="number" value={editing.min_order || ""} onChange={e => setEditing({ ...editing, min_order: Number(e.target.value) })} /></div>
              <div><Label>SKU</Label><Input value={editing.sku || ""} onChange={e => setEditing({ ...editing, sku: e.target.value })} /></div>
              <div><Label>Barkod</Label><Input value={editing.barcode || ""} onChange={e => setEditing({ ...editing, barcode: e.target.value })} /></div>
              <div><Label>Agirlik (kg)</Label><Input type="number" value={editing.weight || ""} onChange={e => setEditing({ ...editing, weight: Number(e.target.value) })} /></div>
              <div><Label>Gorsel URL</Label><Input value={editing.image_url || ""} onChange={e => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://..." /></div>
              <div className="md:col-span-2 lg:col-span-3">
                <Label>Aciklama</Label>
                <textarea value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" rows={2} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={saveProduct} disabled={saving || !editing.name}>
                {saving ? "Kaydediliyor..." : editing.id ? "Guncelle" : "Kaydet"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Iptal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-slate-500">
            {products.length === 0 ? "Henuz urun eklenmemis." : "Aramayla eslesen urun yok."}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white rounded-lg border border-slate-200">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-slate-500">Urun</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-500">Kategori</th>
                <th className="text-right px-3 py-2.5 font-medium text-slate-500">Fiyat</th>
                <th className="text-right px-3 py-2.5 font-medium text-slate-500">Stok</th>
                <th className="text-center px-3 py-2.5 font-medium text-slate-500">Birim</th>
                <th className="text-center px-3 py-2.5 font-medium text-slate-500">Durum</th>
                <th className="text-right px-3 py-2.5 font-medium text-slate-500">Islem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-300" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{p.name}</p>
                        {p.sku && <p className="text-xs text-slate-400">{p.sku}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{p.category || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{new Intl.NumberFormat("tr-TR").format(p.base_price || p.unit_price || 0)} TL</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${(p.stock_quantity || 0) <= (p.low_stock_threshold || 10) ? 'text-red-600' : ''}`}>
                    {p.stock_quantity || 0}
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-400">{p.unit || "adet"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-1 hover:bg-slate-100 rounded">
                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button onClick={() => deleteProduct(p.id)} className="p-1 hover:bg-red-50 rounded">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
