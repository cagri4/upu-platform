'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { FileText, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface Contract {
  id: string;
  type: string;
  status: string;
  contract_data: Record<string, unknown> | null;
  signed_at: string | null;
  created_at: string;
  property_id: string | null;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_signature: { label: 'İmza bekliyor', color: 'text-amber-600 bg-amber-50', icon: Clock },
  signed:            { label: 'İmzalandı',    color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
  cancelled:         { label: 'İptal',        color: 'text-red-600 bg-red-50', icon: XCircle },
  expired:           { label: 'Süresi doldu', color: 'text-slate-500 bg-slate-100', icon: XCircle },
};

export default function ContractsPage() {
  const [items, setItems] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('upu_user_id');
    if (!userId) { setLoading(false); return; }
    fetch(`/api/dashboard/emlak/contracts?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setItems(d.contracts || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">📄 Sözleşmeler</h1>

      {loading ? (
        <p className="text-slate-500">Yükleniyor...</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <p className="text-slate-600">Henüz sözleşme yok.</p>
          <p className="text-sm text-slate-500 mt-1">WhatsApp'tan "sözleşme" komutuyla oluşturun.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const meta = STATUS_META[c.status] || STATUS_META.pending_signature;
            const Icon = meta.icon;
            const data = c.contract_data as { customer_name?: string; property_title?: string; commission?: string | number; duration_months?: number } | null;
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-md ${meta.color}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">
                        {c.type === 'yetkilendirme' ? 'Yetkilendirme Sözleşmesi' : c.type}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded-md ${meta.color}`}>{meta.label}</span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1 space-y-0.5">
                      {data?.customer_name && <div>Müşteri: {data.customer_name}</div>}
                      {data?.property_title && <div>Mülk: {data.property_title}</div>}
                      {data?.commission && <div>Komisyon: %{data.commission}</div>}
                      {data?.duration_months && <div>Süre: {data.duration_months} ay</div>}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Oluşturuldu: {new Date(c.created_at).toLocaleDateString('tr-TR')}
                      {c.signed_at && <> · İmzalandı: {new Date(c.signed_at).toLocaleDateString('tr-TR')}</>}
                    </div>
                    <a
                      href={`/api/contracts/${c.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-indigo-600 hover:underline text-sm mt-2"
                    >
                      PDF önizle →
                    </a>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
