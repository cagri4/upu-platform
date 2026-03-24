/**
 * Bayi command helpers — shared formatting + web panel redirect
 */

import { sendText } from "@/platform/whatsapp/send";

const WEB_PANEL = "https://upu-platform.vercel.app/bayi";

export function today(): string {
  return new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatCurrency(amount: number): string {
  return `₺${amount.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function webPanelRedirect(phone: string, action: string): Promise<void> {
  return sendText(phone, `Bu islemi web panelinden yapabilirsiniz:\n\n${action}\n\n${WEB_PANEL}`);
}
