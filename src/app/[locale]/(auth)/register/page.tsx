'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function RegisterPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { kvkkConsent: false as unknown as true },
  });

  const kvkkConsent = watch('kvkkConsent');

  async function onSubmit(data: RegisterInput) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Kayıt başarısız');
        return;
      }
      window.location.href = '/tr/dashboard';
    } catch {
      setError('Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0">
        <CardTitle className="text-2xl">Kayıt Ol</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Ad Soyad *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-posta *</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Şifre *</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" {...register('phone')} placeholder="05xx xxx xx xx" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Şirket</Label>
            <Input id="company" {...register('company')} />
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="kvkk"
              checked={kvkkConsent === true}
              onCheckedChange={(checked) => setValue('kvkkConsent', checked as boolean as true)}
            />
            <Label htmlFor="kvkk" className="text-sm leading-5">
              <Link href="/tr/kvkk" className="text-indigo-600 hover:underline">KVKK Aydınlatma Metni</Link>&apos;ni okudum ve kabul ediyorum. *
            </Label>
          </div>
          {errors.kvkkConsent && <p className="text-sm text-red-500">{errors.kvkkConsent.message}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
          </Button>

          <p className="text-sm text-center text-slate-500">
            Hesabınız var mı?{' '}
            <Link href="/tr/login" className="text-indigo-600 hover:underline">Giriş Yap</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
