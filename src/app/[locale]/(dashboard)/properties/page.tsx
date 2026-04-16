'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Home, MapPin, BedDouble, Maximize2 } from 'lucide-react';

interface Property {
  id: string;
  title: string;
  type: string;
  listing_type: string;
  price: number | null;
  area: number | null;
  rooms: string | null;
  location_district: string | null;
  location_neighborhood: string | null;
  image_url: string | null;
  status: string | null;
  created_at: string;
}

export default function PropertiesPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'satilik' | 'kiralik'>('all');

  useEffect(() => {
    const userId = localStorage.getItem('upu_user_id');
    if (!userId) { setLoading(false); return; }
    fetch(`/api/dashboard/emlak/properties?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setItems(d.properties || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? items : items.filter((p) => p.listing_type === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">📋 Mülklerim</h1>
        <div className="flex gap-2 text-sm">
          {(['all', 'satilik', 'kiralik'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
            >
              {f === 'all' ? 'Tümü' : f === 'satilik' ? 'Satılık' : 'Kiralık'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Home className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <p className="text-slate-600">Henüz mülk eklenmemiş.</p>
          <p className="text-sm text-slate-500 mt-1">WhatsApp'tan "mülk ekle" yazarak başlayın.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Link key={p.id} href={`/tr/properties/${p.id}`}>
              <Card className="overflow-hidden hover:shadow-lg transition cursor-pointer">
                <div className="aspect-video bg-slate-200 relative overflow-hidden">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <Home size={40} />
                    </div>
                  )}
                  <span className={`absolute top-2 left-2 text-xs px-2 py-1 rounded-md ${p.listing_type === 'satilik' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                    {p.listing_type === 'satilik' ? 'Satılık' : 'Kiralık'}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 truncate">{p.title}</h3>
                  <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                    <MapPin size={14} />
                    <span>{p.location_neighborhood || p.location_district || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 mt-2">
                    {p.rooms && <span className="flex items-center gap-1"><BedDouble size={14} />{p.rooms}</span>}
                    {p.area && <span className="flex items-center gap-1"><Maximize2 size={14} />{p.area} m²</span>}
                  </div>
                  <div className="mt-3 text-lg font-bold text-indigo-600">
                    {p.price ? new Intl.NumberFormat('tr-TR').format(p.price) + ' ₺' : '—'}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
