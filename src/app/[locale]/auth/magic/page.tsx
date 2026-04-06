'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function MagicLinkPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Token bulunamadı.');
      return;
    }
    verifyToken(token);
  }, [token]);

  async function verifyToken(t: string) {
    try {
      const res = await fetch(`/api/auth/magic-verify?token=${t}`);
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setError(data.error || 'Geçersiz veya süresi dolmuş link.');
        return;
      }

      setStatus('success');
      // Save user info for dashboard
      if (data.userId) localStorage.setItem('upu_user_id', data.userId);
      if (data.name) localStorage.setItem('upu_user_name', data.name);
      // Redirect to dashboard after short delay
      setTimeout(() => {
        window.location.href = '/tr/dashboard';
      }, 1500);
    } catch {
      setStatus('error');
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-900">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-xl">
        {status === 'loading' && (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Giriş yapılıyor...</h1>
            <p className="text-slate-500 text-sm">Lütfen bekleyin.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Giriş başarılı!</h1>
            <p className="text-slate-500 text-sm">Panele yönlendiriliyorsunuz...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Giriş başarısız</h1>
            <p className="text-slate-500 text-sm mb-4">{error}</p>
            <a href="/tr/login" className="text-indigo-600 hover:underline text-sm">Normal giriş yapın →</a>
          </>
        )}
      </div>
    </div>
  );
}
