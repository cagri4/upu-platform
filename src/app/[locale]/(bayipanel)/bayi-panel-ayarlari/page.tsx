"use client";

/**
 * Bayi Panel Ayarları — Sprint A + Sprint B-3.
 *
 * 3 bölüm:
 *   - Profilim (read-only özet + "Profili Düzenle" link)
 *   - Hızlı İşlemler (customize — toggle + sıralama + kaydet)
 *   - Gizlilik ve Veriler (KVKK / ToS / İade / Veri talebi linkler + JSON
 *     export + silme talebi mailto)
 *
 * Pattern: emlak (panel)/panel-ayarlari/page.tsx (Gizlilik + Quick actions).
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronUp, ChevronDown, Check, RotateCcw, Save, Loader2 } from "lucide-react";
import { BAYI_QUICK_ACTIONS } from "@/platform/quick-actions/bayi-catalog";
import {
  ALL_BAYI_QUICK_ACTION_KEYS,
  DEFAULT_BAYI_QUICK_ACTIONS,
  type BayiQuickActionKey,
} from "@/platform/quick-actions/bayi-keys";

interface Firma {
  ticari_unvan: string | null;
  yetkili_adi: string | null;
  ofis_telefon: string | null;
  ofis_adresi: string | null;
  sektor: string | null;
  email_kurumsal: string | null;
  web_sitesi: string | null;
}

interface ProfileResp {
  displayName: string | null;
  phone: string | null;
  firma: Firma;
}

export default function BayiPanelAyarlariPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";

  const [data, setData] = useState<ProfileResp | null>(null);
  const [profileError, setProfileError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Hızlı İşlemler customize state
  const [qaSelected, setQaSelected] = useState<BayiQuickActionKey[]>(DEFAULT_BAYI_QUICK_ACTIONS);
  const [qaLoading, setQaLoading] = useState(true);
  const [qaSaving, setQaSaving] = useState(false);
  const [qaError, setQaError] = useState("");
  const [qaSavedAt, setQaSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/bayi-panel/profile${qs}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Profil yüklenemedi");
        setData(d);
      })
      .catch((e) => setProfileError(e.message || "Bağlantı hatası"))
      .finally(() => setLoading(false));
  }, [token]);

  // Hızlı İşlem tercihleri (dashboard endpoint döndürüyor — tek fetch)
  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/bayi-panel/dashboard${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.quickActions) && d.quickActions.length > 0) {
          setQaSelected(d.quickActions as BayiQuickActionKey[]);
        }
      })
      .catch(() => { /* default kalır */ })
      .finally(() => setQaLoading(false));
  }, [token]);

  function qaToggle(key: BayiQuickActionKey) {
    setQaSelected((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
    setQaSavedAt(null);
    setQaError("");
  }

  function qaMove(key: BayiQuickActionKey, delta: number) {
    setQaSelected((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const next = idx + delta;
      if (next < 0 || next >= prev.length) return prev;
      const out = [...prev];
      [out[idx], out[next]] = [out[next], out[idx]];
      return out;
    });
    setQaSavedAt(null);
  }

  function qaReset() {
    setQaSelected(DEFAULT_BAYI_QUICK_ACTIONS);
    setQaSavedAt(null);
    setQaError("");
  }

  async function qaSave() {
    setQaSaving(true);
    setQaError("");
    try {
      const res = await fetch("/api/bayi-panel/quick-actions/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ actions: qaSelected }),
      });
      const d = await res.json();
      if (!res.ok) {
        setQaError(d.error || "Kaydedilemedi.");
        return;
      }
      setQaSavedAt(Date.now());
    } catch {
      setQaError("Bağlantı hatası.");
    } finally {
      setQaSaving(false);
    }
  }

  async function handleDataExport() {
    setExporting(true);
    setExportError("");
    try {
      const url = token
        ? `/api/profile/data-export?t=${encodeURIComponent(token)}`
        : "/api/profile/data-export";
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) {
        setExportError("Veri indirilemedi. Lütfen tekrar deneyin.");
        return;
      }
      const blob = await res.blob();
      const today = new Date().toISOString().slice(0, 10);
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `upu-bayi-veri-export-${today}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(dlUrl);
    } catch {
      setExportError("Bağlantı hatası.");
    } finally {
      setExporting(false);
    }
  }

  function handleDeleteRequest() {
    const today = new Date().toISOString().slice(0, 10);
    const name = data?.displayName || "(otomatik doldurulamadı)";
    const phone = data?.phone || "(otomatik doldurulamadı)";
    const firma = data?.firma.ticari_unvan || "(otomatik doldurulamadı)";
    const subject = `Hesap Silme Talebi - ${firma}`;
    const body = [
      "Merhaba,",
      "",
      "UPU Bayi hesabımı silmek istiyorum. Bilgilerim:",
      `İsim: ${name}`,
      `Firma: ${firma}`,
      `WhatsApp: ${phone}`,
      `Tarih: ${today}`,
      "",
      "KVKK metninizde belirtildiği üzere 90 gün içinde işlenmesini rica ederim.",
      "",
      "İyi çalışmalar.",
    ].join("\n");
    const mailto = `mailto:info@upudev.nl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  const sektorLabel = (s: string | null): string => {
    if (!s) return "—";
    const map: Record<string, string> = {
      boya: "Boya & Kimyasal",
      gida: "Gıda & İçecek",
      hirdavat: "Hırdavat & Yapı Market",
      tekstil: "Tekstil & Konfeksiyon",
      temizlik: "Temizlik & Hijyen",
      diger: "Diğer",
    };
    return map[s] || s;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">⚙️ Panel Ayarları</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Profil özetiniz ve gizlilik / veri haklarınız.
        </p>
      </div>

      {/* Profilim özet */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Profilim</h2>
          {token && (
            <a
              href={`/tr/bayi-profil?t=${encodeURIComponent(token)}`}
              className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              ✏️ Profili Düzenle
            </a>
          )}
        </div>
        {profileError ? (
          <p className="text-sm text-rose-600">{profileError}</p>
        ) : loading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : data ? (
          <div className="space-y-1.5">
            <Row label="Ad Soyad" value={data.displayName} />
            <Row label="WhatsApp" value={data.phone} />
            <Row label="Ticari Ünvan" value={data.firma.ticari_unvan} />
            <Row label="Yetkili" value={data.firma.yetkili_adi} />
            <Row label="Sektör" value={sektorLabel(data.firma.sektor)} />
            <Row label="E-posta" value={data.firma.email_kurumsal} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Profil bilgisi bulunamadı.</p>
        )}
      </section>

      {/* Hızlı İşlemler customize */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">⚡ Hızlı İşlemler</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Panelinde görmek istediğin işlemleri seç, sırasını değiştir. Kapatılan işlemler ana panelden gizlenir.
          </p>
        </div>

        {qaLoading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : (
          <>
            <div className="space-y-1.5">
              {qaSelected.map((key, idx) => {
                const def = BAYI_QUICK_ACTIONS[key];
                if (!def) return null;
                const Icon = def.Icon;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50"
                  >
                    <button
                      type="button"
                      onClick={() => qaToggle(key)}
                      aria-label={`${def.label} kapat`}
                      className="w-6 h-6 rounded bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
                    </button>
                    <Icon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" strokeWidth={2.2} />
                    <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {def.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => qaMove(key, -1)}
                        disabled={idx === 0}
                        aria-label="Yukarı taşı"
                        className="w-7 h-7 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center disabled:opacity-30 active:scale-95"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => qaMove(key, 1)}
                        disabled={idx === qaSelected.length - 1}
                        aria-label="Aşağı taşı"
                        className="w-7 h-7 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center disabled:opacity-30 active:scale-95"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {ALL_BAYI_QUICK_ACTION_KEYS.filter((k) => !qaSelected.includes(k)).map((key) => {
                const def = BAYI_QUICK_ACTIONS[key];
                if (!def) return null;
                const Icon = def.Icon;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  >
                    <button
                      type="button"
                      onClick={() => qaToggle(key)}
                      aria-label={`${def.label} aç`}
                      className="w-6 h-6 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center flex-shrink-0 active:scale-95"
                    >
                      {/* boş kutu */}
                    </button>
                    <Icon className="w-4 h-4 text-slate-400" strokeWidth={2.2} />
                    <span className="flex-1 text-sm text-slate-500 dark:text-slate-400">
                      {def.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {qaError && (
              <p className="text-xs text-rose-600">{qaError}</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={qaSave}
                disabled={qaSaving || qaSelected.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold px-3 py-2 rounded-lg transition active:scale-[0.98]"
              >
                {qaSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={2.2} />}
                {qaSaving ? "Kaydediliyor…" : qaSavedAt ? "Kaydedildi ✓" : "Kaydet"}
              </button>
              <button
                type="button"
                onClick={qaReset}
                className="inline-flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium px-3 py-2 rounded-lg active:scale-[0.98]"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.2} />
                Sıfırla
              </button>
            </div>
          </>
        )}
      </section>

      {/* Gizlilik ve Veriler */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">🔒 Gizlilik ve Veriler</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            KVKK aydınlatma, hizmet şartları, iade politikası ve veri haklarınız.
          </p>
        </div>

        <div className="space-y-2">
          <LinkRow
            href="/tr/aydinlatma-metni?tenant=bayi"
            icon="📄"
            label="KVKK Aydınlatma Metni"
          />
          <LinkRow
            href="/tr/hizmet-sartlari?tenant=bayi"
            icon="📋"
            label="Hizmet Şartları"
          />
          <LinkRow
            href="/tr/iade-iptal?tenant=bayi"
            icon="↩️"
            label="İade ve İptal Politikası"
          />
          <LinkRow
            href="mailto:info@upudev.nl?subject=KVKK%20Veri%20Talebi"
            icon="✉️"
            label="Veri talebi gönder"
            external
          />
        </div>

        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleDataExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm active:scale-[0.98] transition"
          >
            {exporting ? "Hazırlanıyor…" : "⬇️ Verilerimi indir (JSON)"}
          </button>
          <button
            type="button"
            onClick={handleDeleteRequest}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-sm font-semibold active:scale-[0.98] transition"
          >
            🗑️ Hesap silme talebi gönder
          </button>
        </div>

        {exportError && (
          <p className="text-xs text-rose-600">{exportError}</p>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Hesabınızı silmek isterseniz info@upudev.nl adresinden iletişime geçin. Talebiniz 90 gün içinde işlenir.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-900 dark:text-slate-100 text-right break-words">{value || "—"}</span>
    </div>
  );
}

function LinkRow({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: string;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { rel: "noopener noreferrer" } : {})}
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-500 active:scale-[0.99] transition"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
        <span>{icon}</span>
        {label}
      </span>
      <span className="text-slate-400 dark:text-slate-500 text-sm">→</span>
    </a>
  );
}
