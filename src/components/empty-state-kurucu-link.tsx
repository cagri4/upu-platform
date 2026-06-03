"use client";

/**
 * Bayi panelinde empty state'lerin ikincil aksiyonu — Kurucu AI elemanına
 * çağrı atar. Window event üzerinden çalışır:
 *   window.dispatchEvent(new CustomEvent('upu:open-agent',
 *     { detail: { role: 'kurucu', context: 'empty-state:<page>' } }))
 *
 * Sebep: empty list'ten kullanıcı çıkıp manuel bir şey yapmak yerine
 * Kurucu sürecini devralıyor (AI Eleman tanımı: süreç DEVRALAN).
 *
 * Context string sidebar yardım modal'ından da gönderilebilir; UpuAgentWidget
 * listener'ı detail.context'i okuyup agent chat request body'sine ekler;
 * route.ts Kurucu prompt'unun sonuna "HALİHAZIR DURUM: …" satırı koyar.
 */

interface KurucuHelpLinkProps {
  /** Çağrı bağlamı — agent'a iletilir. Örn: "empty-state:bayiler". */
  context: string;
  /** Görünür yazı. Default: "Kurucu'dan yardım iste". */
  label?: string;
  /** Stil için ekstra class. */
  className?: string;
}

export function KurucuHelpLink({
  context,
  label = "Kurucu'dan yardım iste",
  className = "",
}: KurucuHelpLinkProps) {
  function open() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("upu:open-agent", {
        detail: { role: "kurucu", context },
      }),
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      className={
        className ||
        "mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline-offset-2 hover:underline"
      }
    >
      💬 {label}
    </button>
  );
}

/**
 * EmptyState `secondary` prop için kısayol — onClick dispatch eder.
 * Çağrı: <EmptyState secondary={kurucuSecondary("empty-state:bayiler")} ... />
 */
export function kurucuSecondary(context: string, label = "Kurucu'dan yardım iste") {
  return {
    label: `💬 ${label}`,
    onClick: () => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent("upu:open-agent", {
          detail: { role: "kurucu", context },
        }),
      );
    },
  };
}
