"use client";

/**
 * Public vitrine sayfası — Faz C 3.5.
 * Auth yok. Slug üzerinden ürün katalogu + lead form.
 * Mobile-first; tek sayfa, sticky lead-form drawer.
 */
import { useEffect, useState, useCallback, use } from "react";

interface Product {
  id: string;
  name: string;
  code: string | null;
  unit_price: number;
  in_stock: boolean;
  image_url: string | null;
  description: string | null;
  category: string | null;
}

interface Vitrine {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  logo_url: string | null;
  accent_color: string;
  show_prices: boolean;
  dealer_name: string | null;
}

export default function VitrinePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [vitrine, setVitrine] = useState<Vitrine | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/public/vitrine/${encodeURIComponent(slug)}`);
    const d = await r.json();
    if (r.ok) {
      setVitrine(d.vitrine);
      setProducts(d.products || []);
    } else {
      setNotFound(true);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  function add(id: string) { setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 })); }
  function dec(id: string) {
    setCart(c => {
      const v = (c[id] || 0) - 1;
      const next = { ...c };
      if (v <= 0) delete next[id];
      else next[id] = v;
      return next;
    });
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    const items = Object.entries(cart).map(([pid, qty]) => {
      const p = products.find(x => x.id === pid);
      return {
        product_id: pid,
        product_name: p?.name || "Ürün",
        quantity: qty,
        unit_price: p?.unit_price || 0,
      };
    });
    const r = await fetch(`/api/public/vitrine/${encodeURIComponent(slug)}/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: form.name,
        customer_phone: form.phone,
        customer_email: form.email,
        message: form.message,
        items: items.length > 0 ? items : undefined,
      }),
    });
    const d = await r.json();
    setSubmitting(false);
    if (!r.ok) {
      setError(d.error || "Gönderilemedi.");
      return;
    }
    setSubmitted(true);
    setCart({});
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (notFound || !vitrine) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-5xl mb-3">🏪</div>
          <h1 className="text-xl font-bold text-slate-900">Vitrin bulunamadı</h1>
          <p className="text-sm text-slate-500 mt-2">Bu adres aktif değil veya kaldırılmış olabilir.</p>
        </div>
      </div>
    );
  }

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [pid, qty]) => {
    const p = products.find(x => x.id === pid);
    return sum + (p?.unit_price || 0) * qty;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50" style={{ "--accent": vitrine.accent_color } as React.CSSProperties}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          {vitrine.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vitrine.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">{vitrine.title}</h1>
            {vitrine.subtitle && <p className="text-xs text-slate-500 truncate">{vitrine.subtitle}</p>}
          </div>
        </div>
      </header>

      {/* Products */}
      <main className="max-w-4xl mx-auto px-4 py-4 pb-32">
        {submitted && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mb-4">
            <div className="font-semibold text-emerald-900">✓ Talebinizi aldık</div>
            <p className="text-sm text-emerald-700 mt-1">Bayimiz en kısa sürede sizinle iletişime geçecek.</p>
          </div>
        )}

        {products.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-500">Henüz ürün yüklenmedi.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {products.map(p => (
              <article key={p.id} className="bg-white rounded-xl border border-slate-200 p-3 flex gap-3">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="w-20 h-20 rounded-lg object-cover bg-slate-100" />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center text-2xl text-slate-400">📦</div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 text-sm truncate">{p.name}</h3>
                  {p.category && <p className="text-[10px] text-slate-400">{p.category}</p>}
                  {vitrine.show_prices && (
                    <div className="text-sm font-bold mt-1" style={{ color: vitrine.accent_color }}>
                      ₺{p.unit_price.toLocaleString("tr-TR")}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    {!p.in_stock ? (
                      <span className="text-[10px] text-rose-600 font-medium">Stokta yok</span>
                    ) : cart[p.id] ? (
                      <div className="inline-flex items-center gap-1 bg-slate-100 rounded-full">
                        <button onClick={() => dec(p.id)} className="w-7 h-7 rounded-full text-sm font-bold">−</button>
                        <span className="text-sm font-medium px-1 min-w-[20px] text-center">{cart[p.id]}</span>
                        <button onClick={() => add(p.id)} className="w-7 h-7 rounded-full text-sm font-bold">+</button>
                      </div>
                    ) : (
                      <button onClick={() => add(p.id)} className="text-xs px-3 py-1 rounded-full text-white font-medium" style={{ backgroundColor: vitrine.accent_color }}>
                        Ekle
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Sticky CTA */}
      {!submitted && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3 z-20">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="flex-1 text-xs text-slate-600">
              {cartCount > 0 ? (
                <>
                  <span className="font-semibold">{cartCount} ürün</span>
                  {vitrine.show_prices && <> · ₺{cartTotal.toLocaleString("tr-TR")}</>}
                </>
              ) : (
                "Ürün seçmeden de talep gönderebilirsin."
              )}
            </div>
            <button onClick={() => setShowForm(true)}
              className="rounded-full px-5 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: vitrine.accent_color }}>
              Talep Gönder
            </button>
          </div>
        </div>
      )}

      {/* Form drawer */}
      {showForm && !submitted && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center p-3" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 mb-3">İletişim Bilgileriniz</h2>
            <div className="space-y-2">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="İsim Soyisim *" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Telefon" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="E-posta" type="email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="Notunuz (opsiyonel)" rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none" />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Telefon veya e-postadan en az birini girin.</p>
            {error && <div className="text-xs text-rose-600 mt-2">{error}</div>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium">İptal</button>
              <button onClick={() => void submit()} disabled={submitting || !form.name || (!form.phone && !form.email)}
                className="flex-1 rounded-md text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: vitrine.accent_color }}>
                {submitting ? "Gönderiliyor…" : "Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
