/**
 * Restoran command helpers — shared formatting + status icons
 */

export function formatCurrency(amount: number): string {
  return `₺${amount.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function shortTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const ORDER_STATUS_ICON: Record<string, string> = {
  new: "🆕",
  preparing: "🔄",
  ready: "🟢",
  served: "✅",
  paid: "💰",
  cancelled: "❌",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  new: "Yeni",
  preparing: "Hazırlanıyor",
  ready: "Hazır",
  served: "Servis Edildi",
  paid: "Ödendi",
  cancelled: "İptal",
};

export const TABLE_STATUS_ICON: Record<string, string> = {
  free: "🟢",
  occupied: "🔴",
  reserved: "🟡",
  cleaning: "🧹",
};

export const TABLE_STATUS_LABEL: Record<string, string> = {
  free: "Boş",
  occupied: "Dolu",
  reserved: "Rezerve",
  cleaning: "Temizleniyor",
};

export const RESERVATION_STATUS_ICON: Record<string, string> = {
  pending: "⏳",
  confirmed: "✅",
  seated: "🟢",
  completed: "🏁",
  cancelled: "❌",
  no_show: "🚫",
};
