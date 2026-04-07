'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Bell, Shield, CreditCard, Check, X } from 'lucide-react';
import { getTenantByDomain, getTenantByKey } from '@/tenants/config';
import { COMMAND_LABELS } from '@/platform/whatsapp/command-labels';

// ── Plan Definitions ────────────────────────────────────────────────

interface PlanTier {
  name: string;
  price: number;
  label: string;
  highlight?: boolean;
}

const PLANS: PlanTier[] = [
  { name: "free", price: 29, label: "Free" },
  { name: "starter", price: 499, label: "Starter", highlight: true },
  { name: "pro", price: 1299, label: "Pro" },
];

// Command access by plan — true = included
// Logic: Free = view-only basics, Starter = core actions, Pro = everything
const PLAN_ACCESS: Record<string, Record<string, boolean>> = {
  // ── Emlak ──
  // Portföy Sorumlusu
  portfoyum:      { free: true,  starter: true,  pro: true },
  mulkekle:       { free: false, starter: true,  pro: true },
  mulkyonet:      { free: false, starter: true,  pro: true },
  // Satış Destek
  musterilerim:   { free: true,  starter: true,  pro: true },
  musteriEkle:    { free: false, starter: true,  pro: true },
  musteriDuzenle: { free: false, starter: true,  pro: true },
  eslestir:       { free: false, starter: false, pro: true },
  hatirlatma:     { free: false, starter: true,  pro: true },
  takipEt:        { free: false, starter: false, pro: true },
  satistavsiye:   { free: false, starter: false, pro: true },
  ortakpazar:     { free: false, starter: false, pro: true },
  sunum:          { free: false, starter: true,  pro: true },
  sunumlarim:     { free: false, starter: true,  pro: true },
  // Medya
  fotograf:       { free: false, starter: true,  pro: true },
  yayinla:        { free: false, starter: false, pro: true },
  paylas:         { free: false, starter: true,  pro: true },
  websitem:       { free: false, starter: false, pro: true },
  // Pazar Analisti
  fiyatsor:       { free: true,  starter: true,  pro: true },
  degerle:        { free: false, starter: true,  pro: true },
  mulkoner:       { free: false, starter: false, pro: true },
  analiz:         { free: false, starter: true,  pro: true },
  rapor:          { free: false, starter: false, pro: true },
  trend:          { free: false, starter: true,  pro: true },
  // Sekreter
  brifing:        { free: true,  starter: true,  pro: true },
  gorevler:       { free: false, starter: true,  pro: true },
  sozlesme:       { free: false, starter: false, pro: true },
  sozlesmelerim:  { free: false, starter: false, pro: true },
  hediyeler:      { free: false, starter: false, pro: true },

  // ── Bayi ──
  ozet:           { free: true,  starter: true,  pro: true },
  takvim:         { free: true,  starter: true,  pro: true },
  kampanyaolustur:{ free: false, starter: true,  pro: true },
  kampanyalar:    { free: false, starter: true,  pro: true },
  teklifver:      { free: false, starter: false, pro: true },
  performans:     { free: false, starter: true,  pro: true },
  segment:        { free: false, starter: false, pro: true },
  siparisolustur: { free: false, starter: true,  pro: true },
  siparisler:     { free: true,  starter: true,  pro: true },
  bayidurum:      { free: true,  starter: true,  pro: true },
  ziyaretnotu:    { free: false, starter: true,  pro: true },
  ziyaretler:     { free: false, starter: true,  pro: true },
  bakiye:         { free: true,  starter: true,  pro: true },
  faturalar:      { free: true,  starter: true,  pro: true },
  borcdurum:      { free: true,  starter: true,  pro: true },
  ekstre:         { free: false, starter: true,  pro: true },
  odeme:          { free: false, starter: true,  pro: true },
  vadeler:        { free: false, starter: true,  pro: true },
  tahsilat:       { free: false, starter: true,  pro: true },
  hatirlatgonder: { free: false, starter: false, pro: true },
  stok:           { free: true,  starter: true,  pro: true },
  kritikstok:     { free: true,  starter: true,  pro: true },
  stokhareketleri:{ free: false, starter: true,  pro: true },
  tedarikciler:   { free: false, starter: true,  pro: true },
  satinalma:      { free: false, starter: false, pro: true },
  ihtiyac:        { free: false, starter: false, pro: true },
  teslimatlar:    { free: false, starter: true,  pro: true },
  rota:           { free: false, starter: false, pro: true },
  kargotakip:     { free: false, starter: true,  pro: true },
  urunler:        { free: true,  starter: true,  pro: true },
  fiyatliste:     { free: true,  starter: true,  pro: true },
  yeniurun:       { free: false, starter: true,  pro: true },
  fiyatguncelle:  { free: false, starter: true,  pro: true },
};

// ── Main Component ──────────────────────────────────────────────────

export default function SettingsPage() {
  const [tenantKey, setTenantKey] = useState('emlak');
  const [currentPlan, setCurrentPlan] = useState('Deneme');
  const [userRole, setUserRole] = useState<string>('admin');

  useEffect(() => {
    const hostname = window.location.host;
    const tenant = getTenantByDomain(hostname) || getTenantByKey('emlak');

    const userId = localStorage.getItem('upu_user_id');
    if (userId) {
      fetch(`/api/auth/user-role?userId=${userId}`)
        .then(r => r.json())
        .then(d => { if (d.role) setUserRole(d.role); })
        .catch(() => {});
    }
    if (tenant) setTenantKey(tenant.key);
  }, []);

  const tenant = getTenantByKey(tenantKey);
  const employees = tenant?.employees || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Ayarlar</h1>

      <div className="space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-500" /> Profil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Ad Soyad</Label>
                <Input placeholder="Adiniz" />
              </div>
              <div>
                <Label>E-posta</Label>
                <Input placeholder="email@example.com" type="email" />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input placeholder="05xx xxx xx xx" />
              </div>
              <div>
                <Label>Sirket</Label>
                <Input placeholder="Sirket adi" />
              </div>
            </div>
            <Button className="mt-4">Kaydet</Button>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5 text-slate-500" /> Dil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {[
                { code: 'tr', label: 'Turkce', flag: '🇹🇷' },
                { code: 'en', label: 'English', flag: '🇬🇧' },
                { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:border-indigo-500 transition text-sm"
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-slate-500" /> Bildirimler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'WhatsApp bildirimleri', desc: 'Bot mesajlari ve hatirlatmalar' },
                { label: 'E-posta bildirimleri', desc: 'Haftalik raporlar ve ozetler' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-indigo-500" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Subscription & Plan Comparison (admin only) ──────────── */}
        {userRole !== 'dealer' && userRole !== 'employee' && <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-slate-500" /> Abonelik
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Current Plan */}
            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Mevcut Plan</p>
              <p className="text-xl font-bold text-slate-900">{currentPlan}</p>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Aktif</span>
            </div>

            {/* Plan Headers */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-3 bg-slate-50 border-b border-slate-200 w-1/4">
                      Eleman / Komut
                    </th>
                    {PLANS.map(plan => (
                      <th key={plan.name} className={`text-center px-3 py-3 border-b border-slate-200 ${plan.highlight ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                        <div className="font-bold text-base">{plan.label}</div>
                        <div className="text-lg font-bold mt-1">
                          <span className="text-slate-400 text-xs">₺</span>{plan.price}
                          <span className="text-slate-400 text-xs font-normal">/ay</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <>
                      {/* Employee header row */}
                      <tr key={`emp-${emp.key}`}>
                        <td colSpan={4} className="px-3 py-2.5 bg-slate-100 font-semibold text-slate-700 border-b border-slate-200">
                          {emp.icon} {emp.name}
                        </td>
                      </tr>
                      {/* Command rows */}
                      {emp.commands.map(cmd => {
                        const access = PLAN_ACCESS[cmd] || { free: false, starter: false, pro: true };
                        const label = COMMAND_LABELS[cmd] || cmd;
                        return (
                          <tr key={cmd} className="hover:bg-slate-50 border-b border-slate-100">
                            <td className="px-3 py-2 text-slate-600">{label}</td>
                            {PLANS.map(plan => (
                              <td key={plan.name} className={`text-center px-3 py-2 ${plan.highlight ? 'bg-indigo-50/30' : ''}`}>
                                {access[plan.name] ? (
                                  <Check className="w-4 h-4 text-green-500 mx-auto" />
                                ) : (
                                  <X className="w-4 h-4 text-red-300 mx-auto" />
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Plan Select Buttons */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {PLANS.map(plan => (
                <button
                  key={plan.name}
                  className={`py-3 rounded-lg text-sm font-medium transition ${
                    plan.highlight
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {plan.label} Sec — ₺{plan.price}/ay
                </button>
              ))}
            </div>
          </CardContent>
        </Card>}
      </div>
    </div>
  );
}
