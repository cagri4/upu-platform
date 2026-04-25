"use client";

import { useState, useEffect } from "react";

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
      {/* Sağ üst köşedeki ufak kontrol kutusu */}
      <div className="absolute top-3 right-3 z-10 flex gap-1.5 print:hidden">
        {editable && (
          <button
            onClick={() => setEditing(true)}
            className="bg-white/95 hover:bg-white shadow-md rounded-full w-9 h-9 flex items-center justify-center text-slate-700 hover:text-indigo-600 active:scale-95 border border-slate-200"
            title="Düzenle"
            aria-label="Düzenle"
          >
            ✏️
          </button>
        )}
        <button
          onClick={() => void del()}
          disabled={deleting}
          className="bg-white/95 hover:bg-white shadow-md rounded-full w-9 h-9 flex items-center justify-center text-slate-700 hover:text-red-600 active:scale-95 border border-slate-200 disabled:opacity-50"
          title="Sayfayı sil"
          aria-label="Sayfayı sil"
        >
          {deleting ? "⏳" : "🗑️"}
        </button>
      </div>

      {/* Modal düzenleyici */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setEditing(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900 mb-3">Slaytı Düzenle</h3>
            <textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-3 text-sm text-slate-900"
              placeholder="Slayt metnini yazın..."
            />
            {error && (
              <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">⚠️ {error}</div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium disabled:opacity-50"
              >
                İptal
              </button>
              <button
                onClick={() => void save()}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "✅ Tamam"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
