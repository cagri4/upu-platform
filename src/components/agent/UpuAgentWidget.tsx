"use client";

/**
 * UPU AI Eleman Widget — sağ alt floating button + chat slide-in panel.
 *
 * V1 MVP (non-streaming):
 *   - Floating button (sağ alt, fixed, z-50)
 *   - Tıklanınca slide-in panel açılır (desktop sağdan, mobile fullscreen)
 *   - Karşılama mesajı (history boşsa)
 *   - Mesajlaşma: textarea + send, hızlı komut chip'leri
 *   - Tool call'lar küçük kart olarak gösterilir
 *
 * Streaming V2'de eklenecek — şu an non-streaming, loading dot animation.
 */

import { useEffect, useRef, useState } from "react";
import { Bot, X, Send, Sparkles, Loader2, Wrench, Trash2 } from "lucide-react";

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
}

const QUICK_PROMPTS = [
  "📊 Bugün ne var?",
  "💰 Cari özet getir",
  "📦 Bekleyen siparişler",
  "🔔 Vadesi geçmiş faturalar",
];

function genId() { return Math.random().toString(36).slice(2); }

export function UpuAgentWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const r = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: text }),
      });
      const d = await r.json();
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
      {/* Floating button — WhatsApp brand glyph (#25D366), official Meta SVG path */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="UPU AI aç"
          className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full text-white shadow-lg hover:shadow-xl active:scale-95 transition flex items-center justify-center"
          style={{ backgroundColor: "#25D366" }}
        >
          <WhatsappGlyph className="w-7 h-7" />
        </button>
      )}

      {/* Slide-in panel */}
      {open && (
        <div className="fixed inset-0 z-50 sm:bottom-4 sm:right-4 sm:top-auto sm:left-auto sm:inset-auto sm:max-w-md sm:w-[400px] sm:h-[600px] flex flex-col bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
          <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" strokeWidth={2.4} />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white leading-tight">UPU</p>
                <p className="text-[10px] text-slate-500 leading-tight">Bayi asistanın</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={clearAll} aria-label="Temizle" className="w-8 h-8 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition">
                <Trash2 className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Kapat" className="w-8 h-8 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {!hydrated ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-white" strokeWidth={2.2} />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  Merhaba {displayName || "Kullanıcı"}! 👋
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ben UPU — bayi yönetiminde sana nasıl yardım edeyim?
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

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="border-t border-slate-200 dark:border-slate-800 p-3 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="UPU'ya yaz…"
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
        </div>
      )}
    </>
  );
}

/**
 * WhatsApp brand glyph — official Meta path (phone in chat bubble).
 * Source: en.wikipedia.org/wiki/File:WhatsApp.svg (Meta'nın CC BY-SA brand SVG).
 */
function WhatsappGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
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
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-white" strokeWidth={2.4} />
      </div>
      <div className="max-w-[85%] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-md px-3 py-2 text-sm whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}
