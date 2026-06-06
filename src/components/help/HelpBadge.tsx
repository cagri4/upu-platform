"use client";

/**
 * HelpBadge — ilk girişte HelpCenter butonunun yanında pulsing
 * "Yeni misin?" çubuğu. localStorage flag set olunca kaybolur.
 *
 * Storage key: `helpCenter:<saasKey>:seen`. Çağıran tıklayınca onDismiss
 * tetiklenir; bu komponentin state'i localStorage'a yazar.
 */

import { useEffect, useState } from "react";

interface Props {
  saasKey: string;
  label?: string;
  onDismiss?: () => void;
}

export function HelpBadge({ saasKey, label = "Yeni misin? Buraya bas →", onDismiss }: Props) {
  const storageKey = `helpCenter:${saasKey}:seen`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(storageKey);
      if (!seen) setVisible(true);
    } catch {
      // localStorage erişimi engellenmişse badge'i göstermeyelim
    }
  }, [storageKey]);

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // sessizce ignore
    }
    setVisible(false);
    onDismiss?.();
  }

  if (!visible) return null;

  return (
    <button
      onClick={dismiss}
      className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-full shadow-lg animate-pulse hover:animate-none hover:bg-indigo-600 transition"
      aria-label="Kullanım kılavuzunu aç ipucu"
    >
      {label}
    </button>
  );
}
