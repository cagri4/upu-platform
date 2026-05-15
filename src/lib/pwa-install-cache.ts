"use client";

/**
 * PWA install prompt — module-level cache + subscribe pattern.
 *
 * Chrome `beforeinstallprompt` event'i bir kez fire olur ve listener
 * kurulduktan sonra dispatch edilmez. Bayi panel gibi layout'larda
 * auth-gate sırasında `PwaInstallCard` geç mount olduğu için event
 * kaybediliyordu. Defence-in-depth: RootLayout'ta `<PwaInstallCapturer />`
 * en erken mount'ta yakalar, burada cache'ler. Card mount olduğunda hem
 * cache'i okur hem de sonradan gelecek event'lere `subscribe` olur.
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let cachedPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

export function setCachedPrompt(e: BeforeInstallPromptEvent | null) {
  cachedPrompt = e;
  listeners.forEach((fn) => fn(e));
}

export function getCachedPrompt(): BeforeInstallPromptEvent | null {
  return cachedPrompt;
}

export function subscribeCachedPrompt(
  fn: (e: BeforeInstallPromptEvent | null) => void,
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
