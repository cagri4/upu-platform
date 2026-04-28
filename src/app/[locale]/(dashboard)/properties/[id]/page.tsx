'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { SahibindenLink } from '@/components/sahibinden-link';
import { ArrowLeft, MapPin, Home } from 'lucide-react';

interface Property {
  id: string;
  title: string;
  description: string | null;
  ai_description: string | null;
  type: string;
  listing_type: string;
  price: number | null;
  area: number | null;
  net_area: number | null;
  rooms: string | null;
  floor: string | null;
  total_floors: number | null;
  building_age: string | null;
  location_city: string | null;
  location_district: string | null;
  location_neighborhood: string | null;
  heating: string | null;
  parking: string | null;
  elevator: string | null;
  balcony: string | null;
  status: string | null;
  image_url: string | null;
  source_portal: string | null;
  source_url: string | null;
  listing_date: string | null;
  created_at: string;
}

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('upu_user_id');
    if (!userId) { setLoading(false); return; }
    fetch(`/api/dashboard/emlak/properties/${id}?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setProperty(d.property || null))
      .catch(() => setProperty(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-slate-500">Yükleniyor...</p>;
  if (!property) return (
    <div>
      <Link href="/tr/properties" className="inline-flex items-center gap-1 text-indigo-600 mb-4"><ArrowLeft size={16} /> Geri</Link>
      <Card className="p-8 text-center">
        <p className="text-slate-600">Mülk bulunamadı.</p>
      </Card>
    </div>
  );

  const fmtPrice = property.price ? new Intl.NumberFormat('tr-TR').format(property.price) + ' ₺' : '—';

  return (
    <div>
      <Link href="/tr/properties" className="inline-flex items-center gap-1 text-indigo-600 mb-4 text-sm">
        <ArrowLeft size={16} /> Mülkler listesine dön
      </Link>

      <Card className="overflow-hidden">
        <div className="aspect-video bg-slate-200 relative">
          {property.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={property.image_url} alt={property.title} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <Home size={60} />
            </div>
          )}
          <span className={`absolute top-3 left-3 text-sm px-3 py-1 rounded-md text-white ${property.listing_type === 'satilik' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
            {property.listing_type === 'satilik' ? 'Satılık' : 'Kiralık'}
          </span>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{property.title}</h1>
            <div className="flex items-center gap-1 text-slate-500 mt-1">
              <MapPin size={16} />
              <span>{[property.location_neighborhood, property.location_district, property.location_city].filter(Boolean).join(', ') || '—'}</span>
            </div>
          </div>

          <div className="text-3xl font-bold text-indigo-600">{fmtPrice}</div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <InfoRow label="Tip" value={property.type} />
            <InfoRow label="Oda" value={property.rooms} />
            <InfoRow label="Alan" value={property.area ? `${property.area} m²` : null} />
            <InfoRow label="Net" value={property.net_area ? `${property.net_area} m²` : null} />
            <InfoRow label="Kat" value={property.floor ? `${property.floor}${property.total_floors ? `/${property.total_floors}` : ''}` : null} />
            <InfoRow label="Bina Yaşı" value={property.building_age} />
            <InfoRow label="Isıtma" value={property.heating} />
            <InfoRow label="Otopark" value={property.parking} />
            <InfoRow label="Asansör" value={property.elevator} />
            <InfoRow label="Balkon" value={property.balcony} />
            <InfoRow label="Durum" value={property.status} />
            <InfoRow label="Kaynak" value={property.source_portal} />
          </div>

          {(property.description || property.ai_description) && (
            <div>
              <h2 className="font-semibold text-slate-900 mb-2">Açıklama</h2>
              <p className="text-slate-700 text-sm whitespace-pre-wrap">
                {property.ai_description || property.description}
              </p>
            </div>
          )}

          {property.source_url && (
            <SahibindenLink href={property.source_url} target="_blank" rel="noreferrer" className="inline-block text-indigo-600 hover:underline text-sm">
              Kaynak ilan →
            </SahibindenLink>
          )}
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="bg-slate-50 rounded-md px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium text-slate-800 truncate">{value}</div>
    </div>
  );
}
