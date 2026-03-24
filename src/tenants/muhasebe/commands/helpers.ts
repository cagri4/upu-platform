/**
 * Muhasebe command helpers — shared formatting + web panel redirect
 */

import { sendText } from "@/platform/whatsapp/send";

const WEB_PANEL = "https://upu-platform.vercel.app/muhasebe";

export function today(): string {
  return new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
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

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function monthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function currentMonth(): string {
  return new Date().toLocaleString("tr-TR", { month: "long", year: "numeric" });
}

export function webPanelRedirect(phone: string, action: string): Promise<void> {
  return sendText(phone, `Bu islemi web panelinden yapabilirsiniz:\n\n${action}\n\n${WEB_PANEL}`);
}
