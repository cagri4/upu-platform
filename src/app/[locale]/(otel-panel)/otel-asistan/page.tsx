"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Bot, Check, X, Loader2, AlertTriangle, BookOpen, Edit3, MessageSquare, Star, Calendar, BedDouble } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface Approval {
  id: string;
  agent_role: string;
  action_type: string;
  status: string;
  draft_content: string | null;
  context: any;
  target_channel: string | null;
  target_address: string | null;
  related_entity_id: string | null;
  related_entity_type: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Onay bekliyor", cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" },
  sent:     { label: "Onaylandı",     cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" },
  rejected: { label: "Reddedildi",    cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300" },
  failed:   { label: "Hata",          cls: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300" },
};

const ROLE_META: Record<string, { label: string; Icon: any; cls: string }> = {
  direkt_rez:       { label: "Direkt Rezervasyon",  Icon: Calendar,       cls: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300" },
  itibar:           { label: "İtibar (Yorum)",      Icon: Star,           cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300" },
  misafir_iletisim: { label: "Misafir İletişim",    Icon: MessageSquare,  cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" },
  fiyatlama:        { label: "Fiyatlama",           Icon: BedDouble,      cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" },
  tahsilat:         { label: "Tahsilat",            Icon: BedDouble,      cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" },
};

export default function OtelAsistanPage() {
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token");
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "sent" | "rejected">("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/agent-approvals${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => setApprovals(d.approvals || []))
      .catch(() => setApprovals([]));
  };

  useEffect(reload, [token]);

  const act = async (id: string, action: "approve" | "reject" | "edit", payload: Record<string, any> = {}) => {
    setActionId(id);
    setError(null);
    try {
      const body: any = { action, ...payload };
      if (token) body.token = token;
      const r = await fetch(`/api/otel-panel/agent-approvals/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) setError(d.error);
      else { reload(); setEditingId(null); }
    } finally {
      setActionId(null);
    }
  };

  const filtered = (approvals ?? []).filter(a => {
    if (filter === "all") return true;
    if (filter === "pending") return a.status === "pending";
    if (filter === "sent") return a.status === "sent";
    if (filter === "rejected") return a.status === "rejected" || a.status === "failed";
    return true;
  });

  const pendingCount = (approvals || []).filter(a => a.status === "pending").length;

  return (
    <div className="space-y-5">
      <HeroBanner
        title="AI Asistan"
        subtitle="Otel'in AI Eleman'ı 3 sürec yürütür: Direkt Rezervasyon, İtibar, Misafir İletişim. Tüm çıkış aksiyonları bu kuyrukta onayınıza düşer — sizin gözünüzden geçmeyen mesaj asla gönderilmez."
        Icon={Bot}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {([
            { key: "pending", label: `Bekleyen${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
            { key: "sent", label: "Onaylandı" },
            { key: "rejected", label: "Reddedildi" },
            { key: "all", label: "Tümü" },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filter === f.key
                  ? "bg-emerald-600 text-white"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-emerald-400"
              }`}>{f.label}</button>
          ))}
        </div>
        <Link href={`/tr/otel-asistan/bilgi${token ? `?t=${encodeURIComponent(token)}` : ""}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium">
          <BookOpen className="w-4 h-4" /> Bilgi Bankası
        </Link>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {approvals === null && (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="h-24" />)}</div>
      )}

      {approvals?.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-8 text-center shadow-sm">
          <Bot className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" strokeWidth={1.5} />
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">AI henüz bir taslak hazırlamadı.</p>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Yeni rez/yorum/varış geldiğinde AI burada toplayacak ve sizin onayınıza sunacak.
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(a => {
            const meta = STATUS_META[a.status] || { label: a.status, cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" };
            const role = ROLE_META[a.agent_role] || { label: a.agent_role, Icon: Bot, cls: "bg-slate-100 text-slate-700" };
            const RIcon = role.Icon;
            const isEditing = editingId === a.id;
            return (
              <div key={a.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 px-4 py-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium ${role.cls}`}>
                      <RIcon className="w-3 h-3" /> {role.label}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
                    {a.target_channel && <span className="text-[10px] text-slate-500 uppercase">{a.target_channel}</span>}
                    {a.target_address && <span className="text-[10px] text-slate-500 font-mono">{a.target_address}</span>}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{new Date(a.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>

                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                ) : (
                  a.draft_content && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-2">
                      {a.draft_content}
                    </div>
                  )
                )}

                {a.rejection_reason && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 italic mb-2">Red sebebi: {a.rejection_reason}</p>
                )}

                {a.status === "pending" && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {!isEditing ? (
                      <>
                        <button onClick={() => { setEditingId(a.id); setEditContent(a.draft_content || ""); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium">
                          <Edit3 className="w-3 h-3" /> Düzenle
                        </button>
                        <button onClick={() => act(a.id, "approve")} disabled={actionId === a.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium disabled:opacity-50">
                          {actionId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Onayla & Gönder
                        </button>
                        <button onClick={() => {
                          const reason = prompt("Red sebebi (ops.):");
                          act(a.id, "reject", { rejection_reason: reason || undefined });
                        }} disabled={actionId === a.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-medium disabled:opacity-50">
                          <X className="w-3 h-3" /> Reddet
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => act(a.id, "approve", { edited_content: editContent })} disabled={actionId === a.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium disabled:opacity-50">
                          {actionId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Düzenlenmiş Hali Onayla
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium">
                          Vazgeç
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
