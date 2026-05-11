"use client";

/**
 * ThemeToggle — manuel dark mode toggle (Bug 14 dersi: prefers-color-scheme
 * honor edilmiyor; sadece kullanıcı tıklarsa dark aktif olur).
 *
 * Tema localStorage["theme"] = "dark" | "light" ile persist. Sayfa ilk
 * yüklenirken FOUC engelleyici inline script layout.tsx'te <head>'de.
 */
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("theme") : null;
    const dark = saved === "dark";
    setIsDark(dark);
    setMounted(true);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* silent */
    }
  }

  // Mount edilmeden render etme (hydration mismatch'i önler — inline
  // script <html> class'ını set ederken bu component bilmiyor)
  if (!mounted) return <div className="w-9 h-9" aria-hidden="true" />;

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Aydınlık moda geç" : "Karanlık moda geç"}
      title={isDark ? "Aydınlık" : "Karanlık"}
      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center text-base transition"
    >
      <span aria-hidden="true">{isDark ? "🌙" : "☀️"}</span>
    </button>
  );
}
