'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Home, Users, MessageSquare, Clock, FileText, Zap } from 'lucide-react';

interface ReportData {
  period: 'week' | 'month';
  days: number;
  counts: {
    newProps: number;
    newCusts: number;
    contactsMade: number;
    remindersCreated: number;
    contractsCreated: number;
    commandsRun: number;
  };
  pipeline: Record<string, number>;
}

const PIPELINE_LABELS: Record<string, string> = {
  yeni: 'Yeni',
  ilk_temas: 'İlk Temas',
  sunum_yapildi: 'Sunum Yapıldı',
  gosterim: 'Gösterim',
  teklif: 'Teklif',
  pazarlik: 'Pazarlık',
  kapandi: 'Kapandı',
  iptal: 'İptal',
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('upu_user_id');
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/dashboard/emlak/reports?userId=${userId}&period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  const totalPipe = Object.values(data?.pipeline || {}).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">📊 Rapor</h1>
        <div className="flex gap-2 text-sm">
          <button onClick={() => setPeriod('week')} className={`px-3 py-1 rounded-md ${period === 'week' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Son 7 gün</button>
          <button onClick={() => setPeriod('month')} className={`px-3 py-1 rounded-md ${period === 'month' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Son 30 gün</button>
        </div>
      </div>

      {loading || !data ? (
        <p className="text-slate-500">Yükleniyor...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <Stat icon={Home}  label="Yeni mülk" value={data.counts.newProps} color="text-indigo-500" />
            <Stat icon={Users} label="Yeni müşteri" value={data.counts.newCusts} color="text-orange-500" />
            <Stat icon={MessageSquare} label="Müşteri teması" value={data.counts.contactsMade} color="text-emerald-500" />
            <Stat icon={Clock} label="Hatırlatma" value={data.counts.remindersCreated} color="text-amber-500" />
            <Stat icon={FileText} label="Sözleşme" value={data.counts.contractsCreated} color="text-purple-500" />
            <Stat icon={Zap} label="Komut kullanımı" value={data.counts.commandsRun} color="text-pink-500" />
          </div>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Müşteri Pipeline'ı</h2>
            {totalPipe === 0 ? (
              <p className="text-sm text-slate-500">Henüz müşteri yok.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(PIPELINE_LABELS).map(([key, label]) => {
                  const n = data.pipeline[key] || 0;
                  const pct = totalPipe > 0 ? Math.round((n / totalPipe) * 100) : 0;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700">{label}</span>
                        <span className="text-slate-500">{n} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={color} size={26} />
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
        </div>
      </div>
    </Card>
  );
}
