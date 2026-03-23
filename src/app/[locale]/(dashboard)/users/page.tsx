'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Copy, Check } from 'lucide-react';

interface User {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  whatsapp_phone: string;
  created_at: string;
}

interface InviteCode {
  code: string;
  status: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [creating, setCreating] = useState(false);
  const [lastCode, setLastCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setInvites(data.invites || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createUser() {
    if (!formData.name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: null, // Will be resolved from domain
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastCode(data.inviteCode);
        setFormData({ name: '', email: '', phone: '' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div className="p-6 text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Kullanıcılar</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <UserPlus className="w-4 h-4 mr-2" /> Kullanıcı Ekle
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Yeni Kullanıcı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label>Ad Soyad *</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <Label>E-posta</Label>
                <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
            <Button onClick={createUser} disabled={creating || !formData.name}>
              {creating ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>

            {lastCode && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg flex items-center gap-3">
                <span className="text-sm text-green-700">Davet Kodu: <strong>{lastCode}</strong></span>
                <button onClick={() => copyCode(lastCode)} className="text-green-600 hover:text-green-800">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Users list */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Ad</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">E-posta</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">WhatsApp</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Kayıt</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Henüz kullanıcı yok</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{u.display_name || '-'}</td>
                      <td className="px-4 py-3 text-slate-500">{u.email || '-'}</td>
                      <td className="px-4 py-3">
                        {u.whatsapp_phone ? (
                          <Badge variant="secondary" className="text-xs">{u.whatsapp_phone}</Badge>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{new Date(u.created_at).toLocaleDateString('tr-TR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pending invites */}
      {invites.filter(i => i.status === 'pending').length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Bekleyen Davetler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {invites.filter(i => i.status === 'pending').map((inv) => (
                <div key={inv.code} className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg">
                  <span className="text-sm font-mono font-semibold text-amber-700">{inv.code}</span>
                  <button onClick={() => copyCode(inv.code)} className="text-amber-500 hover:text-amber-700">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
