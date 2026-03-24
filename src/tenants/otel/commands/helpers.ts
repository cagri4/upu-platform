/**
 * Otel command helpers — shared formatting, hotel lookup, role prefixes
 */

import { getServiceClient } from "@/platform/auth/supabase";

// ── Role prefixes (team identity per domain) ──────────────────────────────

export type OtelDomain = "genel" | "rezervasyon" | "misafir" | "oda" | "bilgi" | "deneyim";

const ROLE_PREFIX: Record<OtelDomain, string> = {
  rezervasyon: "Rezervasyon",
  oda: "Kat Hizmetleri",
  misafir: "Resepsiyon",
  bilgi: "Bilgi Tabani",
  deneyim: "Misafir Deneyimi",
  genel: "OtelAI",
};

export function prefix(domain: OtelDomain, text: string): string {
  return `*${ROLE_PREFIX[domain]}*\n${text}`;
}

// ── Date helpers ──────────────────────────────────────────────────────────

export function today(): string {
  return new Date().toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function tomorrowISO(): string {
  return new Date(Date.now() + 86400000).toISOString().split("T")[0];
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit",
  });
}

export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} TL`;
}

// ── Hotel lookup ──────────────────────────────────────────────────────────

/**
 * Resolve the hotel_id for a user within the otel tenant.
 * Returns the first hotel the user is linked to, or null.
 */
export async function getHotelId(userId: string, tenantId: string): Promise<string | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  return data?.hotel_id ?? null;
}

/**
 * Get hotel details by hotel_id.
 */
export async function getHotel(hotelId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("otel_hotels")
    .select("*")
    .eq("id", hotelId)
    .maybeSingle();
  return data;
}

// ── Safe count helper ─────────────────────────────────────────────────────

export async function safeCount(
  table: string,
  filters: Record<string, unknown>,
): Promise<number> {
  try {
    const supabase = getServiceClient();
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    for (const [key, value] of Object.entries(filters)) {
      if (key.startsWith("_gte_")) {
        query = query.gte(key.slice(5), value);
      } else if (key.startsWith("_lt_")) {
        query = query.lt(key.slice(4), value);
      } else if (key.startsWith("_in_")) {
        query = query.in(key.slice(4), value as string[]);
      } else {
        query = query.eq(key, value);
      }
    }
    const { count } = await query;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ── No hotel message ──────────────────────────────────────────────────────

export const NO_HOTEL_MSG = "Henuz bir otel hesabiniz bagli degil. Lutfen yoneticinize basvurun.";
