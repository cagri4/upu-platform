'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Check, Crown } from 'lucide-react';

interface Subscription {
  id: string;
  plan: string;
  status: string;
  amount: number;
  currency: string;
  current_period_end: string;
  trial_ends_at: string;
}

const PLANS = [
  {
    key: 'starter',
    name: 'Başlangıç',
    price: 399,
    features: ['Tüm sanal elemanlar', 'Temel yetenekler', 'WhatsApp entegrasyonu', 'E-posta destek'],
    popular: false,
  },
  {
    key: 'pro',
    name: 'Profesyonel',
    price: 1199,
    features: ['Tüm sanal elemanlar', 'Gelişmiş yetenekler', 'Sınırsız komut', 'Öncelikli destek', 'Çoklu kullanıcı'],
    popular: true,
  },
  {
    key: 'office',
    name: 'Ofis',
    price: 1499,
    features: ['Tüm sanal elemanlar', 'Tüm yetenekler', 'Sınırsız her şey', '5 kullanıcı', 'API erişimi', 'Özel entegrasyon'],
    popular: false,
  },
];

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/current')
      .then(res => res.json())
      .then(data => setSubscription(data.subscription))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const currentPlan = subscription?.plan || 'trial';
  const statusLabel = {
    active: 'Aktif',
    trial: 'Deneme',
    cancelled: 'İptal',
    past_due: 'Ödeme Bekliyor',
  }[subscription?.status || 'trial'] || 'Deneme';

  const statusColor = {
    active: 'bg-green-100 text-green-700',
    trial: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
    past_due: 'bg-amber-100 text-amber-700',
  }[subscription?.status || 'trial'] || 'bg-blue-100 text-blue-700';

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Abonelik</h1>

      {/* Current Plan */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-500" /> Mevcut Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-400">Yükleniyor...</p>
          ) : (
            <div className="flex items-center gap-4">
              <div>
                <p className="text-2xl font-bold capitalize">{currentPlan === 'trial' ? 'Deneme' : currentPlan}</p>
                <Badge className={statusColor}>{statusLabel}</Badge>
              </div>
              {subscription?.trial_ends_at && currentPlan === 'trial' && (
                <p className="text-sm text-slate-500">
                  Deneme bitiş: {new Date(subscription.trial_ends_at).toLocaleDateString('tr-TR')}
                </p>
              )}
              {subscription?.current_period_end && currentPlan !== 'trial' && (
                <p className="text-sm text-slate-500">
                  Sonraki ödeme: {new Date(subscription.current_period_end).toLocaleDateString('tr-TR')}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Planlar</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          return (
            <Card
              key={plan.key}
              className={`relative ${plan.popular ? 'border-2 border-indigo-500' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-semibold px-3 py-0.5 rounded-full flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Popüler
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">₺{plan.price.toLocaleString('tr-TR')}</span>
                  <span className="text-slate-500">/ay</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className={`w-4 h-4 shrink-0 ${plan.popular ? 'text-indigo-500' : 'text-green-500'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
                  disabled={isCurrent}
                >
                  {isCurrent ? 'Mevcut Plan' : 'Seç'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
