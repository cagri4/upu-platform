"use client";

/**
 * AI Eleman launcher — Faz 4 Sprint M.
 *
 * Bayi portal sağ-alt köşede FAB. Tıklanınca rol seçici açılır:
 *   Kurucu            — kurulum + veri girişi (yazma tool'ları)
 *   Yönetici Asistanı — rapor + analiz (salt-okuma tool'ları)
 *   Eğitmen           — portal kullanım rehberi (tool yok, anlatım)
 *
 * Backend: /api/agent/chat (commit 481628f — rol-bazlı prompt + tool
 * gating zaten hazır; body.role ile geçilir). Konuşma geçmişi server-side
 * agent_conversations'ta tutulur; bu component sadece görünür pencereyi
 * state'te tutar.
 *
 * Roller kod düzeyinde yetki sınırı taşır (CLAUDE.md: yetki=güvenlik
 * sınırı) — Yönetici Asistanı'nda yazma tool'u YOK, Eğitmen'de hiç yok.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  X,
  Send,
  ArrowLeft,
  Hammer,
  BarChart3,
  GraduationCap,
  Loader2,
} from "lucide-react";

type RoleId = "kurucu" | "yonetici" | "egitmen";

interface RoleDef {
  id: RoleId;
  label: string;
  desc: string;
  icon: typeof Hammer;
  hint: string;
}

const ROLES: RoleDef[] = [
  {
    id: "kurucu",
    label: "Kurucu",
    desc: "Kurulum ve veri girişi — ürün ekler, kampanya kurar, bayi davet eder.",
    icon: Hammer,
    hint: "Örn: \"Makarna kategorisinde 3 yeni ürün ekle\"",
  },
  {
    id: "yonetici",
    label: "Yönetici Asistanı",
    desc: "Rapor ve analiz — ciro, geciken bayiler, stok durumu. Salt-okuma.",
    icon: BarChart3,
    hint: "Örn: \"Bu hafta hangi bayi gecikmeye girdi?\"",
  },
  {
    id: "egitmen",
    label: "Eğitmen",
    desc: "Portalın nasıl kullanılacağını adım adım anlatır.",
    icon: GraduationCap,
    hint: "Örn: \"Excel ile toplu sipariş nasıl yüklerim?\"",
  },
];

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export function AiElemanLauncher() {
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleDef | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || !selectedRole) return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, role: selectedRole.id }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setError(d.error || "Yanıt alınamadı.");
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", text: (d.reply as string) || "…" },
      ]);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }, [input, busy, selectedRole]);

  return (
    <>
      {/* FAB — sağ-alt */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="AI Eleman"
          data-testid="ai-eleman-fab"
          className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-indigo-600 p-3.5 text-white shadow-lg transition-transform hover:scale-105 hover:bg-indigo-700"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[560px] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[calc(100vh-5rem)]">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-indigo-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              {selectedRole && (
                <button
                  onClick={() => {
                    setSelectedRole(null);
                    setMessages([]);
                    setError("");
                  }}
                  className="rounded-md p-1 hover:bg-indigo-500"
                  aria-label="Rol seçimine dön"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <Bot className="h-5 w-5" />
              <span className="text-sm font-semibold">
                {selectedRole ? `AI Eleman — ${selectedRole.label}` : "AI Eleman"}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 hover:bg-indigo-500"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!selectedRole ? (
            /* Rol seçici */
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              <p className="text-xs text-slate-500">
                Hangi elemana ihtiyacın var? Her rolün yetkisi farklı —
                Yönetici Asistanı sadece okur, Kurucu senin adına işlem yapar.
              </p>
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRole(r)}
                    data-testid={`ai-role-${r.id}`}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        {r.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {r.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Chat */
            <>
              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4"
              >
                {messages.length === 0 && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
                    <p className="font-medium">{selectedRole.label} hazır.</p>
                    <p className="mt-1 text-indigo-700">{selectedRole.hint}</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-indigo-600 text-white"
                          : "border border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {selectedRole.label} düşünüyor…
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {error}
                  </div>
                )}
              </div>
              <div className="flex items-end gap-2 border-t border-slate-200 bg-white p-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Mesajını yaz…"
                  data-testid="ai-chat-input"
                  className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={send}
                  disabled={busy || !input.trim()}
                  aria-label="Gönder"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
