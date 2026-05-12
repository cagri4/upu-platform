"use client";

import { useState, useEffect } from "react";
import { Pencil, Trash2, Loader2, AlertTriangle, Check } from "lucide-react";

interface Props {
  presToken: string;
  slideKey: string;
  initialText?: string | null;
  editable?: boolean;
}

/**
 * Slayt başına yüzen kontrol kutusu — sağ üst.
 * - Metin slaytları için: ✏️ Düzenle (modal açar) + 🗑️ Sayfayı sil
 * - Sadece foto slaytı için: 🗑️ Sayfayı sil
 *
 * Düzenle: textarea + "Tamam" butonu. Save → /api/sunum/update-slide
 * Sil: confirm + DELETE → /api/sunum/delete-slide
 */
export function SlideControls({ presToken, slideKey, initialText, editable }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initialText || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setText(initialText || "");
  }, [initialText]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/sunum/update-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: presToken, slide_key: slideKey, text }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Kaydedilemedi.");
      } else {
        setEditing(false);
        // Sayfayı yenile ki güncel içerik render olsun
        window.location.reload();
      }
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!confirm("Bu slaytı silmek istediğinize emin misiniz?")) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/sunum/delete-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: presToken, slide_key: slideKey }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Silinemedi.");
        setDeleting(false);
      } else {
        window.location.reload();
      }
    } catch {
      setError("Bağlantı hatası.");
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Sağ üst köşedeki banking-style kontrol kutusu */}
      <div className="absolute top-3 right-3 z-10 flex gap-1.5 print:hidden">
        {editable && (
          <button
            onClick={() => setEditing(true)}
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-md rounded-full w-9 h-9 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 active:scale-95 border border-slate-200 dark:border-slate-800 transition"
            title="Düzenle"
            aria-label="Düzenle"
          >
            <Pencil className="w-4 h-4" strokeWidth={2.2} />
          </button>
        )}
        <button
          onClick={() => void del()}
          disabled={deleting}
          className="bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-md rounded-full w-9 h-9 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95 border border-slate-200 dark:border-slate-800 disabled:opacity-50 transition"
          title="Sayfayı sil"
          aria-label="Sayfayı sil"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" strokeWidth={2.2} />}
        </button>
      </div>

      {/* Modal düzenleyici — banking style */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setEditing(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
              Slaytı Düzenle
            </h3>
            <textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition resize-none"
              placeholder="Slayt metnini yazın..."
            />
            {error && (
              <div className="mt-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-3 py-2 rounded-xl text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 transition"
              >
                İptal
              </button>
              <button
                onClick={() => void save()}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition shadow-sm"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor</>
                ) : (
                  <><Check className="w-4 h-4" strokeWidth={2.5} /> Tamam</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
