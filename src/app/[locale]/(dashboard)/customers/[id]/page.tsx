'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Phone, Mail, MapPin, Calendar, MessageSquare } from 'lucide-react';

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
  notes: string | null;
  created_at: string;
}

interface Contact {
  id: string;
  contact_type: string;
  note: string | null;
  result: string | null;
  created_at: string;
}

const CONTACT_TYPE_EMOJI: Record<string, string> = {
  arama: '📞', mesaj: '💬', gosterim: '🏠', sunum: '🎯', teklif: '💰',
};

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('upu_user_id');
    if (!userId) { setLoading(false); return; }
    fetch(`/api/dashboard/emlak/customers/${id}?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => { setCustomer(d.customer || null); setContacts(d.contacts || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-slate-500">Yükleniyor...</p>;
  if (!customer) return (
    <div>
      <Link href="/tr/customers" className="inline-flex items-center gap-1 text-indigo-600 mb-4"><ArrowLeft size={16} /> Geri</Link>
      <Card className="p-8 text-center"><p className="text-slate-600">Müşteri bulunamadı.</p></Card>
    </div>
  );

  return (
    <div>
      <Link href="/tr/customers" className="inline-flex items-center gap-1 text-indigo-600 mb-4 text-sm">
        <ArrowLeft size={16} /> Müşteri listesine dön
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Profile */}
        <Card className="p-6 lg:col-span-1">
          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-indigo-700">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-3">{customer.name}</h1>
            <span className="inline-block mt-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">
              {customer.pipeline_stage || 'yeni'}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            {customer.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-slate-500" /> {customer.phone}</div>}
            {customer.email && <div className="flex items-center gap-2"><Mail size={14} className="text-slate-500" /> {customer.email}</div>}
            {customer.location && <div className="flex items-center gap-2"><MapPin size={14} className="text-slate-500" /> {customer.location}</div>}
          </div>

          <div className="border-t mt-4 pt-4 space-y-2 text-sm">
            {customer.property_type && <Row label="Aranan tip" value={customer.property_type} />}
            {customer.rooms && <Row label="Oda" value={customer.rooms} />}
            {(customer.budget_min || customer.budget_max) && (
              <Row label="Bütçe" value={`${customer.budget_min ? new Intl.NumberFormat('tr-TR').format(customer.budget_min) : '0'}–${customer.budget_max ? new Intl.NumberFormat('tr-TR').format(customer.budget_max) : '?'} ₺`} />
            )}
            <Row label="Toplam temas" value={`${customer.contact_count || 0}`} />
            {customer.last_contact_date && <Row label="Son temas" value={new Date(customer.last_contact_date).toLocaleDateString('tr-TR')} />}
            {customer.next_followup_date && <Row label="Sonraki takip" value={new Date(customer.next_followup_date).toLocaleDateString('tr-TR')} />}
          </div>

          {customer.notes && (
            <div className="border-t mt-4 pt-4">
              <div className="text-xs text-slate-500 mb-1">Notlar</div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{customer.notes}</p>
            </div>
          )}
        </Card>

        {/* Right: Contact history */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare size={18} /> Temas Geçmişi
          </h2>

          {contacts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p>Henüz temas kaydı yok.</p>
              <p className="text-sm mt-1">WhatsApp'tan "müşteri takip" ile kayıt ekleyebilirsiniz.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.id} className="border-l-2 border-indigo-200 pl-4 py-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-slate-800 flex items-center gap-2">
                      <span>{CONTACT_TYPE_EMOJI[c.contact_type] || '•'}</span>
                      <span className="capitalize">{c.contact_type}</span>
                      {c.result && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{c.result}</span>}
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                  {c.note && <p className="text-sm text-slate-600 mt-1">{c.note}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}
