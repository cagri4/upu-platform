'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Star } from 'lucide-react';

interface Agent {
  key: string;
  name: string;
  icon: string;
  description: string;
  xp: number;
  tier: number;
}

const TIER_NAMES: Record<number, string> = {
  0: 'Çaylak',
  1: 'Öğrenci',
  2: 'Pratisyen',
  3: 'Profesyonel',
  4: 'Uzman',
};

const TIER_THRESHOLDS = [0, 50, 150, 350, 700]; // XP needed to reach tier

export default function AgentsPage() {
  const [items, setItems] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('upu_user_id');
    if (!userId) { setLoading(false); return; }
    fetch(`/api/dashboard/emlak/agents?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setItems(d.agents || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">⚙️ Sanal Elemanlar</h1>
      <p className="text-slate-600 mb-6">Elemanlarınız görevleri tamamladıkça gelişir ve daha yetenekli hale gelir.</p>

      {loading ? (
        <p className="text-slate-500">Yükleniyor...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((a) => {
            const nextThreshold = TIER_THRESHOLDS[a.tier + 1] || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
            const currentThreshold = TIER_THRESHOLDS[a.tier] || 0;
            const progressInTier = a.xp - currentThreshold;
            const tierSize = nextThreshold - currentThreshold;
            const pct = tierSize > 0 ? Math.min(100, Math.round((progressInTier / tierSize) * 100)) : 100;

            return (
              <Card key={a.key} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{a.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-lg">{a.name}</h3>
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-md">
                        <Star size={12} /> {TIER_NAMES[a.tier] || 'Çaylak'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{a.description}</p>

                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>{a.xp} XP</span>
                        <span>{nextThreshold} XP</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
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
