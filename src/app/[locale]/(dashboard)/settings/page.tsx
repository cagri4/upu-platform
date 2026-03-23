'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Bell, Shield } from 'lucide-react';

export default function SettingsPage() {
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
                <Input placeholder="Adınız" />
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
                <Label>Şirket</Label>
                <Input placeholder="Şirket adı" />
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
                { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
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
                { label: 'WhatsApp bildirimleri', desc: 'Bot mesajları ve hatırlatmalar' },
                { label: 'E-posta bildirimleri', desc: 'Haftalık raporlar ve özetler' },
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
      </div>
    </div>
  );
}
