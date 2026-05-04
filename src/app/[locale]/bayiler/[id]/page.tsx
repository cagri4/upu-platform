/**
 * /bayiler/[id] — bayi detay paneli (magic-link auth).
 *
 * Layout (desktop ≥ 1024px): 3 sütun
 *   Sol: Finansal kart (bakiye, kredi, vade durumu, son ödeme)
 *   Orta: Sipariş geçmişi tablosu
 *   Sağ: Timeline (notlar + WA + ödemeler + siparişler birleşik)
 *
 * Layout (mobile): tek sütun, kartlar dikey.
 *
 * Tour koridor banner (?tour=task2 query param): kritik vade vurgusu +
 * "💰 Vade Hatırlatma" buton highlighted (Faz 4 entegrasyonu).
 *
 * Aksiyon butonları sticky bottom (mobile) / sağ float (desktop):
 *   📩 WA Mesaj | 📞 Ara | ➕ Yeni Sipariş | 💰 Vade Hatırlatma |
 *   📝 Not Ekle | 🎁 Kampanya | ✏️ Düzenle | ⏸ Durum | 🗑 Sil
 *
 * Modal mantığı Faz 3b'de — şimdilik buton tıklayınca onClick: { setModal(...) }
 * placeholder uyarısı gösteriyor.
 */
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Dealer {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  isActive: boolean;
  balance: number;
  creditLimit: number;
  createdAt: string;
  code: string | null;
}

interface Finance {
  balance: number;
  creditLimit: number;
  openTotal: number;
  paidTotal: number;
  mostOverdueDays: number | null;
  isCritical: boolean;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  amount: number;
  isPaid: boolean;
  dueDate: string;
  paidAt: string | null;
  overdueDays: number | null;
}

interface Order {
  id: string;
  total: number;
  status: string;
  quantity: number;
  unitPrice: number;
  createdAt: string;
}

interface TimelineItem {
  type: string;
  icon: string;
  title: string;
  detail?: string;
  timestamp: string;
}

interface DetailResp {
  dealer: Dealer;
  finance: Finance;
  invoices: Invoice[];
  orders: Order[];
  timeline: TimelineItem[];
  campaigns: Array<{
    id: string;
    name: string;
    discountType: string;
    discountValue: number;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
  }>;
}

type ModalKey = null | "wa" | "vade" | "not" | "kampanya" | "siparis" | "duzenle" | "durum" | "sil";

function formatTry(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return "az önce";
  if (hours < 24) return `${hours} saat önce`;
  if (days < 7) return `${days} gün önce`;
  return formatDate(iso);
}

const ORDER_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Bekliyor",   cls: "bg-amber-50 text-amber-700" },
  preparing:  { label: "Hazırlanıyor", cls: "bg-sky-50 text-sky-700" },
  shipped:    { label: "Yolda",      cls: "bg-indigo-50 text-indigo-700" },
  delivered:  { label: "Teslim",     cls: "bg-emerald-50 text-emerald-700" },
  cancelled:  { label: "İptal",      cls: "bg-rose-50 text-rose-700" },
};

export default function BayiDetayPage() {
  const params = useParams();
  const sp = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const token = sp.get("t") || sp.get("token") || "";
  const tour = sp.get("tour") || "";

  const [data, setData] = useState<DetailResp | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalKey>(null);

  useEffect(() => {
    if (!token || !id) { setError("Geçersiz link."); setLoading(false); return; }
    fetch(`/api/bayiler/${id}?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Detay alınamadı");
        setData(d);
      })
      .catch(e => setError(e.message || "Bağlantı hatası"))
      .finally(() => setLoading(false));
  }, [id, token]);

  const tourBanner = useMemo(() => {
    if (!data || !tour) return null;
    if (tour === "task2" && data.finance.isCritical) {
      return {
        title: `🚨 Kritik vade — ${data.finance.mostOverdueDays} gün geçmiş`,
        body: `${data.dealer.name} — ${formatTry(data.finance.openTotal)} açık vade. AI hatırlatma metnini hazır şablondan oluşturup buradan gönderebilirsin.`,
        ctaLabel: "💰 Vade Hatırlatma Yolla",
        ctaModal: "vade" as ModalKey,
      };
    }
    return null;
  }, [data, tour]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">Yükleniyor...</div>;
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-rose-700 mb-2">Hata</h1>
          <p className="text-sm text-slate-600">{error || "Bayi bulunamadı."}</p>
        </div>
      </div>
    );
  }

  const { dealer, finance, invoices, orders, timeline } = data;
  const initials = dealer.name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join("");

  const backHref = `/tr/bayiler?t=${encodeURIComponent(token)}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 text-sm">
          <Link href={backHref} className="text-indigo-600 hover:underline">Bayilerim</Link>
          <span className="text-slate-400 mx-2">›</span>
          <span className="text-slate-700 font-medium">{dealer.name}</span>
        </div>
      </div>

      {/* Tour banner */}
      {tourBanner && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-start gap-3">
            <div className="flex-1">
              <h2 className="font-semibold text-amber-900 text-sm">{tourBanner.title}</h2>
              <p className="text-xs text-amber-800 mt-0.5">{tourBanner.body}</p>
            </div>
            <button
              onClick={() => setActiveModal(tourBanner.ctaModal)}
              className="flex-shrink-0 px-3 py-2 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700"
            >
              {tourBanner.ctaLabel}
            </button>
          </div>
        </div>
      )}

      {/* Üst özet kartı */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-bold text-white text-xl ${finance.isCritical ? "bg-rose-500" : dealer.isActive ? "bg-indigo-500" : "bg-slate-400"}`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">{dealer.name}</h1>
                {finance.isCritical && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">
                    KRİTİK
                  </span>
                )}
                {!dealer.isActive && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Pasif</span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                {dealer.contactName && <div>👤 {dealer.contactName}</div>}
                {dealer.contactPhone && (
                  <div>
                    📞 <a href={`tel:${dealer.contactPhone}`} className="text-indigo-600 hover:underline">{dealer.contactPhone}</a>
                  </div>
                )}
                {dealer.email && (
                  <div>📧 <a href={`mailto:${dealer.email}`} className="text-indigo-600 hover:underline">{dealer.email}</a></div>
                )}
                {(dealer.city || dealer.country) && <div>📍 {[dealer.city, dealer.country].filter(Boolean).join(", ")}</div>}
                {dealer.code && <div>🏷 Kod: <span className="font-mono">{dealer.code}</span></div>}
                <div>📅 Kayıt: {formatDate(dealer.createdAt)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Sütun layout */}
      <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sol — Finansal */}
        <section className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">💳 Finansal Durum</h3>
            <div>
              <div className="text-xs text-slate-500">Toplam Bakiye</div>
              <div className={`text-2xl font-bold ${finance.balance > 0 ? "text-rose-600" : finance.balance < 0 ? "text-emerald-600" : "text-slate-700"}`}>
                {formatTry(finance.balance)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {finance.balance > 0 ? "Bayi borçlu" : finance.balance < 0 ? "Avans var" : "Bakiye sıfır"}
              </div>
            </div>

            {finance.creditLimit > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Kredi limiti</span>
                  <span>{formatTry(finance.balance)} / {formatTry(finance.creditLimit)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${finance.balance / finance.creditLimit > 0.8 ? "bg-rose-500" : finance.balance / finance.creditLimit > 0.5 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(100, (finance.balance / finance.creditLimit) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <div className="text-[10px] text-amber-600 uppercase">Açık Vade</div>
                <div className="text-sm font-semibold text-amber-700">{formatTry(finance.openTotal)}</div>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <div className="text-[10px] text-emerald-600 uppercase">Ödenen</div>
                <div className="text-sm font-semibold text-emerald-700">{formatTry(finance.paidTotal)}</div>
              </div>
            </div>

            {finance.mostOverdueDays !== null && finance.mostOverdueDays >= 0 && (
              <div className={`mt-3 p-2 rounded-lg text-xs ${finance.isCritical ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                ⏰ En geç vade: <strong>{finance.mostOverdueDays} gün</strong> {finance.mostOverdueDays > 0 ? "geçmiş" : "kaldı"}
              </div>
            )}
          </div>

          {/* Vade hareketleri (faturalar) */}
          {invoices.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Vade Hareketleri</h3>
              <div className="space-y-1.5">
                {invoices.slice(0, 5).map(inv => (
                  <div key={inv.id} className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-slate-700">{inv.invoiceNo}</div>
                      <div className="text-slate-400">Vade: {formatDate(inv.dueDate)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatTry(inv.amount)}</div>
                      {inv.isPaid ? (
                        <div className="text-emerald-600 text-[10px]">✓ Ödendi</div>
                      ) : inv.overdueDays !== null && inv.overdueDays >= 7 ? (
                        <div className="text-rose-600 text-[10px] font-semibold">{inv.overdueDays} gün geçmiş</div>
                      ) : inv.overdueDays !== null && inv.overdueDays >= 0 ? (
                        <div className="text-amber-600 text-[10px]">Bekliyor</div>
                      ) : (
                        <div className="text-slate-400 text-[10px]">Vade öncesi</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Orta — Sipariş geçmişi */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">🛒 Sipariş Geçmişi</h3>
            <button
              onClick={() => setActiveModal("siparis")}
              className="text-xs text-indigo-600 hover:underline"
            >
              + Yeni Sipariş
            </button>
          </div>
          {orders.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Henüz sipariş yok.</p>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {orders.map(o => {
                const stat = ORDER_STATUS_LABEL[o.status] || { label: o.status, cls: "bg-slate-100 text-slate-600" };
                return (
                  <div key={o.id} className="border border-slate-100 rounded-lg p-2.5 hover:bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-500">{formatDateTime(o.createdAt)}</div>
                        <div className="text-sm font-medium text-slate-800 truncate">
                          {o.quantity} adet × {formatTry(o.unitPrice)}
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="font-semibold text-sm">{formatTry(o.total)}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stat.cls}`}>{stat.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Sağ — Timeline */}
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">📜 Timeline</h3>
            <button
              onClick={() => setActiveModal("not")}
              className="text-xs text-indigo-600 hover:underline"
            >
              + Not Ekle
            </button>
          </div>
          {timeline.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Henüz etkileşim yok.</p>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {timeline.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className="flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-700 font-medium">{item.title}</div>
                    {item.detail && <div className="text-slate-500 truncate">{item.detail}</div>}
                    <div className="text-[10px] text-slate-400 mt-0.5">{relativeTime(item.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Sticky aksiyon barı */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-lg z-30">
        <div className="max-w-6xl mx-auto px-2 py-2 flex gap-1 overflow-x-auto">
          {[
            { key: "wa" as ModalKey, icon: "📩", label: "WA Mesaj" },
            { key: "vade" as ModalKey, icon: "💰", label: "Vade Hatırlatma", primary: finance.isCritical },
            { key: "not" as ModalKey, icon: "📝", label: "Not" },
            { key: "kampanya" as ModalKey, icon: "🎁", label: "Kampanya" },
            { key: "siparis" as ModalKey, icon: "➕", label: "Sipariş" },
            { key: "duzenle" as ModalKey, icon: "✏️", label: "Düzenle" },
            { key: "durum" as ModalKey, icon: "⏸", label: "Durum" },
            { key: "sil" as ModalKey, icon: "🗑", label: "Sil" },
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => setActiveModal(btn.key)}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap ${
                btn.primary ? "bg-amber-500 text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="text-base">{btn.icon}</span>
              <span>{btn.label}</span>
            </button>
          ))}
          {dealer.contactPhone && (
            <a
              href={`tel:${dealer.contactPhone}`}
              className="flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap text-sky-600 hover:bg-sky-50"
            >
              <span className="text-base">📞</span>
              <span>Ara</span>
            </a>
          )}
        </div>
      </div>

      {/* Modal placeholder — Faz 3b: gerçek modaller */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              {modalTitle(activeModal)}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Bu aksiyon yakında — entegrasyon Faz 3b'de tamamlanacak. Şimdilik bayinin detay sayfasını
              gezebilir ve mevcut bilgileri inceleyebilirsiniz.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function modalTitle(key: ModalKey): string {
  switch (key) {
    case "wa": return "📩 WA Mesaj Gönder";
    case "vade": return "💰 Vade Hatırlatma";
    case "not": return "📝 Not Ekle";
    case "kampanya": return "🎁 Özel Kampanya";
    case "siparis": return "➕ Yeni Sipariş";
    case "duzenle": return "✏️ Bayi Düzenle";
    case "durum": return "⏸ Durum Değiştir";
    case "sil": return "🗑 Bayi Sil";
    default: return "";
  }
}
