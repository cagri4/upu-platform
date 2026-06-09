"use client";

/**
 * Dağıtıcı Bayi Detay/Düzenle — Faz 1.1.
 * 4 sekme: Bilgiler, Sınıflandırma, Finansal, Aktivite.
 * Sağ üst: Kaydet + Sil (onay modalı + sebep notu).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, Save, Trash2 } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/admin/v3-shell";

interface DealerDetail {
  id: string;
  name: string;
  contactName: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  taxNo: string | null;
  taxOffice: string | null;
  iban: string | null;
  segment: string | null;
  region: string | null;
  balance: number;
  creditLimit: number | null;
  paymentTermDays: number | null;
  discountRate: number | null;
  riskStatus: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  statusCode: string;
  statusName: string;
  createdAt: string;
}

const TABS = [
  { id: "info", label: "Bilgiler" },
  { id: "classification", label: "Sınıflandırma" },
  { id: "financial", label: "Finansal" },
  { id: "activity", label: "Aktivite" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(n);

const formatTarih = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS_TONE: Record<string, StatusTone> = {
  pending: "warning",
  approved: "info",
  delivered: "success",
  cancelled: "danger",
};

export default function DealerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";

  const [dealer, setDealer] = useState<DealerDetail | null>(null);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("info");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dagitici/bayiler/${id}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Bayi yüklenemedi.");
        setLoading(false);
        return;
      }
      setDealer(d.dealer);
      setOrders(d.recentOrders || []);
      setLoading(false);
    } catch {
      setError("Bağlantı hatası.");
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  function patch<K extends keyof DealerDetail>(key: K, value: DealerDetail[K]) {
    setDealer((d) => (d ? { ...d, [key]: value } : d));
  }

  async function handleSave() {
    if (!dealer) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/dagitici/bayiler/${id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dealer.name,
          contactName: dealer.contactName,
          phone: dealer.phone,
          email: dealer.email,
          address: dealer.address,
          taxNo: dealer.taxNo,
          segment: dealer.segment,
          region: dealer.region,
          creditLimit: dealer.creditLimit,
          paymentTermDays: dealer.paymentTermDays,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Kaydedilemedi.");
      } else {
        setSavedAt(new Date().toISOString());
      }
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/dagitici/bayiler/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Silinemedi.");
        setDeleting(false);
        return;
      }
      router.push(`/${locale}/dagitici-panel/bayiler`);
    } catch {
      setError("Bağlantı hatası.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Yükleniyor…
      </div>
    );
  }
  if (!dealer) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {error || "Bayi bulunamadı."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-slate-500">
        <Link href={`/${locale}/dagitici-panel/bayiler`} className="hover:text-slate-900">
          Bayiler
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-slate-900">{dealer.name}</span>
      </nav>

      {/* Header + actions */}
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{dealer.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {dealer.contactName && <span>{dealer.contactName}</span>}
            {dealer.phone && <span>· {dealer.phone}</span>}
            {!dealer.isActive && <StatusBadge tone="neutral">Pasif</StatusBadge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-xs text-emerald-700">✓ Kaydedildi</span>}
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting || !dealer.isActive}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Sil
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-emerald-600 text-emerald-700"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <FormField label="Bayi adı" value={dealer.name} onChange={(v) => patch("name", v)} />
          <FormField
            label="İletişim kişisi"
            value={dealer.contactName || ""}
            onChange={(v) => patch("contactName", v || null)}
          />
          <FormField label="Telefon" value={dealer.phone} onChange={(v) => patch("phone", v)} />
          <FormField
            label="E-posta"
            value={dealer.email || ""}
            onChange={(v) => patch("email", v || null)}
            type="email"
          />
          <FormField
            label="Adres"
            value={dealer.address || ""}
            onChange={(v) => patch("address", v || null)}
            full
          />
          <FormField
            label="Vergi no"
            value={dealer.taxNo || ""}
            onChange={(v) => patch("taxNo", v || null)}
          />
          <ReadField label="Kayıt tarihi" value={formatTarih(dealer.createdAt)} />
        </div>
      )}

      {tab === "classification" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Segment</label>
            <select
              value={dealer.segment || ""}
              onChange={(e) => patch("segment", e.target.value || null)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Atanmamış</option>
              <option value="A">A — Premium</option>
              <option value="B">B — Standart</option>
              <option value="C">C — Yeni / küçük</option>
            </select>
          </div>
          <FormField
            label="Bölge"
            value={dealer.region || ""}
            onChange={(v) => patch("region", v || null)}
          />
        </div>
      )}

      {tab === "financial" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReadField label="Mevcut bakiye" value={formatPara(dealer.balance)} highlight />
          <FormField
            label="Kredi limiti"
            value={dealer.creditLimit != null ? String(dealer.creditLimit) : ""}
            onChange={(v) => patch("creditLimit", v === "" ? null : Number(v))}
            type="number"
          />
          <FormField
            label="Vade gün sayısı"
            value={
              dealer.paymentTermDays != null ? String(dealer.paymentTermDays) : ""
            }
            onChange={(v) => patch("paymentTermDays", v === "" ? null : Number(v))}
            type="number"
          />
          <ReadField
            label="İskonto oranı"
            value={dealer.discountRate != null ? `%${dealer.discountRate}` : "—"}
          />
        </div>
      )}

      {tab === "activity" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Son 10 sipariş</h3>
            <p className="text-xs text-slate-500">En yeni → en eski</p>
          </div>
          {orders.length === 0 ? (
            <p className="p-5 text-center text-sm text-slate-500">
              Bu bayiden henüz sipariş yok.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium tabular-nums text-slate-900">
                      {o.orderNumber}
                    </p>
                    <p className="text-xs text-slate-500">{formatTarih(o.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge tone={STATUS_TONE[o.statusCode] || "neutral"}>
                      {o.statusName}
                    </StatusBadge>
                    <span className="font-medium tabular-nums text-slate-900">
                      {formatPara(o.totalAmount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Delete modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Bayiyi pasifleştir?</h2>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{dealer.name}</span> pasif
              olarak işaretlenecek. Sipariş geçmişi ve ekstre kayıtları silinmez;
              kalıcı silme admin paneli üzerinden yapılabilir.
            </p>
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Sebep notu (opsiyonel)
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Örn: Şirket kapandı."
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? "Pasifleştiriliyor…" : "Pasifleştir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "lg:col-span-2" : undefined}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
      />
    </div>
  );
}

function ReadField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600 mb-1">{label}</p>
      <p className={`text-sm ${highlight ? "font-semibold text-slate-900 text-base" : "text-slate-700"}`}>
        {value}
      </p>
    </div>
  );
}
