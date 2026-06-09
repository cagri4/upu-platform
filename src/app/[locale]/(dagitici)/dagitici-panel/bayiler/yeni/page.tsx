"use client";

/**
 * Dağıtıcı Yeni Bayi formu — Faz 1.1.
 * Validate: name + phone zorunlu. Diğerleri opsiyonel.
 * Kaydet → liste'ye dön (toast yerine basit "Eklendi" banner).
 */

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

interface FormState {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  segment: "" | "A" | "B" | "C";
  region: string;
  address: string;
  taxNo: string;
  creditLimit: string;
  paymentTermDays: string;
}

const EMPTY: FormState = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  segment: "",
  region: "",
  address: "",
  taxNo: "",
  creditLimit: "",
  paymentTermDays: "30",
};

export default function NewDealerPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    setError("");
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError("Bayi adı en az 2 karakter olmalı.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Telefon zorunlu.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dagitici/bayiler", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          contactName: form.contactName.trim() || undefined,
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          segment: form.segment || undefined,
          region: form.region.trim() || undefined,
          address: form.address.trim() || undefined,
          taxNo: form.taxNo.trim() || undefined,
          creditLimit: form.creditLimit || undefined,
          paymentTermDays: form.paymentTermDays || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Kaydedilemedi.");
        setSaving(false);
        return;
      }
      router.push(`/${locale}/dagitici-panel/bayiler/${d.id}`);
    } catch {
      setError("Bağlantı hatası.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex items-center gap-1 text-sm text-slate-500">
        <Link href={`/${locale}/dagitici-panel/bayiler`} className="hover:text-slate-900">
          Bayiler
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-slate-900">Yeni bayi</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Yeni bayi ekle</h1>
        <p className="mt-1 text-sm text-slate-600">
          İsim ve telefon zorunlu. Diğer alanları sonra detay sayfasından doldurabilirsin.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Bayi adı *" value={form.name} onChange={(v) => patch("name", v)} />
          <Field
            label="İletişim kişisi"
            value={form.contactName}
            onChange={(v) => patch("contactName", v)}
          />
          <Field
            label="Telefon *"
            value={form.phone}
            onChange={(v) => patch("phone", v)}
            placeholder="905XXXXXXXXX"
          />
          <Field
            label="E-posta"
            value={form.email}
            onChange={(v) => patch("email", v)}
            type="email"
          />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Segment</label>
            <select
              value={form.segment}
              onChange={(e) => patch("segment", e.target.value as FormState["segment"])}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Atanmamış</option>
              <option value="A">A — Premium</option>
              <option value="B">B — Standart</option>
              <option value="C">C — Yeni / küçük</option>
            </select>
          </div>
          <Field label="Bölge" value={form.region} onChange={(v) => patch("region", v)} />
          <Field
            label="Adres"
            value={form.address}
            onChange={(v) => patch("address", v)}
            full
          />
          <Field label="Vergi no" value={form.taxNo} onChange={(v) => patch("taxNo", v)} />
          <Field
            label="Kredi limiti (₺)"
            value={form.creditLimit}
            onChange={(v) => patch("creditLimit", v)}
            type="number"
          />
          <Field
            label="Vade gün sayısı"
            value={form.paymentTermDays}
            onChange={(v) => patch("paymentTermDays", v)}
            type="number"
          />
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Link
          href={`/${locale}/dagitici-panel/bayiler`}
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Vazgeç
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "lg:col-span-2" : undefined}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
      />
    </div>
  );
}
