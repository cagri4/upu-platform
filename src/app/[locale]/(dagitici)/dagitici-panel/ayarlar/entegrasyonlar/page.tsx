"use client";

/**
 * Dağıtıcı Entegrasyonlar (Faz 3 Sprint F).
 *
 * 9 provider kartı (kategori bazlı gruplu):
 *   - Ödeme: iyzico (TR), Mollie (EU)
 *   - e-Fatura: Foriba, Mikrohizmet
 *   - Kargo: Aras, Yurtiçi, MNG
 *   - ERP: Logo Tiger, Paraşüt
 *
 * Her kart: status rozeti + ON/OFF toggle + "Yapılandır" modal +
 * son sync timestamp. Credential modal: configSchema + secretSchema'dan
 * dinamik form üretir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CreditCard,
  Receipt,
  Truck,
  Database,
  Check,
  X,
  Settings,
  ExternalLink,
  Clock,
  RefreshCw,
} from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/admin/v3-shell";

interface FieldSchema {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "number" | "url";
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  helper?: string;
}

interface ProviderItem {
  provider: string;
  category: "payment" | "efatura" | "kargo" | "erp";
  label: string;
  description: string;
  docsUrl: string | null;
  status: "live" | "sandbox" | "mock" | "planned";
  configSchema: FieldSchema[];
  secretSchema: FieldSchema[];
  isActive: boolean;
  isConfigured: boolean;
  config: Record<string, unknown>;
  secretsRedacted: Record<string, string | null>;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: typeof CreditCard }> = {
  payment: { label: "Ödeme", icon: CreditCard },
  efatura: { label: "e-Fatura", icon: Receipt },
  kargo: { label: "Kargo", icon: Truck },
  erp: { label: "ERP / Muhasebe", icon: Database },
};

const STATUS_TONE: Record<string, StatusTone> = {
  live: "success",
  sandbox: "info",
  mock: "warning",
  planned: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  live: "Canlı",
  sandbox: "Sandbox",
  mock: "Mock",
  planned: "Yakında",
};

const formatTarih = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function EntegrasyonlarPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [items, setItems] = useState<ProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editTarget, setEditTarget] = useState<ProviderItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dagitici/ayarlar/entegrasyon", {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setItems(d.items);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const out: Record<string, ProviderItem[]> = {};
    for (const it of items) {
      (out[it.category] ||= []).push(it);
    }
    return out;
  }, [items]);

  async function toggle(it: ProviderItem) {
    if (!it.isConfigured && !it.isActive) {
      // İlk kez aktif yapmak → credential şart
      setEditTarget(it);
      return;
    }
    const res = await fetch("/api/dagitici/ayarlar/entegrasyon", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: it.provider, is_active: !it.isActive }),
    });
    const d = await res.json();
    if (!res.ok || !d.success) {
      alert(d.error || "Güncellenemedi.");
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Entegrasyonlar</h1>
          <p className="mt-1 text-sm text-slate-600">
            Dışarıdan API stratejisi — ödeme, e-fatura, kargo ve ERP bağlantıları.
          </p>
        </div>
        <Link
          href={`/${locale}/dagitici-panel`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Dashboard'a Dön
        </Link>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Yükleniyor…
        </div>
      ) : (
        Object.entries(CATEGORY_LABELS).map(([cat, meta]) => {
          const Icon = meta.icon;
          const catItems = grouped[cat] || [];
          if (catItems.length === 0) return null;
          return (
            <section key={cat}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                <Icon className="h-4 w-4" />
                {meta.label}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {catItems.map((it) => (
                  <ProviderCard
                    key={it.provider}
                    item={it}
                    onToggle={() => toggle(it)}
                    onEdit={() => setEditTarget(it)}
                    onSync={
                      it.provider === "logo_tiger"
                        ? async () => {
                            if (
                              !confirm(
                                "Logo Tiger sync başlatılsın mı? Ürünler/stok/fiyatlar/bayiler güncellenir.",
                              )
                            )
                              return;
                            const r = await fetch("/api/dagitici/logo/sync", {
                              method: "POST",
                              credentials: "same-origin",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({}),
                            });
                            const d = await r.json();
                            if (!r.ok) {
                              alert(d.errorMessage || "Sync başarısız.");
                              return;
                            }
                            const mocked = d.stats?.some(
                              (s: { mocked: boolean }) => s.mocked,
                            );
                            const summary = (d.stats || [])
                              .map(
                                (s: {
                                  entity: string;
                                  fetched: number;
                                  upserted: number;
                                  errors: number;
                                }) =>
                                  `${s.entity}: ${s.upserted}/${s.fetched} (${s.errors} hata)`,
                              )
                              .join("\n");
                            alert(
                              `Sync ${d.success ? "tamam" : "kısmen başarısız"}.\n\n${summary}${
                                mocked ? "\n\n(MOCK veri — canlı API key girin)" : ""
                              }`,
                            );
                            load();
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {editTarget && (
        <ConfigureModal
          item={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProviderCard({
  item,
  onToggle,
  onEdit,
  onSync,
}: {
  item: ProviderItem;
  onToggle: () => void;
  onEdit: () => void;
  onSync?: () => Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  const canActivate = item.status !== "planned";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
            <StatusBadge tone={STATUS_TONE[item.status] || "neutral"}>
              {STATUS_LABEL[item.status] || item.status}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-slate-500">{item.description}</p>
        </div>
        <button
          onClick={onToggle}
          disabled={!canActivate}
          className={`inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-40 ${
            item.isActive ? "bg-emerald-500 justify-end" : "bg-slate-300 justify-start"
          }`}
          aria-label="Toggle"
        >
          <span className="mx-0.5 inline-block h-6 w-6 rounded-full bg-white shadow" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {item.lastSyncedAt ? formatTarih(item.lastSyncedAt) : "Hiç çalıştırılmadı"}
        </span>
        {item.lastSyncStatus === "ok" && (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <Check className="h-3 w-3" />
            Son sync OK
          </span>
        )}
        {item.lastSyncStatus === "error" && (
          <span
            className="inline-flex items-center gap-1 text-rose-700"
            title={item.lastSyncError ?? undefined}
          >
            <X className="h-3 w-3" />
            Hata
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onEdit}
          disabled={!canActivate}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Settings className="h-3.5 w-3.5" />
          Yapılandır
        </button>
        {onSync && (
          <button
            onClick={async () => {
              setSyncing(true);
              try {
                await onSync();
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sync…" : "Şimdi Sync"}
          </button>
        )}
        {item.docsUrl && (
          <a
            href={item.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Dokümanlar
          </a>
        )}
      </div>
    </div>
  );
}

function ConfigureModal({
  item,
  onClose,
  onSaved,
}: {
  item: ProviderItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [config, setConfig] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    item.configSchema.forEach((f) => {
      const v = item.config[f.key];
      out[f.key] = v == null ? "" : String(v);
    });
    return out;
  });
  const [secrets, setSecrets] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    item.secretSchema.forEach((f) => (out[f.key] = ""));
    return out;
  });
  const [isActive, setIsActive] = useState(item.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      // configSchema validation: required field'lar dolu mu?
      for (const f of item.configSchema) {
        if (f.required && !config[f.key]?.trim()) {
          setError(`${f.label} zorunlu.`);
          setSaving(false);
          return;
        }
      }
      const secretsPatch: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(secrets)) {
        secretsPatch[k] = v; // boş string ise backend değişiklik yapmaz
      }
      const res = await fetch("/api/dagitici/ayarlar/entegrasyon", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: item.provider,
          is_active: isActive,
          config,
          secrets_patch: secretsPatch,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Kaydedilemedi.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            {item.label} yapılandır
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">{item.description}</p>

        <div className="mt-4 space-y-3">
          {item.configSchema.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-700">Genel ayarlar</p>
              <div className="mt-2 grid gap-2">
                {item.configSchema.map((f) => (
                  <FieldInput
                    key={f.key}
                    field={f}
                    value={config[f.key] ?? ""}
                    onChange={(v) =>
                      setConfig((s) => ({ ...s, [f.key]: v }))
                    }
                  />
                ))}
              </div>
            </div>
          )}
          {item.secretSchema.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-700">
                Kimlik bilgileri
              </p>
              <div className="mt-2 grid gap-2">
                {item.secretSchema.map((f) => (
                  <FieldInput
                    key={f.key}
                    field={f}
                    value={secrets[f.key] ?? ""}
                    onChange={(v) =>
                      setSecrets((s) => ({ ...s, [f.key]: v }))
                    }
                    placeholder={
                      item.secretsRedacted[f.key]
                        ? `Mevcut: ${item.secretsRedacted[f.key]}`
                        : f.placeholder
                    }
                  />
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Boş bırakılan alanlar değişmez. Mevcut değerleri korumak için
                doldurmayın.
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-emerald-600"
            />
            <span className="text-slate-700">Bu entegrasyon aktif olsun</span>
          </label>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  placeholder,
}: {
  field: FieldSchema;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  if (field.type === "select" && field.options) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-700">
          {field.label}
          {field.required && <span className="text-rose-500"> *</span>}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
        >
          <option value="">— Seç —</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {field.helper && (
          <span className="text-[11px] text-slate-500">{field.helper}</span>
        )}
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-700">
        {field.label}
        {field.required && <span className="text-rose-500"> *</span>}
      </span>
      <input
        type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? field.placeholder}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
      />
      {field.helper && (
        <span className="text-[11px] text-slate-500">{field.helper}</span>
      )}
    </label>
  );
}
