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
  const [toast, setToast] = useState<string>("");

  // Toast helper — 3sn sonra otomatik kaybolur
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // Local timeline'a yeni item ekle (mock submit sonrası UX feedback)
  function pushTimelineItem(item: TimelineItem) {
    setData(prev => prev ? { ...prev, timeline: [item, ...prev.timeline] } : prev);
  }

  useEffect(() => {
    if (!token || !id) { setError("Geçersiz link."); setLoading(false); return; }
    fetch(`/api/bayiler/${id}?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Detay alınamadı");
        setData(d);
        // Tour koridor — kritik bayi detayı açıldı (Task 2). Tour step
        // 3'teyse step 4'e ilerler; değilse server no-op.
        if (d.finance?.isCritical) {
          fetch(`/api/tour/advance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, event: "tour_kritik_bayi_done" }),
          }).catch(() => { /* sessiz */ });
        }
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

      {/* Aksiyon Modalleri */}
      {activeModal && (
        <ActionModal
          modalKey={activeModal}
          dealer={dealer}
          finance={finance}
          onClose={() => setActiveModal(null)}
          onSuccess={(timelineItem, toastMsg) => {
            if (timelineItem) pushTimelineItem(timelineItem);
            if (toastMsg) showToast(toastMsg);
            setActiveModal(null);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ActionModal — 8 aksiyon için tek modal componenti
// ─────────────────────────────────────────────────────────────────────

interface ActionModalProps {
  modalKey: NonNullable<ModalKey>;
  dealer: Dealer;
  finance: Finance;
  onClose: () => void;
  onSuccess: (timelineItem: TimelineItem | null, toast: string) => void;
}

function ActionModal({ modalKey, dealer, finance, onClose, onSuccess }: ActionModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {modalKey === "wa" && <WaMessageForm dealer={dealer} onClose={onClose} onSuccess={onSuccess} />}
        {modalKey === "vade" && <VadeHatirlatmaForm dealer={dealer} finance={finance} onClose={onClose} onSuccess={onSuccess} />}
        {modalKey === "not" && <NotEkleForm dealer={dealer} onClose={onClose} onSuccess={onSuccess} />}
        {modalKey === "kampanya" && <KampanyaForm dealer={dealer} onClose={onClose} onSuccess={onSuccess} />}
        {modalKey === "siparis" && <YeniSiparisForm dealer={dealer} onClose={onClose} onSuccess={onSuccess} />}
        {modalKey === "duzenle" && <DuzenleForm dealer={dealer} onClose={onClose} onSuccess={onSuccess} />}
        {modalKey === "durum" && <DurumForm dealer={dealer} onClose={onClose} onSuccess={onSuccess} />}
        {modalKey === "sil" && <SilForm dealer={dealer} onClose={onClose} onSuccess={onSuccess} />}
      </div>
    </div>
  );
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
      </div>
      <div className="p-4">{children}</div>
    </>
  );
}

// ── WA Mesaj Gönder ──────────────────────────────────────────────────
const WA_TEMPLATES: Record<string, string> = {
  custom:    "",
  greeting:  "Merhaba {AD}, umarız işleriniz iyi gidiyor. Yeni ürünlerimizi incelemek ister misiniz?",
  yeni_urun: "Yeni gelen ürünler hakkında bilgi vermek için arıyoruz. Detay için kataloğumuza bakabilirsiniz: ...",
  kampanya:  "🎁 Özel kampanya: %15 indirim 30 Mayıs'a kadar geçerli. Sipariş için cevap yazın.",
  vade:      "Sayın {AD}, {TUTAR} ₺ vadeniz {GUN} gün geçmiş. Ödeme için detay: /borç",
};

function WaMessageForm({ dealer, onClose, onSuccess }: { dealer: Dealer; onClose: () => void; onSuccess: ActionModalProps["onSuccess"] }) {
  const [tmpl, setTmpl] = useState("custom");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  function applyTemplate(key: string) {
    setTmpl(key);
    const text = (WA_TEMPLATES[key] || "")
      .replace("{AD}", dealer.contactName || dealer.name)
      .replace("{TUTAR}", "0")
      .replace("{GUN}", "0");
    setContent(text);
  }

  async function handleSend() {
    if (!content.trim()) return;
    setSending(true);
    // Mock — gerçek WA API hit etmiyoruz (demo modu)
    await new Promise(r => setTimeout(r, 500));
    onSuccess({
      type: "message",
      icon: "📤",
      title: "WhatsApp gönderildi",
      detail: content.slice(0, 80) + (content.length > 80 ? "…" : ""),
      timestamp: new Date().toISOString(),
    }, "✅ Mesaj gönderildi");
    setSending(false);
  }

  return (
    <ModalShell title="📩 WA Mesaj Gönder" onClose={onClose}>
      <p className="text-xs text-slate-500 mb-3">Alıcı: <strong>{dealer.name}</strong> {dealer.contactPhone && `(${dealer.contactPhone})`}</p>
      <label className="text-xs font-medium text-slate-700 block mb-1">Şablon seç</label>
      <select value={tmpl} onChange={e => applyTemplate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
        <option value="custom">Özel mesaj</option>
        <option value="greeting">Selamlama</option>
        <option value="yeni_urun">Yeni ürün bildirimi</option>
        <option value="kampanya">Kampanya duyurusu</option>
        <option value="vade">Vade hatırlatma</option>
      </select>
      <label className="text-xs font-medium text-slate-700 block mb-1">Mesaj</label>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={5}
        placeholder="Mesajınızı yazın…"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex gap-2 mt-4 justify-end">
        <button onClick={onClose} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
        <button
          onClick={handleSend}
          disabled={sending || !content.trim()}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {sending ? "Gönderiliyor…" : "Gönder"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Vade Hatırlatma ──────────────────────────────────────────────────
function VadeHatirlatmaForm({ dealer, finance, onClose, onSuccess }: { dealer: Dealer; finance: Finance; onClose: () => void; onSuccess: ActionModalProps["onSuccess"] }) {
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token") || "";
  const days = finance.mostOverdueDays || 0;
  const tutar = finance.openTotal;
  const defaultMsg = `Sayın ${dealer.contactName || dealer.name}, ${formatTry(tutar)} vadeniz ${days > 0 ? `${days} gün geçmiş` : "yaklaşıyor"}. Ödeme için sorularınızı yazabilirsiniz.`;
  const [msg, setMsg] = useState(defaultMsg);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    await new Promise(r => setTimeout(r, 600));
    // Tour koridor — vade hatırlatma yollandı (Task 3). Tour step 4'teyse
    // step 5'e ilerler; değilse server no-op.
    if (token) {
      fetch(`/api/tour/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, event: "tour_urunler_done" }),
      }).catch(() => { /* sessiz */ });
    }
    onSuccess({
      type: "message",
      icon: "💰",
      title: "Vade hatırlatma gönderildi",
      detail: `${formatTry(tutar)} — ${days > 0 ? `${days} gün geçmiş` : "yaklaşıyor"}`,
      timestamp: new Date().toISOString(),
    }, "✅ Hatırlatma gönderildi");
    setSending(false);
  }

  return (
    <ModalShell title="💰 Vade Hatırlatma" onClose={onClose}>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-xs text-amber-800">
        <div><strong>{dealer.name}</strong></div>
        <div>Açık vade: <strong>{formatTry(tutar)}</strong></div>
        {days > 0 && <div className="text-rose-700 font-semibold">⏰ {days} gün geçmiş</div>}
      </div>
      <label className="text-xs font-medium text-slate-700 block mb-1">Hatırlatma metni (AI hazır şablon)</label>
      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        rows={5}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex gap-2 mt-4 justify-end">
        <button onClick={onClose} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
        <button
          onClick={handleSend}
          disabled={sending || !msg.trim()}
          className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
        >
          {sending ? "Gönderiliyor…" : "Hatırlatmayı Gönder"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Not Ekle ─────────────────────────────────────────────────────────
function NotEkleForm({ onClose, onSuccess }: { dealer: Dealer; onClose: () => void; onSuccess: ActionModalProps["onSuccess"] }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 300));
    onSuccess({
      type: "note",
      icon: "📝",
      title: "Not eklendi",
      detail: content,
      timestamp: new Date().toISOString(),
    }, "✅ Not kaydedildi");
    setSaving(false);
  }

  return (
    <ModalShell title="📝 Not Ekle" onClose={onClose}>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={5}
        placeholder="Bu bayi hakkında not… (örn. ziyaret özeti, müzakere notu, ödeme uzlaşması)"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex gap-2 mt-4 justify-end">
        <button onClick={onClose} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
        <button onClick={handleSave} disabled={saving || !content.trim()} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Kampanya ─────────────────────────────────────────────────────────
function KampanyaForm({ onClose, onSuccess }: { dealer: Dealer; onClose: () => void; onSuccess: ActionModalProps["onSuccess"] }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState(10);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess({
      type: "note",
      icon: "🎁",
      title: `Bayi-özel kampanya: ${name}`,
      detail: `${type === "percent" ? `%${value}` : formatTry(value)} indirim · ${start} → ${end}${notify ? " · WA bildirim ✓" : ""}`,
      timestamp: new Date().toISOString(),
    }, "✅ Kampanya tanımlandı");
    setSaving(false);
  }

  return (
    <ModalShell title="🎁 Özel Kampanya" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">Kampanya adı</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="örn: Bahar İndirimi" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">İndirim tipi</label>
            <select value={type} onChange={e => setType(e.target.value as "percent" | "fixed")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="percent">%</option>
              <option value="fixed">Sabit ₺</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Tutar</label>
            <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Başlangıç</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Bitiş</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="accent-indigo-600" />
          Bayiye WA bildirimi gönder
        </label>
      </div>
      <div className="flex gap-2 mt-4 justify-end">
        <button onClick={onClose} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
        <button onClick={handleSave} disabled={saving || !name.trim()} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Tanımlanıyor…" : "Kampanyayı Tanımla"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Yeni Sipariş ─────────────────────────────────────────────────────
function YeniSiparisForm({ dealer, onClose, onSuccess }: { dealer: Dealer; onClose: () => void; onSuccess: ActionModalProps["onSuccess"] }) {
  const [items, setItems] = useState<Array<{ name: string; qty: number; price: number }>>([
    { name: "", qty: 1, price: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const total = items.reduce((s, it) => s + it.qty * it.price, 0);

  function updateItem(idx: number, patch: Partial<{ name: string; qty: number; price: number }>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }
  function addItem() { setItems([...items, { name: "", qty: 1, price: 0 }]); }
  function removeItem(idx: number) { setItems(items.filter((_, i) => i !== idx)); }

  async function handleSave() {
    const valid = items.filter(it => it.name.trim() && it.qty > 0 && it.price > 0);
    if (valid.length === 0) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess({
      type: "order",
      icon: "🛒",
      title: `Sipariş — ${valid.length} kalem`,
      detail: `${formatTry(total)} · ${dealer.name}`,
      timestamp: new Date().toISOString(),
    }, "✅ Sipariş oluşturuldu");
    setSaving(false);
  }

  return (
    <ModalShell title="➕ Yeni Sipariş" onClose={onClose}>
      <p className="text-xs text-slate-500 mb-3">Bayi: <strong>{dealer.name}</strong></p>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
            <input
              value={it.name}
              onChange={e => updateItem(idx, { name: e.target.value })}
              placeholder="Ürün adı"
              className="col-span-6 border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
            />
            <input
              type="number"
              value={it.qty}
              onChange={e => updateItem(idx, { qty: Number(e.target.value) })}
              min={1}
              className="col-span-2 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center"
            />
            <input
              type="number"
              value={it.price}
              onChange={e => updateItem(idx, { price: Number(e.target.value) })}
              placeholder="₺"
              className="col-span-3 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right"
            />
            <button onClick={() => removeItem(idx)} className="col-span-1 text-rose-500 text-xl leading-none">×</button>
          </div>
        ))}
        <button onClick={addItem} className="text-xs text-indigo-600 hover:underline">+ Kalem ekle</button>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
        <span className="text-sm text-slate-600">Toplam</span>
        <span className="text-lg font-bold">{formatTry(total)}</span>
      </div>
      <div className="flex gap-2 mt-4 justify-end">
        <button onClick={onClose} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
        <button onClick={handleSave} disabled={saving || total === 0} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Kaydediliyor…" : "Siparişi Oluştur"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Düzenle ──────────────────────────────────────────────────────────
function DuzenleForm({ dealer, onClose, onSuccess }: { dealer: Dealer; onClose: () => void; onSuccess: ActionModalProps["onSuccess"] }) {
  const [name, setName] = useState(dealer.name);
  const [contactName, setContactName] = useState(dealer.contactName || "");
  const [phone, setPhone] = useState(dealer.contactPhone || "");
  const [email, setEmail] = useState(dealer.email || "");
  const [city, setCity] = useState(dealer.city || "");
  const [address, setAddress] = useState(dealer.address || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess({
      type: "note",
      icon: "✏️",
      title: "Bayi bilgileri güncellendi",
      detail: `${name} — ${city || "—"}`,
      timestamp: new Date().toISOString(),
    }, "✅ Güncellendi");
    setSaving(false);
  }

  return (
    <ModalShell title="✏️ Bayi Düzenle" onClose={onClose}>
      <div className="space-y-3">
        <FieldInput label="Firma adı" value={name} onChange={setName} />
        <FieldInput label="Yetkili" value={contactName} onChange={setContactName} />
        <FieldInput label="Telefon" value={phone} onChange={setPhone} />
        <FieldInput label="E-posta" value={email} onChange={setEmail} />
        <FieldInput label="Şehir" value={city} onChange={setCity} />
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">Adres</label>
          <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex gap-2 mt-4 justify-end">
        <button onClick={onClose} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </ModalShell>
  );
}

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700 block mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}

// ── Durum Değiştir ───────────────────────────────────────────────────
function DurumForm({ dealer, onClose, onSuccess }: { dealer: Dealer; onClose: () => void; onSuccess: ActionModalProps["onSuccess"] }) {
  const [status, setStatus] = useState(dealer.isActive ? "aktif" : "pasif");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 300));
    const labels: Record<string, string> = { aktif: "Aktif", pasif: "Pasif", dondurulmus: "Dondurulmuş" };
    onSuccess({
      type: "note",
      icon: "⏸",
      title: `Durum değişti: ${labels[status]}`,
      timestamp: new Date().toISOString(),
    }, "✅ Durum güncellendi");
    setSaving(false);
  }

  return (
    <ModalShell title="⏸ Durum Değiştir" onClose={onClose}>
      <div className="space-y-2">
        {[
          { id: "aktif",        label: "✅ Aktif — sipariş, kampanya, mesaj gönderim açık" },
          { id: "dondurulmus",  label: "⏸ Dondurulmuş — sadece okuma, yeni sipariş kapalı" },
          { id: "pasif",        label: "❌ Pasif — listeden gizlenir, etkileşim kapalı" },
        ].map(opt => (
          <label key={opt.id} className="flex items-start gap-2 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input type="radio" name="status" value={opt.id} checked={status === opt.id} onChange={() => setStatus(opt.id)} className="mt-0.5 accent-indigo-600" />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 mt-4 justify-end">
        <button onClick={onClose} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Güncelleniyor…" : "Onayla"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Sil ──────────────────────────────────────────────────────────────
function SilForm({ dealer, onClose, onSuccess }: { dealer: Dealer; onClose: () => void; onSuccess: ActionModalProps["onSuccess"] }) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (confirmText !== "SIL") return;
    setDeleting(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess({
      type: "note",
      icon: "🗑",
      title: "Bayi silindi (soft delete)",
      timestamp: new Date().toISOString(),
    }, "🗑 Silindi");
    setDeleting(false);
  }

  return (
    <ModalShell title="🗑 Bayi Sil" onClose={onClose}>
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-3">
        <p className="text-sm text-rose-800">
          <strong>{dealer.name}</strong> arşivlenecek. Sipariş geçmişi ve faturalar korunur, ancak bayi listede görünmez.
          İstediğinizde geri alabilirsiniz.
        </p>
      </div>
      <label className="text-xs font-medium text-slate-700 block mb-1">
        Onaylamak için &quot;<strong>SIL</strong>&quot; yazın
      </label>
      <input
        value={confirmText}
        onChange={e => setConfirmText(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
      />
      <div className="flex gap-2 mt-4 justify-end">
        <button onClick={onClose} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
        <button
          onClick={handleDelete}
          disabled={deleting || confirmText !== "SIL"}
          className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50"
        >
          {deleting ? "Siliniyor…" : "Sil (geri alınabilir)"}
        </button>
      </div>
    </ModalShell>
  );
}
