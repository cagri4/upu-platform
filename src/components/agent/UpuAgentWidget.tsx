"use client";

/**
 * UPU AI Eleman Widget — sağ alt floating button + rol-seçici + chat panel.
 *
 * V2 (Faz 1C, 2026-05-29) — rol-bazlı AI Eleman ekibi:
 *   - Floating button (sağ alt, fixed, z-50)
 *   - Tıklanınca: önce ROL SEÇİCİ (3 kart: Kurucu / Asistan / Eğitmen);
 *     rol seçilince chat panel açılır.
 *   - Son seçilen rol localStorage'da persist; tekrar açılışta picker'ı
 *     atlayıp direkt o role bağlanır.
 *   - Global event API: window.dispatchEvent(new CustomEvent('upu:open-agent',
 *     { detail: { role: 'kurucu' } })) — onboarding "Hadi başlayalım" sonu
 *     veya başka tetikleyiciler Kurucu'yu programlı açabilir.
 *   - Header rol etiketi + "Rolü değiştir" küçük link.
 *   - Backend: /api/agent/chat?role=<id> query parametre eklenir (Faz 3'te
 *     persona + tool gating tam implement; şu an placeholder).
 *
 * Eski özellikler korunur: history hydrate, quota rozeti, KATMAN A/B/C,
 * quick prompts, tool kart rendering.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Send, Loader2, Wrench, Trash2, ChevronLeft } from "lucide-react";

const AVATAR_SRC = "/icons/upu-avatar.jpg";

interface Message {
  role: "user" | "assistant" | "tool";
  content: unknown;
  tool_use_id?: string | null;
  created_at?: string;
  /** Client-side UUID (rendering için). */
  clientId?: string;
}

interface ChatResponse {
  ok: true;
  reply: string;
  tool_calls: Array<{ name: string; input: unknown; output: unknown }>;
  quota?: { used: number; limit: number; remaining: number };
}

interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  status: "ok" | "warning" | "critical" | "exceeded";
  plan: string;
  plan_display: string;
  period_end: string;
  days_until_reset: number;
}

interface QuotaExceededInfo {
  used: number;
  limit: number;
  plan: string;
  plan_display: string;
  period_end: string;
  days_until_reset: number;
}

const BAYI_QUICK_PROMPTS = [
  "📊 Bugün ne var?",
  "💰 Cari özet getir",
  "📦 Bekleyen siparişler",
  "🔔 Vadesi geçmiş faturalar",
];

const EMLAK_QUICK_PROMPTS = [
  "🏠 Portföyüm",
  "👤 Aktif müşteriler",
  "📋 Son sözleşmeler",
  "🎯 Bugünkü takipler",
  "📅 Yakın hatırlatmalar",
];

const TENANT_LABELS: Record<string, string> = {
  bayi: "Bayi asistanın",
  emlak: "Emlak asistanın",
};

// ─── Rol-bazlı AI Eleman ekibi (Faz 1C) ──────────────────────────────
export type AgentRoleId = "kurucu" | "yonetici" | "egitmen";

interface AgentRoleDef {
  id: AgentRoleId;
  label: string;
  emoji: string;
  desc: string;
  accent: string;       // background renk (kart)
  border: string;       // border renk
  badgeBg: string;      // header etiketi
  placeholder: string;  // input placeholder (rol context)
  greeting: (name: string) => string;
}

const BAYI_AGENT_ROLES: AgentRoleDef[] = [
  {
    id: "kurucu",
    label: "Kurucu",
    emoji: "🛠️",
    desc: "Sistemi seninle baştan kurar — bayi listesi, ürünler, ayarlar.",
    accent: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-300 dark:border-indigo-700/60 hover:border-indigo-500",
    badgeBg: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
    placeholder: "Kurucu'ya yaz… (örn: Excel'imi yükleyebilir miyim?)",
    greeting: (name) =>
      `Merhaba ${name || "Kullanıcı"}! 🛠️\nBen Kurucu — bayi listen, ürün katalogun ve ayarları sıfırdan birlikte kuralım. Hangi yöntemle başlayalım?`,
  },
  {
    id: "yonetici",
    label: "Yönetici Asistanı",
    emoji: "📊",
    desc: "Veriyi getirir, rapor hazırlar, sorularını yanıtlar.",
    accent: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-300 dark:border-emerald-700/60 hover:border-emerald-500",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    placeholder: "Yönetici Asistanı'na yaz…",
    greeting: (name) =>
      `Merhaba ${name || "Kullanıcı"}! 📊\nBen Yönetici Asistanı — bayi performansı, sipariş, cari, çuruh riski, vade — ne istersen getiririm.`,
  },
  {
    id: "egitmen",
    label: "Panel Eğitmeni",
    emoji: "🎓",
    desc: "Paneli adım adım anlatır — hangi sayfa ne işe yarar.",
    accent: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-700/60 hover:border-amber-500",
    badgeBg: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    placeholder: "Panel Eğitmeni'ne yaz…",
    greeting: (name) =>
      `Merhaba ${name || "Kullanıcı"}! 🎓\nBen Panel Eğitmeni — hangi özelliği keşfetmek istersin? "Otomatik kampanya nasıl çalışır?" gibi sor.`,
  },
];

function getRoleById(id: AgentRoleId | null): AgentRoleDef | null {
  if (!id) return null;
  return BAYI_AGENT_ROLES.find(r => r.id === id) || null;
}

const ROLE_STORAGE_KEY = "upu-agent-role:bayi";

interface UpuAgentWidgetProps {
  /** Tenant key — quick prompts + subtitle bu key'e göre seçilir.
   *  Default "bayi" (geriye uyum: prop geçilmemişse mevcut bayi davranışı). */
  tenantKey?: "bayi" | "emlak";
}

function genId() { return Math.random().toString(36).slice(2); }

export function UpuAgentWidget({ tenantKey = "bayi" }: UpuAgentWidgetProps = {}) {
  const QUICK_PROMPTS = tenantKey === "emlak" ? EMLAK_QUICK_PROMPTS : BAYI_QUICK_PROMPTS;
  const tenantSubtitle = TENANT_LABELS[tenantKey] || "AI asistanın";
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AgentRoleId | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState<QuotaExceededInfo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeRole = getRoleById(role);
  const showPicker = open && !role;

  // localStorage'dan son rolü oku (bayi tenant için)
  useEffect(() => {
    if (typeof window === "undefined" || tenantKey !== "bayi") return;
    try {
      const saved = window.localStorage.getItem(ROLE_STORAGE_KEY);
      if (saved === "kurucu" || saved === "yonetici" || saved === "egitmen") {
        setRole(saved as AgentRoleId);
      }
    } catch { /* private mode */ }
  }, [tenantKey]);

  // Global event API: window.dispatchEvent(new CustomEvent('upu:open-agent',
  // { detail: { role: 'kurucu' } })) — onboarding "Hadi başlayalım" sonu
  // ve diğer tetikleyiciler.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as { role?: AgentRoleId } | undefined;
      if (detail?.role) {
        setRole(detail.role);
        try { window.localStorage.setItem(ROLE_STORAGE_KEY, detail.role); } catch { /* */ }
      }
      setOpen(true);
    }
    window.addEventListener("upu:open-agent", handler as EventListener);
    return () => window.removeEventListener("upu:open-agent", handler as EventListener);
  }, []);

  const pickRole = useCallback((rid: AgentRoleId) => {
    setRole(rid);
    try { window.localStorage.setItem(ROLE_STORAGE_KEY, rid); } catch { /* */ }
  }, []);

  const switchRole = useCallback(() => {
    setRole(null);
    setMessages([]);  // farklı rol → temiz konuşma (history hydrate de boş gelecek; Faz 3'te per-role kanal)
    setHydrated(false);
  }, []);

  // Quota durumu çek — mount'ta + her chat sonrası
  const fetchQuota = async () => {
    try {
      const r = await fetch("/api/agent/quota", { credentials: "same-origin" });
      if (!r.ok) return;
      const d = await r.json();
      if (d?.ok) {
        setQuota({
          used: d.used, limit: d.limit, remaining: d.remaining,
          percent: d.percent, status: d.status,
          plan: d.plan, plan_display: d.plan_display,
          period_end: d.period_end, days_until_reset: d.days_until_reset,
        });
      }
    } catch { /* sessiz */ }
  };

  useEffect(() => { fetchQuota(); }, []);

  // History hydrate
  useEffect(() => {
    if (!open || hydrated) return;
    fetch("/api/agent/history?limit=50", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.ok) {
          setDisplayName(d.display_name || null);
          setMessages((d.messages || []).map((m: Message) => ({ ...m, clientId: genId() })));
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
  }, [open, hydrated]);

  // Scroll bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    setLoading(true);

    // Optimistic user message
    setMessages((prev) => [...prev, {
      role: "user",
      content: text,
      clientId: genId(),
    }]);

    try {
      const r = await fetch(`/api/agent/chat${role ? `?role=${encodeURIComponent(role)}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: text, role: role || undefined }),
      });
      const d = await r.json();
      if (r.status === 429 && d?.error === "quota_exceeded") {
        // KATMAN C — limit modal aç
        setQuotaExceeded({
          used: d.used, limit: d.limit, plan: d.plan,
          plan_display: d.plan_display,
          period_end: d.period_end,
          days_until_reset: d.days_until_reset,
        });
        // Optimistic user message'i geri çek
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      if (!r.ok) {
        setError(d.error || "AI yanıt veremedi.");
        return;
      }
      const cd = d as ChatResponse;

      // Tool call'ları yeni mesajlar olarak ekle (visual)
      const toolMsgs: Message[] = (cd.tool_calls || []).map((tc) => ({
        role: "tool",
        content: { tool_name: tc.name, input: tc.input, output: tc.output },
        clientId: genId(),
      }));

      setMessages((prev) => [
        ...prev,
        ...toolMsgs,
        { role: "assistant", content: cd.reply, clientId: genId() },
      ]);
      // Quota'yı tazele (her chat sonrası backend cumulative tutuyor)
      fetchQuota();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }

  async function clearAll() {
    if (!confirm("Konuşma temizlensin mi?")) return;
    await fetch("/api/agent/clear", { method: "POST", credentials: "same-origin" });
    setMessages([]);
  }

  return (
    <>
      {/* Floating button — UPU avatar (Meta WA profil görseli)
          KATMAN A: pasif quota rozeti (used/limit) — sadece görünür, dikkat çekmez */}
      {!open && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="UPU AI aç"
            className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl active:scale-95 transition overflow-hidden bg-white"
          >
            <Image
              src={AVATAR_SRC}
              alt="UPU"
              width={56}
              height={56}
              className="w-full h-full object-cover"
              priority
            />
          </button>
          {quota && (
            <div
              className={`absolute -top-1 -right-1 text-white text-[10px] font-medium rounded-full px-1.5 py-0.5 shadow ${
                quota.status === "exceeded" ? "bg-rose-600"
                  : quota.status === "critical" ? "bg-orange-500"
                  : quota.status === "warning" ? "bg-amber-500"
                  : "bg-slate-700"
              }`}
              title={`${quota.plan_display} — ${quota.days_until_reset} gün sonra yenilenir`}
            >
              {quota.used}/{quota.limit}
            </div>
          )}
        </div>
      )}

      {/* Slide-in panel */}
      {open && (
        <div className="fixed inset-0 z-50 sm:bottom-4 sm:right-4 sm:top-auto sm:left-auto sm:inset-auto sm:max-w-md sm:w-[400px] sm:h-[600px] flex flex-col bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
          <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              {!showPicker && activeRole && tenantKey === "bayi" ? (
                <button
                  type="button"
                  onClick={switchRole}
                  className="w-7 h-7 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition flex-shrink-0"
                  title="Rolü değiştir"
                  aria-label="Rolü değiştir"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              ) : (
                <Image
                  src={AVATAR_SRC}
                  alt="UPU"
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {showPicker ? "UPU AI Eleman" : (activeRole && tenantKey === "bayi" ? `${activeRole.emoji} ${activeRole.label}` : "UPU")}
                </p>
                <p className="text-[10px] text-slate-500 leading-tight truncate">
                  {showPicker ? "Rolünü seç" : (activeRole && tenantKey === "bayi" ? activeRole.desc : tenantSubtitle)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!showPicker && (
                <button type="button" onClick={clearAll} aria-label="Temizle" className="w-8 h-8 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Kapat" className="w-8 h-8 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* ROL SEÇİCİ — bayi tenant + rol seçilmediğinde */}
          {showPicker && tenantKey === "bayi" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-1">
                Hangi AI Eleman'la konuşmak istersin?
              </p>
              {BAYI_AGENT_ROLES.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pickRole(r.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 ${r.accent} ${r.border} transition active:scale-[0.99]`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl leading-none flex-shrink-0" aria-hidden>{r.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-900 dark:text-white mb-0.5">
                        {r.label}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                        {r.desc}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center pt-2 leading-relaxed">
                Yetkiler rol bazlı — Kurucu yazar, Asistan okur, Eğitmen veriye dokunmaz.
              </p>
            </div>
          )}

          {/* KATMAN B — uyarı bar (%70+) — motivasyon tonu (picker'da gizli) */}
          {!showPicker && quota && quota.percent >= 70 && quota.status !== "exceeded" && (
            <div className={`border-b px-4 py-2 ${
              quota.status === "critical" ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50"
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${quota.status === "critical" ? "text-orange-800 dark:text-orange-200" : "text-amber-800 dark:text-amber-200"}`}>
                  {quota.status === "critical" ? "🎯" : "🚀"} Bu ay {quota.used} mesaj attın
                </span>
                <span className={quota.status === "critical" ? "text-orange-700 dark:text-orange-300" : "text-amber-700 dark:text-amber-300"}>
                  {quota.days_until_reset} gün sonra yenilenir
                </span>
              </div>
              <div className="mt-1.5 h-1 bg-white/40 dark:bg-slate-900/40 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${quota.percent >= 90 ? "bg-orange-500" : "bg-amber-500"}`}
                  style={{ width: `${Math.min(100, quota.percent)}%` }}
                />
              </div>
            </div>
          )}

          {!showPicker && (
          <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {!hydrated ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-6">
                <Image
                  src={AVATAR_SRC}
                  alt="UPU"
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover mx-auto mb-3"
                />
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  Merhaba {displayName || "Kullanıcı"}! 👋
                </p>
                <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">
                  {activeRole && tenantKey === "bayi"
                    ? activeRole.greeting(displayName || "")
                    : tenantKey === "emlak"
                      ? "Ben UPU — emlak portföyünde sana nasıl yardım edeyim?"
                      : "Ben UPU — bayi yönetiminde sana nasıl yardım edeyim?"}
                </p>
              </div>
            ) : (
              messages.map((m) => <MessageBubble key={m.clientId || genId()} m={m} />)
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                UPU yazıyor…
              </div>
            )}

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-2 text-xs text-rose-700">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Quick chips (boş history'de) */}
          {messages.length === 0 && hydrated && (
            <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  disabled={loading}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/30 text-slate-700 dark:text-slate-300 transition disabled:opacity-60"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* KATMAN C — limit modal (quota_exceeded 429) */}
          {quotaExceeded && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4 z-10 sm:rounded-2xl">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
                <div className="text-center mb-3">
                  <div className="text-4xl mb-2">🎯</div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Aylık quota&apos;n doldu
                  </h2>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                  Bu ay <span className="font-semibold">{quotaExceeded.limit} mesajını</span> kullandın
                  — harika kullanıyorsun! {quotaExceeded.days_until_reset} gün sonra
                  ({quotaExceeded.period_end}) otomatik yenilenecek.
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  Plan: <span className="font-medium">{quotaExceeded.plan_display}</span>
                </p>
                <div className="flex flex-col gap-2">
                  <a
                    href={tenantKey === "bayi" ? "/tr/bayi-billing?from=quota" : "#"}
                    onClick={(e) => { if (tenantKey !== "bayi") { e.preventDefault(); alert("Plan yükseltme bu tenant için henüz açık değil."); } }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded-lg transition text-center"
                  >
                    Pakete geç (daha fazla mesaj)
                  </a>
                  <button
                    type="button"
                    onClick={() => setQuotaExceeded(null)}
                    className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm py-1.5 transition"
                  >
                    Sonra
                  </button>
                </div>
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="border-t border-slate-200 dark:border-slate-800 p-3 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={activeRole && tenantKey === "bayi" ? activeRole.placeholder : "UPU'ya yaz…"}
              disabled={loading}
              className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center justify-center active:scale-95 transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          </>
          )}
        </div>
      )}
    </>
  );
}

function MessageBubble({ m }: { m: Message }) {
  if (m.role === "user") {
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-emerald-600 text-white rounded-2xl rounded-br-md px-3 py-2 text-sm">
          {text}
        </div>
      </div>
    );
  }

  if (m.role === "tool") {
    const c = m.content as { tool_name?: string; output?: unknown };
    return (
      <details className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-600 dark:text-slate-400">
        <summary className="cursor-pointer flex items-center gap-1.5">
          <Wrench className="w-3 h-3 text-indigo-500" />
          <code className="font-mono">{c?.tool_name || "tool"}</code>
        </summary>
        <pre className="mt-2 text-[10px] overflow-x-auto max-h-40">{JSON.stringify(c?.output, null, 2)}</pre>
      </details>
    );
  }

  // assistant — content text veya array (Anthropic content blocks)
  const text = (() => {
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      return (m.content as Array<{ type: string; text?: string }>)
        .filter((b) => b.type === "text")
        .map((b) => b.text || "")
        .join("\n");
    }
    return "";
  })();

  if (!text) return null;

  return (
    <div className="flex gap-2">
      <Image
        src="/icons/upu-avatar.jpg"
        alt="UPU"
        width={28}
        height={28}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      />
      <div className="max-w-[85%] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-md px-3 py-2 text-sm whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}
