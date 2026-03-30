'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

interface ContractSummary {
  property_title?: string;
  property_address: string;
  owner_name: string;
  exclusive: boolean;
  commission: number;
  duration: number;
}

interface ContractInfo {
  id: string;
  type: string;
  status: string;
  summary: ContractSummary;
  signed?: boolean;
  signed_at?: string;
  signature_url?: string;
}

export default function SignPage() {
  const params = useParams();
  const token = params.token as string;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [signed, setSigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetchContract();
  }, [token]);

  useEffect(() => {
    if (!contract || signed) return;
    setupCanvas();
  }, [contract, signed]);

  async function fetchContract() {
    try {
      const res = await fetch(`/api/sign/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu.');
        return;
      }

      if (data.signed) {
        setSigned(true);
      }
      setContract(data);
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  function setupCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    function getPoint(e: MouseEvent | TouchEvent) {
      const r = canvas!.getBoundingClientRect();
      if ('touches' in e) {
        const touch = (e as TouchEvent).touches.item(0);
        if (touch) return { x: touch.clientX - r.left, y: touch.clientY - r.top };
      }
      return { x: (e as MouseEvent).clientX - r.left, y: (e as MouseEvent).clientY - r.top };
    }

    function startDraw(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      isDrawing.current = true;
      lastPoint.current = getPoint(e);
      setHasDrawn(true);
    }

    function draw(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      if (!isDrawing.current || !lastPoint.current) return;
      const point = getPoint(e);
      ctx!.beginPath();
      ctx!.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx!.lineTo(point.x, point.y);
      ctx!.stroke();
      lastPoint.current = point;
    }

    function endDraw(e: Event) {
      e.preventDefault();
      isDrawing.current = false;
      lastPoint.current = null;
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw);

    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', endDraw);
      canvas.removeEventListener('mouseleave', endDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', endDraw);
    };
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  }

  async function submitSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    setSubmitting(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const res = await fetch(`/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: dataUrl }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu.');
        return;
      }
      setSigned(true);
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.loadingText}>Sözleşme yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (signed && contract) {
    const s = contract.summary;
    const signDate = contract.signed_at
      ? new Date(contract.signed_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✅</div>
          <h1 style={styles.title}>Sözleşme İmzalandı</h1>
          <p style={styles.subtitle}>Bu sözleşme {signDate} tarihinde imzalanmıştır.</p>

          <div style={styles.summaryBox}>
            {s.property_title && <p style={styles.summaryLine}><strong>Mülk:</strong> {s.property_title}</p>}
            <p style={styles.summaryLine}><strong>Adres:</strong> {s.property_address}</p>
            <p style={styles.summaryLine}><strong>Mülk Sahibi:</strong> {s.owner_name}</p>
            <p style={styles.summaryLine}><strong>Münhasır:</strong> {s.exclusive ? 'Evet' : 'Hayır'}</p>
            <p style={styles.summaryLine}><strong>Komisyon:</strong> %{s.commission}+KDV</p>
            <p style={styles.summaryLine}><strong>Süre:</strong> {s.duration} ay</p>
          </div>

          {contract.signature_url && (
            <div style={{ textAlign: 'center' as const, marginBottom: '16px' }}>
              <p style={styles.signLabel}>İmza:</p>
              <img src={contract.signature_url} alt="İmza" style={{ maxWidth: '100%', height: '120px', border: '1px solid #dee2e6', borderRadius: '8px' }} />
            </div>
          )}

          <p style={styles.hint}>Bu sayfayı kapatabilirsiniz.</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✅</div>
          <h1 style={styles.title}>İmzalandı</h1>
          <p style={styles.subtitle}>Bu sözleşme başarıyla imzalanmıştır.</p>
          <p style={styles.hint}>Bu sayfayı kapatabilirsiniz.</p>
        </div>
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>❌</div>
          <h1 style={styles.title}>Hata</h1>
          <p style={styles.subtitle}>{error}</p>
        </div>
      </div>
    );
  }

  const s = contract!.summary;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Yetkilendirme Sözleşmesi</h1>
        <p style={styles.subtitle}>Aşağıdaki sözleşmeyi imzalamak üzeresiniz.</p>

        <div style={styles.summaryBox}>
          {s.property_title && <p style={styles.summaryLine}><strong>Mülk:</strong> {s.property_title}</p>}
          <p style={styles.summaryLine}><strong>Adres:</strong> {s.property_address}</p>
          <p style={styles.summaryLine}><strong>Mülk Sahibi:</strong> {s.owner_name}</p>
          <p style={styles.summaryLine}><strong>Münhasır:</strong> {s.exclusive ? 'Evet' : 'Hayır'}</p>
          <p style={styles.summaryLine}><strong>Komisyon:</strong> %{s.commission}+KDV</p>
          <p style={styles.summaryLine}><strong>Süre:</strong> {s.duration} ay</p>
        </div>

        <div style={styles.signArea}>
          <p style={styles.signLabel}>İmzanızı aşağıya çizin:</p>
          <canvas ref={canvasRef} style={styles.canvas} />
          <div style={styles.buttonRow}>
            <button onClick={clearSignature} style={styles.clearBtn}>Temizle</button>
            <button
              onClick={submitSignature}
              disabled={!hasDrawn || submitting}
              style={{ ...styles.submitBtn, opacity: (!hasDrawn || submitting) ? 0.5 : 1 }}
            >
              {submitting ? 'Gönderiliyor...' : 'İmzala ve Onayla'}
            </button>
          </div>
        </div>

        {error && <p style={styles.errorText}>{error}</p>}

        <p style={styles.legalNote}>
          &quot;İmzala ve Onayla&quot; butonuna basarak yukarıdaki sözleşme koşullarını kabul ettiğinizi onaylıyorsunuz.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  card: { background: '#ffffff', borderRadius: '16px', padding: '32px 24px', maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  title: { fontSize: '22px', fontWeight: 700, color: '#1a1a2e', textAlign: 'center' as const, margin: '0 0 8px 0' },
  subtitle: { fontSize: '14px', color: '#666', textAlign: 'center' as const, margin: '0 0 20px 0' },
  summaryBox: { background: '#f8f9fa', borderRadius: '10px', padding: '16px', marginBottom: '20px', border: '1px solid #e9ecef' },
  summaryLine: { fontSize: '13px', color: '#333', margin: '6px 0', lineHeight: 1.4 },
  signArea: { marginBottom: '16px' },
  signLabel: { fontSize: '14px', fontWeight: 600, color: '#1a1a2e', marginBottom: '8px' },
  canvas: { width: '100%', height: '180px', border: '2px solid #dee2e6', borderRadius: '10px', cursor: 'crosshair', touchAction: 'none', background: '#fff' },
  buttonRow: { display: 'flex', gap: '10px', marginTop: '12px' },
  clearBtn: { flex: 1, padding: '12px', border: '2px solid #dee2e6', borderRadius: '10px', background: '#fff', color: '#666', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  submitBtn: { flex: 2, padding: '12px', border: 'none', borderRadius: '10px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  errorText: { color: '#dc3545', fontSize: '13px', textAlign: 'center' as const, margin: '8px 0' },
  legalNote: { fontSize: '11px', color: '#999', textAlign: 'center' as const, lineHeight: 1.4, marginTop: '12px' },
  loadingText: { fontSize: '16px', color: '#666', textAlign: 'center' as const },
  successIcon: { fontSize: '48px', textAlign: 'center' as const, marginBottom: '12px' },
  errorIcon: { fontSize: '48px', textAlign: 'center' as const, marginBottom: '12px' },
  hint: { fontSize: '13px', color: '#999', textAlign: 'center' as const, marginTop: '8px' },
};
