"use client";

/**
 * /tr/site-duyurularim — Modül 3: Duyuru & İletişim (Sprint 3 rewrite).
 *
 * Sprint 1'de placeholder idi. Şimdi gerçek CRUD: yeni duyuru oluştur,
 * taslak kaydet, hemen gönder veya planla. Sent duyurular geçmiş listesi.
 *
 * Kanal seçici (inbox + wa_template + sms + email). WA template seçimi
 * Çağrı'nın Meta'ya başvurduğu 4 taslaktan biri.
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Megaphone,
  Send,
  X,
  Trash2,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
} from "lucide-react";
import { HeroBanner, ListCard, Skeleton } from "@/components/banking";

interface Announcement {
  id: string;
  title: string;
  body: string;
  target_scope: string;
  target_block: string | null;
  target_role: string | null;
  channels: string[];
  wa_template_id: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  total_recipients: number;
  read_count: number;
  created_at: string;
}

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Bell,
  wa_template: MessageSquare,
  sms: Smartphone,
  email: Mail,
};

const WA_TEMPLATES = [
  { id: "aidat_hatirlatma_v1", label: "Aidat Hatırlatma" },
  { id: "bakim_duyuru_v1", label: "Bakım Duyuru" },
  { id: "toplanti_cagri_v1", label: "Toplantı Çağrı" },
  { id: "ariza_durum_v1", label: "Arıza Durum" },
];

export default function SiteDuyurularimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "new" | "edit"; data?: Announcement } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/site/duyuru${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) setError(d.error);
        else setList(d.announcements || []);
      })
      .catch(() => setError("Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const drafts = list.filter((a) => !a.sent_at);
  const sent = list.filter((a) => a.sent_at);

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Megaphone}
        title="Duyurular"
        subtitle={`${drafts.length} taslak · ${sent.length} gönderilmiş`}
        ctaLabel="Yeni Duyuru"
        ctaOnClick={() => setModal({ mode: "new" })}
      />

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-sm">
          ⚠ {error}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide px-1">
            Taslaklar
          </div>
          {drafts.map((a) => (
            <ListCard
              key={a.id}
              Icon={Megaphone}
              title={a.title}
              subtitle={`${a.body.slice(0, 50)}${a.body.length > 50 ? "…" : ""}  ·  ${a.channels.join(", ")}`}
              rightLabel="Düzenle"
              onClick={() => setModal({ mode: "edit", data: a })}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Gönderilmiş ({sent.length})
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-16" />)}
          </div>
        ) : sent.length === 0 && drafts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center space-y-2">
            <div className="text-4xl">📣</div>
            <div className="font-semibold text-slate-900 dark:text-white">Henüz duyuru yok</div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              İlk duyurunuzu oluşturmak için sağ üstteki butonu kullanın.
            </p>
          </div>
        ) : (
          sent.map((a) => (
            <ListCard
              key={a.id}
              Icon={Send}
              title={a.title}
              subtitle={`📅 ${new Date(a.sent_at!).toLocaleDateString("tr-TR")} · 👥 ${a.total_recipients} kişi · ${a.channels.join(", ")}`}
              rightLabel={`${a.read_count}/${a.total_recipients}`}
            />
          ))
        )}
      </div>

      {/* WA Template bilgi banner */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 text-sm text-blue-900 dark:text-blue-200">
        <p className="font-semibold mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> WA Template Onayı
        </p>
        <p className="mb-2">
          WhatsApp Business onaylı 4 template taslağı hazır:
        </p>
        <ul className="text-xs space-y-1 list-disc pl-5">
          {WA_TEMPLATES.map((t) => (
            <li key={t.id}><code className="font-mono">{t.id}</code> — {t.label}</li>
          ))}
        </ul>
        <p className="text-xs mt-2 opacity-80">
          Meta panelinden Utility kategorisinde onaya gönderildikten sonra
          (1-3 iş günü) bu template'ler 24-saat penceresi dışında bile gönderilebilir.
        </p>
      </div>

      {modal && (
        <AnnouncementModal
          mode={modal.mode}
          initial={modal.data}
          token={token}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

interface ModalProps {
  mode: "new" | "edit";
  initial?: Announcement;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

function AnnouncementModal({ mode, initial, token, onClose, onSaved }: ModalProps) {
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [target_scope, setTargetScope] = useState(initial?.target_scope || "all");
  const [target_block, setTargetBlock] = useState(initial?.target_block || "");
  const [channels, setChannels] = useState<string[]>(initial?.channels || ["inbox"]);
  const [wa_template_id, setWaTemplateId] = useState(initial?.wa_template_id || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function toggleChannel(ch: string) {
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  }

  async function save(sendNow: boolean) {
    if (!title.trim() || !body.trim()) {
      setMsg({ kind: "err", text: "Başlık ve içerik zorunlu." });
      return;
    }
    if (channels.includes("wa_template") && !wa_template_id) {
      setMsg({ kind: "err", text: "WA template seçin." });
      return;
    }

    setSaving(true);
    setMsg(null);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      body: body.trim(),
      target_scope,
      target_block: target_scope === "block" ? target_block.trim() : null,
      channels,
      wa_template_id: wa_template_id || null,
    };
    if (mode === "edit") {
      payload.id = initial?.id;
      if (sendNow) payload.send_now = true;
    }

    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const sendQs = mode === "new" && sendNow ? "send=true" : "";
      const url = `/api/site/duyuru${qs}${qs && sendQs ? `&${sendQs}` : sendQs ? `?${sendQs}` : ""}`;

      const res = await fetch(url, {
        method: mode === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: d.error || "Kaydedilemedi." });
      } else {
        setMsg({
          kind: "ok",
          text: sendNow
            ? `✓ Gönderildi — ${d.total_recipients} alıcı`
            : "✓ Taslak kaydedildi",
        });
        window.setTimeout(() => onSaved(), 1500);
      }
    } catch {
      setMsg({ kind: "err", text: "Bağlantı hatası." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow() {
    if (!initial?.id || initial.sent_at) return;
    if (!confirm(`"${initial.title}" taslağı silinsin mi?`)) return;
    setSaving(true);
    try {
      const qs = `?id=${encodeURIComponent(initial.id)}${token ? `&t=${encodeURIComponent(token)}` : ""}`;
      const res = await fetch(`/api/site/duyuru${qs}`, { method: "DELETE", credentials: "same-origin" });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  const isReadOnly = !!initial?.sent_at;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-3 my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            {mode === "new" ? "Yeni Duyuru" : isReadOnly ? "Gönderilmiş Duyuru" : "Taslak Düzenle"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Başlık *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isReadOnly}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">İçerik *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isReadOnly}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Hedef</label>
          <select
            value={target_scope}
            onChange={(e) => setTargetScope(e.target.value)}
            disabled={isReadOnly}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm disabled:opacity-60"
          >
            <option value="all">Tüm sakinler</option>
            <option value="block">Belirli blok</option>
            <option value="role">Rol bazlı</option>
          </select>
        </div>

        {target_scope === "block" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Blok</label>
            <input
              value={target_block}
              onChange={(e) => setTargetBlock(e.target.value)}
              disabled={isReadOnly}
              placeholder="A blok"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Kanallar</label>
          <div className="flex flex-wrap gap-2">
            {(["inbox", "wa_template", "sms", "email"] as const).map((ch) => {
              const Icon = CHANNEL_ICONS[ch];
              const active = channels.includes(ch);
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => !isReadOnly && toggleChannel(ch)}
                  disabled={isReadOnly}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  } disabled:opacity-60`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {ch === "wa_template" ? "WA" : ch.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {channels.includes("wa_template") && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">WA Template</label>
            <select
              value={wa_template_id}
              onChange={(e) => setWaTemplateId(e.target.value)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm disabled:opacity-60"
            >
              <option value="">Seçin…</option>
              {WA_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.label} ({t.id})</option>
              ))}
            </select>
          </div>
        )}

        {msg && (
          <div className={`rounded-lg p-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"}`}>
            {msg.text}
          </div>
        )}

        {!isReadOnly && (
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => save(false)}
              disabled={saving}
              className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition"
            >
              Taslak Kaydet
            </button>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition active:scale-[0.98]"
            >
              Gönder
            </button>
            {mode === "edit" && (
              <button
                type="button"
                onClick={deleteRow}
                disabled={saving}
                className="px-3 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 py-2.5 rounded-lg text-sm font-semibold transition"
                aria-label="Sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
