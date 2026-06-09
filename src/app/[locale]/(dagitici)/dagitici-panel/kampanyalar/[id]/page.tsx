"use client";

/**
 * Kampanya detay — 4 sekme: Bilgiler / Hedefleme / Kural / Performans.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2, Plus, X } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/admin/v3-shell";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  status: string;
  startDate: string;
  endDate: string;
  maxUsage: number | null;
  perDealerMaxUsage: number | null;
  couponCode: string | null;
  isActive: boolean;
}

interface Target {
  id: string;
  targetType: string;
  targetValue: string | null;
  dealerName: string | null;
}

interface Rule {
  id: string;
  ruleType: string;
  params: Record<string, unknown>;
}

interface DealerOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface ResolveResult {
  subtotal: number;
  totalDiscount: number;
  finalTotal: number;
  freeShipping: boolean;
  appliedCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    type: string;
    discountAmount: number;
    note: string;
  }>;
  gifts: Array<{ productId: string; quantity: number }>;
}

const TABS = [
  { id: "info", label: "Bilgiler" },
  { id: "targeting", label: "Hedefleme" },
  { id: "rule", label: "Kural" },
  { id: "performance", label: "Performans" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const TYPE_LABEL: Record<string, string> = {
  percent_discount: "% İndirim",
  volume_discount: "Al-X-öde-Y",
  coupon: "Kupon",
  gift_product: "Hediye",
  free_shipping: "Ücretsiz Kargo",
};

const STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  active: "success",
  paused: "warning",
  ended: "info",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  paused: "Pasif",
  ended: "Bitti",
};

export default function KampanyaDetayPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";

  const [tab, setTab] = useState<TabId>("info");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dagitici/kampanyalar/${id}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setCampaign(d.campaign);
      setTargets(d.targets || []);
      setRules(d.rules || []);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  if (loading) {
    return <div className="p-6 text-center text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (error && !campaign) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error}
      </div>
    );
  }
  if (!campaign) return null;

  async function handleStatusChange(newStatus: string) {
    await fetch(`/api/dagitici/kampanyalar/${id}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  }

  async function handleDelete() {
    if (!confirm("Bu kampanyayı durdurup pasifleştir? (geçmiş sipariş kayıtlarında kalır)")) return;
    const res = await fetch(`/api/dagitici/kampanyalar/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) router.push(`/${locale}/dagitici-panel/kampanyalar`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/dagitici-panel/kampanyalar`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">{campaign.title}</h1>
          <StatusBadge tone={STATUS_TONE[campaign.status] || "neutral"}>
            {STATUS_LABEL[campaign.status] || campaign.status}
          </StatusBadge>
          {campaign.type && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {TYPE_LABEL[campaign.type]}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {campaign.status !== "active" && (
            <button
              onClick={() => handleStatusChange("active")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Aktifleştir
            </button>
          )}
          {campaign.status === "active" && (
            <button
              onClick={() => handleStatusChange("paused")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              Durdur
            </button>
          )}
          <button
            onClick={handleDelete}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" />
            Sil
          </button>
        </div>
      </div>

      <nav className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-emerald-500 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "info" && (
        <InfoTab campaign={campaign} onSaved={load} />
      )}
      {tab === "targeting" && (
        <TargetingTab
          campaignId={id}
          targets={targets}
          onChanged={load}
        />
      )}
      {tab === "rule" && (
        <RuleTab
          campaignId={id}
          campaignType={campaign.type}
          rules={rules}
          onChanged={load}
        />
      )}
      {tab === "performance" && <PerformanceTab campaignId={id} />}
    </div>
  );
}

function InfoTab({ campaign, onSaved }: { campaign: Campaign; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: campaign.title,
    description: campaign.description || "",
    start_date: campaign.startDate,
    end_date: campaign.endDate,
    coupon_code: campaign.couponCode || "",
    max_usage: campaign.maxUsage != null ? String(campaign.maxUsage) : "",
    per_dealer_max_usage:
      campaign.perDealerMaxUsage != null ? String(campaign.perDealerMaxUsage) : "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch(`/api/dagitici/kampanyalar/${campaign.id}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        start_date: form.start_date,
        end_date: form.end_date,
        coupon_code: form.coupon_code,
        max_usage: form.max_usage || null,
        per_dealer_max_usage: form.per_dealer_max_usage || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg("Kaydedildi.");
      onSaved();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || "Hata.");
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
      <label className="sm:col-span-2 flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Kampanya Adı</span>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <label className="sm:col-span-2 flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Açıklama</span>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Başlangıç</span>
        <input
          type="date"
          value={form.start_date}
          onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Bitiş</span>
        <input
          type="date"
          value={form.end_date}
          onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </label>
      {campaign.type === "coupon" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">Kupon Kodu</span>
          <input
            type="text"
            value={form.coupon_code}
            onChange={(e) =>
              setForm((f) => ({ ...f, coupon_code: e.target.value.toUpperCase() }))
            }
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm uppercase focus:border-emerald-500 focus:outline-none"
          />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Max Kullanım</span>
        <input
          type="number"
          min={0}
          value={form.max_usage}
          onChange={(e) => setForm((f) => ({ ...f, max_usage: e.target.value }))}
          placeholder="Sınırsız"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">Bayi Başına Max</span>
        <input
          type="number"
          min={0}
          value={form.per_dealer_max_usage}
          onChange={(e) =>
            setForm((f) => ({ ...f, per_dealer_max_usage: e.target.value }))
          }
          placeholder="Sınırsız"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <div className="sm:col-span-2 flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}

function TargetingTab({
  campaignId,
  targets,
  onChanged,
}: {
  campaignId: string;
  targets: Target[];
  onChanged: () => void;
}) {
  const [type, setType] = useState<"all" | "segment" | "region" | "dealer">("segment");
  const [value, setValue] = useState("");
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (type === "dealer") {
      fetch("/api/dagitici/bayiler?status=active&pageSize=200", {
        credentials: "same-origin",
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success)
            setDealers(
              (d.items ?? []).map((x: { id: string; name: string }) => ({
                id: x.id,
                name: x.name,
              })),
            );
        });
    }
  }, [type]);

  async function add() {
    setSaving(true);
    const res = await fetch(`/api/dagitici/kampanyalar/${campaignId}/hedefleme`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_type: type,
        target_value: type === "all" ? null : value,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setValue("");
      onChanged();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Eklenemedi.");
    }
  }

  async function remove(targetId: string) {
    await fetch(
      `/api/dagitici/kampanyalar/${campaignId}/hedefleme/${targetId}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium text-slate-700">Yeni Hedef</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as typeof type);
              setValue("");
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">Tüm bayiler</option>
            <option value="segment">Segment</option>
            <option value="region">Bölge</option>
            <option value="dealer">Belirli bayi</option>
          </select>
          {type === "all" && (
            <span className="self-center text-sm text-slate-500">
              "Tüm bayiler" eklenecek (tek hedef yeterli).
            </span>
          )}
          {type === "segment" && (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">— Seç —</option>
              <option value="A">A — Premium</option>
              <option value="B">B — Standart</option>
              <option value="C">C — Yeni / küçük</option>
            </select>
          )}
          {type === "region" && (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Marmara / Ege ..."
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
          )}
          {type === "dealer" && (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">— Bayi seç —</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={add}
            disabled={saving || (type !== "all" && !value)}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Ekle
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="px-2 py-1 text-xs font-medium text-slate-700">
          Atanmış Hedefler ({targets.length})
        </p>
        {targets.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            Henüz hedef yok — kampanya hiçbir bayiye uygulanmaz.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 p-2">
            {targets.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
              >
                <span className="font-medium">
                  {t.targetType === "all"
                    ? "Tüm bayiler"
                    : t.targetType === "segment"
                      ? `Segment ${t.targetValue}`
                      : t.targetType === "region"
                        ? `Bölge: ${t.targetValue}`
                        : `Bayi: ${t.dealerName || t.targetValue}`}
                </span>
                <button
                  onClick={() => remove(t.id)}
                  className="rounded p-0.5 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RuleTab({
  campaignId,
  campaignType,
  rules,
  onChanged,
}: {
  campaignId: string;
  campaignType: string | null;
  rules: Rule[];
  onChanged: () => void;
}) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/dagitici/urunler?status=active&pageSize=200", {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success)
          setProducts(
            (d.items ?? []).map((p: { id: string; code: string; name: string }) => ({
              id: p.id,
              code: p.code,
              name: p.name,
            })),
          );
      });
    fetch("/api/dagitici/kategoriler", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.flat || []);
      });
  }, []);

  // Form state
  const ruleType = campaignType || "percent_discount";
  const [percent, setPercent] = useState("10");
  const [appliesTo, setAppliesTo] = useState<"all" | string>("all");
  const [buy, setBuy] = useState("30");
  const [free, setFree] = useState("5");
  const [productId, setProductId] = useState("");
  const [minTotal, setMinTotal] = useState("1000");
  const [giftProductId, setGiftProductId] = useState("");
  const [giftQty, setGiftQty] = useState("1");

  async function save() {
    setSaving(true);
    let params: Record<string, unknown> = {};
    let rt = ruleType;
    if (rt === "percent_discount" || rt === "coupon") {
      params = { discount_percent: Number(percent), applies_to: appliesTo };
    } else if (rt === "volume_discount") {
      params = {
        buy: Number(buy),
        free: Number(free),
        applies_to: productId ? `product:${productId}` : "",
      };
    } else if (rt === "gift_product") {
      params = {
        min_total: Number(minTotal),
        gift_product_id: giftProductId,
        gift_quantity: Number(giftQty),
      };
    } else if (rt === "free_shipping") {
      params = { min_total: Number(minTotal) };
    }
    const res = await fetch(`/api/dagitici/kampanyalar/${campaignId}/kural`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule_type: rt, params, replace: true }),
    });
    setSaving(false);
    if (res.ok) onChanged();
    else alert("Kural kaydedilemedi.");
  }

  async function removeRule(ruleId: string) {
    await fetch(
      `/api/dagitici/kampanyalar/${campaignId}/kural?rule_id=${ruleId}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-700">
          Kural ({ruleType ? ruleType.replace("_", " ") : "—"})
        </p>

        {(ruleType === "percent_discount" || ruleType === "coupon") && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">İndirim %</span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Uygulandığı</span>
              <select
                value={appliesTo}
                onChange={(e) => setAppliesTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">Tüm sepet</option>
                <optgroup label="Kategori">
                  {categories.map((c) => (
                    <option key={c.id} value={`category:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Ürün">
                  {products.map((p) => (
                    <option key={p.id} value={`product:${p.id}`}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>
        )}

        {ruleType === "volume_discount" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Al (adet)</span>
              <input
                type="number"
                min={1}
                value={buy}
                onChange={(e) => setBuy(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Bedava (adet)</span>
              <input
                type="number"
                min={1}
                value={free}
                onChange={(e) => setFree(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Ürün</span>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">— Seç —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {ruleType === "gift_product" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Min Sepet (₺)</span>
              <input
                type="number"
                min={0}
                value={minTotal}
                onChange={(e) => setMinTotal(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Hediye Ürün</span>
              <select
                value={giftProductId}
                onChange={(e) => setGiftProductId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">— Seç —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Miktar</span>
              <input
                type="number"
                min={1}
                value={giftQty}
                onChange={(e) => setGiftQty(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>
        )}

        {ruleType === "free_shipping" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Min Sepet (₺)</span>
              <input
                type="number"
                min={0}
                value={minTotal}
                onChange={(e) => setMinTotal(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Kaydediliyor…" : "Kuralı Kaydet (replace)"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="px-2 py-1 text-xs font-medium text-slate-700">
          Kayıtlı kurallar ({rules.length})
        </p>
        {rules.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            Henüz kural yok. Üstten kural kaydet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rules.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-2 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.ruleType}</p>
                  <pre className="mt-1 text-xs text-slate-500">
                    {JSON.stringify(r.params, null, 2)}
                  </pre>
                </div>
                <button
                  onClick={() => removeRule(r.id)}
                  className="text-slate-500 hover:bg-rose-100 hover:text-rose-700 rounded-md p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PerformanceTab({ campaignId: _campaignId }: { campaignId: string }) {
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [products, setProducts] = useState<Array<ProductOption & { basePrice: number }>>([]);
  const [dealerId, setDealerId] = useState("");
  const [cart, setCart] = useState<Array<{ product_id: string; quantity: string; unit_price: string }>>([
    { product_id: "", quantity: "10", unit_price: "0" },
  ]);
  const [coupon, setCoupon] = useState("");
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/dagitici/bayiler?status=active&pageSize=200", {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success)
          setDealers(
            (d.items ?? []).map((x: { id: string; name: string }) => ({
              id: x.id,
              name: x.name,
            })),
          );
      });
    fetch("/api/dagitici/urunler?status=active&pageSize=200", {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success)
          setProducts(
            (d.items ?? []).map(
              (p: { id: string; code: string; name: string; basePrice: number }) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                basePrice: p.basePrice,
              }),
            ),
          );
      });
  }, []);

  async function run() {
    if (!dealerId) {
      alert("Bayi seç.");
      return;
    }
    setRunning(true);
    setResult(null);
    const cartClean = cart
      .filter((l) => l.product_id && Number(l.quantity) > 0)
      .map((l) => ({
        product_id: l.product_id,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
      }));
    if (cartClean.length === 0) {
      alert("Sepete en az 1 ürün ekle.");
      setRunning(false);
      return;
    }
    const res = await fetch("/api/dagitici/kampanya-resolve", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealer_id: dealerId,
        cart: cartClean,
        coupon_code: coupon || null,
      }),
    });
    const d = await res.json();
    setRunning(false);
    if (!res.ok || !d.success) {
      alert(d.error || "Hesaplanamadı.");
      return;
    }
    setResult(d as ResolveResult);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-700">
          Senaryo Test — bu kampanyanın gerçek bir sepetteki etkisini gör
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">Bayi</span>
            <select
              value={dealerId}
              onChange={(e) => setDealerId(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">— Seç —</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">Kupon Kodu (varsa)</span>
            <input
              type="text"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm uppercase focus:border-emerald-500 focus:outline-none"
            />
          </label>
        </div>

        <p className="mt-4 text-xs font-medium text-slate-700">Sepet</p>
        <div className="mt-2 space-y-2">
          {cart.map((line, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_100px_120px_auto]">
              <select
                value={line.product_id}
                onChange={(e) => {
                  const v = e.target.value;
                  const prod = products.find((p) => p.id === v);
                  setCart((arr) =>
                    arr.map((l, i) =>
                      i === idx
                        ? {
                            ...l,
                            product_id: v,
                            unit_price: prod ? String(prod.basePrice) : l.unit_price,
                          }
                        : l,
                    ),
                  );
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">— Ürün —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) =>
                  setCart((arr) =>
                    arr.map((l, i) =>
                      i === idx ? { ...l, quantity: e.target.value } : l,
                    ),
                  )
                }
                placeholder="Adet"
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm tabular-nums focus:border-emerald-500 focus:outline-none"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={line.unit_price}
                onChange={(e) =>
                  setCart((arr) =>
                    arr.map((l, i) =>
                      i === idx ? { ...l, unit_price: e.target.value } : l,
                    ),
                  )
                }
                placeholder="Birim ₺"
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm tabular-nums focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={() => setCart((arr) => arr.filter((_, i) => i !== idx))}
                className="h-9 rounded-lg border border-slate-200 px-2 text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setCart((arr) => [...arr, { product_id: "", quantity: "10", unit_price: "0" }])
            }
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Satır ekle
          </button>
        </div>

        <button
          onClick={run}
          disabled={running}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {running ? "Hesaplanıyor…" : "Senaryoyu Çalıştır"}
        </button>
      </div>

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Sonuç</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Stat label="Sepet ara toplam" value={`${result.subtotal.toFixed(2)} ₺`} />
            <Stat
              label="İndirim"
              value={`-${result.totalDiscount.toFixed(2)} ₺`}
              tone="warning"
            />
            <Stat
              label="Final"
              value={`${result.finalTotal.toFixed(2)} ₺`}
              tone="success"
            />
          </div>
          {result.freeShipping && (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Kargo bedava
            </p>
          )}
          {result.gifts.length > 0 && (
            <p className="mt-2 text-xs text-slate-600">
              Hediye: {result.gifts.map((g) => `${g.quantity}×${g.productId.slice(0, 8)}`).join(", ")}
            </p>
          )}
          {result.appliedCampaigns.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Hiçbir kampanya uygulanmadı (bu bayi için hedef ve kurala uyan kampanya yok).
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {result.appliedCampaigns.map((a, i) => (
                <li key={i} className="flex items-center justify-between px-1 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{a.campaignName}</p>
                    <p className="text-xs text-slate-500">{a.note}</p>
                  </div>
                  <span className="font-medium tabular-nums text-rose-700">
                    {a.discountAmount > 0 ? `-${a.discountAmount.toFixed(2)} ₺` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const cls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-800";
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <p className="text-[11px] uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
