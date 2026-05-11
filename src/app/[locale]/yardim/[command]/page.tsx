"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { getYardimEntry } from "@/lib/yardim-content";
import { ReturnButtons } from "@/components/return-buttons";

const BOT_WA_NUMBER = "31644967207";

export default function YardimCommandPage({ params }: { params: Promise<{ command: string }> }) {
  const { command } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const entry = getYardimEntry(command);

  if (!entry) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow">
          <div className="text-4xl mb-3">🔍</div>
          <h1 className="text-xl font-bold mb-2">Bu komut için yardım yok</h1>
          <p className="text-slate-600 text-sm mb-4">
            <span className="font-mono">{command}</span> için tutorial bulunamadı.
          </p>
          <a href={`/tr/yardim${token ? `?t=${token}` : ""}`} className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg">
            ← Tüm yardım sayfaları
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <a href={`/tr/yardim${token ? `?t=${token}` : ""}`} className="text-emerald-700 text-sm font-medium mb-2 inline-block">
          ← Yardım Merkezi
        </a>

        <div className="bg-gradient-to-br from-emerald-700 to-teal-900 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">{entry.title.split(" ")[0]}</div>
          <h1 className="text-xl font-bold">{entry.title}</h1>
          <p className="text-emerald-200 text-sm mt-1">{entry.summary}</p>
          <div className="mt-3 inline-block bg-white/15 px-3 py-1 rounded-full text-xs">
            WhatsApp: <span className="font-mono font-semibold">{entry.waCommand}</span>
          </div>
        </div>

        <Section title="📌 Ne işe yarar?">
          <p className="text-slate-700 text-sm leading-relaxed">{entry.what}</p>
        </Section>

        <Section title="🚀 Nasıl kullanılır?">
          <ol className="space-y-2 text-slate-700 text-sm">
            {entry.how.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-bold text-emerald-700 flex-shrink-0">{i + 1}.</span>
                <span>{step.replace(/^\d+\.\s*/, "")}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="💡 Örnek senaryo">
          <p className="text-slate-700 text-sm leading-relaxed italic">{entry.example}</p>
        </Section>

        {entry.faq.length > 0 && (
          <Section title="❓ Sık sorulanlar">
            <div className="space-y-3">
              {entry.faq.map((f, i) => (
                <div key={i}>
                  <div className="font-semibold text-slate-900 text-sm">{f.q}</div>
                  <div className="text-slate-600 text-sm mt-0.5">{f.a}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <ReturnButtons token={token} botPhone={BOT_WA_NUMBER} />
        <p className="text-xs text-slate-500 text-center mt-3 px-4">
          WhatsApp&apos;a dönerek <span className="font-mono">{entry.waCommand}</span> yazabilir veya panelden Başlat butonunu kullanabilirsiniz.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm mb-3">
      <h2 className="font-semibold text-slate-900 text-sm mb-2">{title}</h2>
      {children}
    </section>
  );
}
