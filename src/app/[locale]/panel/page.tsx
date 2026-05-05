"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { whatsappDeeplink } from "@/lib/whatsapp-deeplink";
import { YARDIM_ENTRIES, type YardimEntry } from "@/lib/yardim-content";

type Status = "loading" | "ready" | "error";

const PANEL_COMMAND_ORDER = [
  "mulkekle",
  "musterilerim",
  "sunumolustur",
  "sozlesme",
  "portfoyara",
  "ilantakip",
  "profilduzenle",
];

const SECTION_ORDER = [
  "🏠 Mülk Yönetimi",
  "👥 Müşteri Yönetimi",
  "🎯 Müşteriye Sunum",
  "📡 Pazar Tarama",
  "🪪 Profil",
];

export default function YonetimPaneli() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [officeName, setOfficeName] = useState<string | null>(null);
  const [botPhone, setBotPhone] = useState<string>("31644967207");
  const [helpEntry, setHelpEntry] = useState<YardimEntry | null>(null);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/panel/init?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setDisplayName(d.displayName);
        setOfficeName(d.officeName);
        if (d.botPhone) setBotPhone(d.botPhone);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  if (status === "loading") return <Center>⏳ Yükleniyor...</Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${botPhone}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  // Panel kartlarını seç + section'a göre grupla
  const cards = PANEL_COMMAND_ORDER
    .map((c) => YARDIM_ENTRIES.find((e) => e.command === c))
    .filter((e): e is YardimEntry => !!e);

  const sections = SECTION_ORDER.map((s) => ({
    title: s,
    items: cards.filter((c) => c.panelSection === s),
  })).filter((s) => s.items.length > 0);

  const firstName = (displayName || "").split(/\s+/)[0] || "";

  function startUrl(entry: YardimEntry): string {
    if (!entry.startAction) return `https://wa.me/${botPhone}?text=${encodeURIComponent(entry.waCommand)}`;
    if (entry.startAction.type === "web") {
      return `${entry.startAction.path}?t=${token || ""}`;
    }
    return `https://wa.me/${botPhone}?text=${encodeURIComponent(entry.startAction.text)}`;
  }

  function startUrlMobile(entry: YardimEntry): string {
    // WA-only komutlar için Android intent kullan
    if (entry.startAction?.type === "wa") {
      return whatsappDeeplink(botPhone) + `?text=${encodeURIComponent(entry.startAction.text)}`;
    }
    return startUrl(entry);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-2xl mx-auto p-4">
        {/* HERO */}
        <div className="bg-gradient-to-br from-emerald-700 via-teal-700 to-stone-900 text-white rounded-2xl p-6 mb-6 shadow-lg">
          <div className="text-3xl mb-1">🖥</div>
          <h1 className="text-2xl font-bold">
            Hoşgeldin{firstName ? `, ${firstName}` : ""}!
          </h1>
          {officeName && <p className="text-emerald-100 text-sm mt-1">🏢 {officeName}</p>}
          <p className="text-emerald-100 text-sm mt-3 leading-relaxed">
            Sistemini buradan yönet. Her komutun yanındaki <span className="font-mono bg-white/15 px-1.5 py-0.5 rounded">❓</span> ikonuna tıklayarak ne işe yaradığını öğren — &quot;Başlat&quot; butonuna tıklayarak hemen kullanmaya başla.
          </p>
        </div>

        {/* SECTION'lı KART GRİDİ */}
        {sections.map((sec) => (
          <section key={sec.title} className="mb-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-2 px-1">{sec.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sec.items.map((entry) => (
                <div key={entry.command} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 text-base leading-tight flex-1">
                        {entry.title}
                      </h3>
                      <button
                        onClick={() => setHelpEntry(entry)}
                        className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 transition flex items-center justify-center text-sm font-bold"
                        aria-label="Bu komut nedir?"
                      >
                        ❓
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">{entry.summary}</p>
                    <a
                      href={startUrlMobile(entry)}
                      target={entry.startAction?.type === "wa" ? undefined : "_blank"}
                      rel={entry.startAction?.type === "wa" ? undefined : "noopener noreferrer"}
                      className="block text-center bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition active:scale-95"
                    >
                      ▶ Başlat
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* WA'ya dön footer */}
        <a
          href={whatsappDeeplink(botPhone)}
          className="block w-full mt-8 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-semibold text-base shadow-lg text-center active:scale-95"
        >
          💬 WhatsApp&apos;a Dön
        </a>
        <p className="text-xs text-slate-500 text-center mt-3 px-4">
          WhatsApp&apos;tan hızlı kullanım için: komut adını yaz (örn. <span className="font-mono">mulkekle</span>).
        </p>
      </div>

      {/* (?) MODAL */}
      {helpEntry && <HelpModal entry={helpEntry} onClose={() => setHelpEntry(null)} botPhone={botPhone} token={token} />}
    </div>
  );
}

function HelpModal({ entry, onClose, botPhone, token }: { entry: YardimEntry; onClose: () => void; botPhone: string; token: string | null }) {
  function startHref(): string {
    if (!entry.startAction) return `https://wa.me/${botPhone}?text=${encodeURIComponent(entry.waCommand)}`;
    if (entry.startAction.type === "web") return `${entry.startAction.path}?t=${token || ""}`;
    return whatsappDeeplink(botPhone) + `?text=${encodeURIComponent(entry.startAction.text)}`;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="bg-gradient-to-br from-emerald-700 to-teal-900 text-white p-5 sm:rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold leading-tight">{entry.title}</h2>
              <p className="text-emerald-100 text-xs mt-1">{entry.summary}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/35 transition flex items-center justify-center text-white text-lg"
              aria-label="Kapat"
            >
              ×
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="p-5 space-y-4">
          {entry.marketing && (
            <div className="prose prose-sm prose-slate max-w-none">
              {entry.marketing.split(/\.\s+/).filter(Boolean).map((sentence, i) => (
                <p key={i} className="text-slate-700 text-sm leading-relaxed mb-2">
                  {renderInlineMarkdown(sentence.endsWith(".") ? sentence : sentence + ".")}
                </p>
              ))}
            </div>
          )}
          {entry.example && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="text-xs font-semibold text-amber-800 mb-1">💡 Örnek senaryo</div>
              <p className="text-sm text-amber-900 leading-relaxed italic">{entry.example}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            <a
              href={startHref()}
              target={entry.startAction?.type === "wa" ? undefined : "_blank"}
              rel={entry.startAction?.type === "wa" ? undefined : "noopener noreferrer"}
              className="block text-center bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-3 rounded-xl text-sm font-semibold transition active:scale-95"
            >
              ▶ Şimdi Başlat
            </a>
            <a
              href={`/tr/yardim/${entry.command}${token ? `?t=${token}` : ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl text-sm font-medium transition"
            >
              📖 Detaylı Tutorial
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Basit *bold* parsing — text içindeki *kelime* span olarak render. */
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));
    parts.push(<strong key={key++} className="font-semibold text-slate-900">{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.substring(lastIndex));
  return parts.length > 0 ? <>{parts}</> : text;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
