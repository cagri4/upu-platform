'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Trophy, Flame, Target, CheckCircle2, Circle, Lock } from 'lucide-react';

interface Mission {
  id: string;
  mission_key: string;
  title: string;
  description: string;
  emoji: string;
  chapter: number | null;
  chapter_order: number | null;
  sort_order: number;
  xp_reward: number | null;
  employee_key: string | null;
  status: 'locked' | 'active' | 'completed';
  is_active: boolean;
}

interface QuestData {
  state: { current_chapter: number; active_mission_key: string | null } | null;
  missions: Mission[];
  totals: { totalXp: number; completedCount: number; total: number };
  chapters: Record<number, { total: number; completed: number; active: boolean }>;
  streak: { current_streak: number; longest_streak: number };
}

const CHAPTER_NAMES: Record<number, string> = {
  1: 'Bölüm 1 — Çaylak',
  2: 'Bölüm 2 — Öğrenci',
  3: 'Bölüm 3 — Pratisyen',
  4: 'Bölüm 4 — Profesyonel',
  5: 'Bölüm 5 — Uzman',
};

export default function QuestPage() {
  const [data, setData] = useState<QuestData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('upu_user_id');
    if (!userId) { setLoading(false); return; }
    fetch(`/api/dashboard/emlak/quest?userId=${userId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Yükleniyor...</p>;
  if (!data) return <p className="text-slate-500">Görev verileri yüklenemedi.</p>;

  const byChapter: Record<number, Mission[]> = {};
  for (const m of data.missions) {
    if (!m.chapter) continue;
    (byChapter[m.chapter] ||= []).push(m);
  }

  const activeMission = data.missions.find((m) => m.is_active);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">🎮 Görevlerim</h1>

      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Trophy className="text-amber-500" size={28} />
            <div>
              <div className="text-sm text-slate-500">Toplam XP</div>
              <div className="text-2xl font-bold text-slate-900">{data.totals.totalXp}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500" size={28} />
            <div>
              <div className="text-sm text-slate-500">Tamamlanan görev</div>
              <div className="text-2xl font-bold text-slate-900">{data.totals.completedCount} / {data.totals.total}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Flame className="text-orange-500" size={28} />
            <div>
              <div className="text-sm text-slate-500">Günlük seri</div>
              <div className="text-2xl font-bold text-slate-900">{data.streak.current_streak} gün</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Active mission */}
      {activeMission && (
        <Card className="p-6 mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
          <div className="flex items-start gap-4">
            <div className="text-4xl">{activeMission.emoji}</div>
            <div className="flex-1">
              <div className="text-xs text-indigo-600 font-medium mb-1 flex items-center gap-1">
                <Target size={14} /> AKTİF GÖREV
              </div>
              <h2 className="text-xl font-bold text-slate-900">{activeMission.title}</h2>
              <p className="text-sm text-slate-700 mt-1">{activeMission.description}</p>
              <div className="text-xs text-slate-500 mt-2">
                +{activeMission.xp_reward || 0} XP · {CHAPTER_NAMES[activeMission.chapter || 1]}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Chapters */}
      <div className="space-y-5">
        {Object.entries(byChapter).sort(([a], [b]) => +a - +b).map(([ch, missions]) => {
          const chNum = +ch;
          const info = data.chapters[chNum] || { total: 0, completed: 0, active: false };
          const pct = info.total > 0 ? Math.round((info.completed / info.total) * 100) : 0;

          return (
            <Card key={ch} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-900">{CHAPTER_NAMES[chNum] || `Bölüm ${ch}`}</h3>
                <span className="text-sm text-slate-500">{info.completed} / {info.total}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <ul className="space-y-2">
                {missions.map((m) => (
                  <li key={m.id} className={`flex items-start gap-3 text-sm p-2 rounded ${m.is_active ? 'bg-indigo-50' : ''}`}>
                    {m.status === 'completed' ? (
                      <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    ) : m.is_active ? (
                      <Circle className="text-indigo-500 shrink-0 mt-0.5 animate-pulse" size={18} />
                    ) : (
                      <Lock className="text-slate-300 shrink-0 mt-0.5" size={18} />
                    )}
                    <div className="flex-1">
                      <div className={`font-medium ${m.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                        {m.emoji} {m.title}
                      </div>
                      <div className="text-xs text-slate-500">+{m.xp_reward || 0} XP</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
