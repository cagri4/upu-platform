'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Clock, CheckCircle2, Calendar } from 'lucide-react';

interface Reminder {
  id: string;
  topic: string;
  note: string | null;
  remind_at: string;
  triggered: boolean;
  created_at: string;
}

export default function RemindersPage() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTriggered, setShowTriggered] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem('upu_user_id');
    if (!userId) { setLoading(false); return; }
    fetch(`/api/dashboard/emlak/reminders?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setItems(d.reminders || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const now = Date.now();
  const visible = items.filter((r) => showTriggered ? r.triggered : !r.triggered);
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const tomorrowMs = todayMs + 86400000;

  const groupOf = (r: Reminder): string => {
    const t = new Date(r.remind_at).getTime();
    if (t < todayMs) return 'gecmis';
    if (t < tomorrowMs) return 'bugun';
    if (t < tomorrowMs + 86400000) return 'yarin';
    if (t < tomorrowMs + 7 * 86400000) return 'hafta';
    return 'sonra';
  };

  const GROUP_LABELS: Record<string, string> = {
    gecmis: '⏰ Geçmiş',
    bugun: '🔥 Bugün',
    yarin: '📅 Yarın',
    hafta: '📆 Bu hafta',
    sonra: '🗓 İleride',
  };

  const grouped: Record<string, Reminder[]> = {};
  for (const r of visible) {
    const g = groupOf(r);
    (grouped[g] ||= []).push(r);
  }

  const groupOrder = ['gecmis', 'bugun', 'yarin', 'hafta', 'sonra'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">⏰ Hatırlatmalar</h1>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setShowTriggered(false)}
            className={`px-3 py-1 rounded-md ${!showTriggered ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
          >
            Bekleyen ({items.filter((r) => !r.triggered).length})
          </button>
          <button
            onClick={() => setShowTriggered(true)}
            className={`px-3 py-1 rounded-md ${showTriggered ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
          >
            Tetiklenen ({items.filter((r) => r.triggered).length})
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Yükleniyor...</p>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <p className="text-slate-600">{showTriggered ? 'Tetiklenmiş hatırlatma yok.' : 'Bekleyen hatırlatma yok.'}</p>
          <p className="text-sm text-slate-500 mt-1">WhatsApp'tan "hatırlatma" yazarak kurabilirsiniz.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {groupOrder.filter((g) => grouped[g]).map((g) => (
            <div key={g}>
              <h2 className="text-sm font-semibold text-slate-500 mb-2">{GROUP_LABELS[g]}</h2>
              <div className="space-y-2">
                {grouped[g].map((r) => {
                  const t = new Date(r.remind_at);
                  const overdue = !r.triggered && t.getTime() < now;
                  return (
                    <Card key={r.id} className={`p-4 ${overdue ? 'border-red-200 bg-red-50' : ''}`}>
                      <div className="flex items-start gap-3">
                        {r.triggered ? (
                          <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                        ) : (
                          <Clock className={`shrink-0 mt-0.5 ${overdue ? 'text-red-500' : 'text-indigo-500'}`} size={18} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900">{r.topic}</div>
                          {r.note && <p className="text-sm text-slate-600 mt-1">{r.note}</p>}
                          <div className="text-xs text-slate-500 mt-1">
                            {t.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {' · '}
                            {t.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
