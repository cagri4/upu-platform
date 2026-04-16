'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Users, Phone, Calendar } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  budget_min: number | null;
  budget_max: number | null;
  location: string | null;
  property_type: string | null;
  rooms: string | null;
  pipeline_stage: string | null;
  last_contact_date: string | null;
  next_followup_date: string | null;
  contact_count: number | null;
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  yeni:           { label: 'Yeni',          color: 'bg-slate-200 text-slate-700' },
  ilk_temas:      { label: 'İlk Temas',     color: 'bg-blue-100 text-blue-700' },
  sunum_yapildi:  { label: 'Sunum Yapıldı', color: 'bg-indigo-100 text-indigo-700' },
  gosterim:       { label: 'Gösterim',      color: 'bg-purple-100 text-purple-700' },
  teklif:         { label: 'Teklif',        color: 'bg-amber-100 text-amber-700' },
  pazarlik:       { label: 'Pazarlık',      color: 'bg-orange-100 text-orange-700' },
  kapandi:        { label: 'Kapandı',       color: 'bg-emerald-100 text-emerald-700' },
  iptal:          { label: 'İptal',         color: 'bg-red-100 text-red-700' },
};

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>('all');

  useEffect(() => {
    const userId = localStorage.getItem('upu_user_id');
    if (!userId) { setLoading(false); return; }
    fetch(`/api/dashboard/emlak/customers?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setItems(d.customers || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = stageFilter === 'all' ? items : items.filter((c) => (c.pipeline_stage || 'yeni') === stageFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">👥 Müşterilerim</h1>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-1.5 rounded-md border border-slate-300 text-sm"
        >
          <option value="all">Tüm aşamalar</option>
          {Object.entries(STAGE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-slate-500">Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <p className="text-slate-600">Bu filtreye uygun müşteri yok.</p>
          <p className="text-sm text-slate-500 mt-1">WhatsApp'tan "müşteri ekle" yazarak başlayın.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const stage = STAGE_LABELS[c.pipeline_stage || 'yeni'] || STAGE_LABELS.yeni;
            return (
              <Link key={c.id} href={`/tr/customers/${c.id}`}>
                <Card className="p-4 hover:shadow-lg transition cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{c.name}</h3>
                      {c.phone && (
                        <div className="flex items-center gap-1 text-sm text-slate-500 mt-0.5">
                          <Phone size={12} /> {c.phone}
                        </div>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-md ${stage.color}`}>{stage.label}</span>
                  </div>

                  {(c.property_type || c.rooms || c.location) && (
                    <div className="text-sm text-slate-600 mt-3">
                      {[c.property_type, c.rooms, c.location].filter(Boolean).join(' · ')}
                    </div>
                  )}

                  {(c.budget_min || c.budget_max) && (
                    <div className="text-sm text-slate-700 mt-1">
                      💰 {c.budget_min ? new Intl.NumberFormat('tr-TR').format(c.budget_min) : '0'}–{c.budget_max ? new Intl.NumberFormat('tr-TR').format(c.budget_max) : '?'} ₺
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-3 pt-3 border-t">
                    {c.contact_count !== null && (
                      <span>{c.contact_count || 0} temas</span>
                    )}
                    {c.next_followup_date && (
                      <span className="flex items-center gap-1 text-amber-700">
                        <Calendar size={12} />
                        {new Date(c.next_followup_date).toLocaleDateString('tr-TR')}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
