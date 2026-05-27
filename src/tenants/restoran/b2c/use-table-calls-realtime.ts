"use client";

/**
 * Panel için Supabase Realtime — rst_table_calls pending çağrıları izle.
 *
 * Kullanım (panel masalar sayfasında):
 *   const { pendingCalls, refresh } = useTableCallsRealtime(restaurantId);
 *
 * pendingCalls: Map<tableId, callInfo>
 *   - INSERT → pending olarak Map'e eklenir, ses çal + notification
 *   - UPDATE status=acknowledged|resolved → Map'ten silinir
 *
 * fetchOnMount: ilk yüklemede pending olanları DB'den getir
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export interface PendingTableCall {
  id: string;
  table_id: string;
  reason: "call" | "bill_request" | "complaint" | "other";
  notes: string | null;
  called_at: string;
}

export function useTableCallsRealtime(restaurantId: string | null, token: string) {
  const [pendingByTable, setPendingByTable] = useState<Record<string, PendingTableCall>>({});
  const [newCall, setNewCall] = useState<PendingTableCall | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Ses preload
  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio("/sounds/new-order.mp3");
    audio.preload = "auto";
    audio.volume = 0.7;
    audioRef.current = audio;
  }, []);

  const fetchPending = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/restoran-panel/table-calls?t=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) return;
      const map: Record<string, PendingTableCall> = {};
      for (const c of (json.calls || []) as PendingTableCall[]) {
        map[c.table_id] = c;
      }
      setPendingByTable(map);
    } catch {
      /* sessiz */
    }
  }, [token]);

  // Initial fetch
  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // Realtime subscribe
  useEffect(() => {
    if (!restaurantId) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const sb = createBrowserClient(url, key);
    const channel = sb
      .channel(`table-calls-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rst_table_calls",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.status !== "pending") return;
          const call: PendingTableCall = {
            id: String(row.id),
            table_id: String(row.table_id),
            reason: row.reason as PendingTableCall["reason"],
            notes: (row.notes as string) || null,
            called_at: String(row.called_at),
          };
          setPendingByTable((prev) => ({ ...prev, [call.table_id]: call }));
          setNewCall(call);
          playSound();
          showNotification(call);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rst_table_calls",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.status === "acknowledged" || row.status === "resolved") {
            const tableId = String(row.table_id);
            setPendingByTable((prev) => {
              const next = { ...prev };
              delete next[tableId];
              return next;
            });
          }
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [restaurantId]);

  function playSound() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => { /* autoplay policy */ });
  }

  function showNotification(call: PendingTableCall) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      const reasonLabel =
        call.reason === "bill_request"
          ? "Hesap istendi"
          : call.reason === "complaint"
            ? "Şikayet"
            : "Garson çağrısı";
      new Notification(`🛎 ${reasonLabel}`, {
        body: call.notes || "Masaya gidin",
        icon: "/icons/icon-192x192.png",
        tag: `table-call-${call.id}`,
      });
    } catch {
      /* sessiz */
    }
  }

  async function ack(callId: string, resolved = false) {
    try {
      await fetch(`/api/restoran-panel/table-calls/${callId}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, resolved }),
      });
      // Realtime UPDATE event de güncelleyecek ama optimistic update için:
      setPendingByTable((prev) => {
        const next: Record<string, PendingTableCall> = {};
        for (const [tid, c] of Object.entries(prev)) {
          if (c.id !== callId) next[tid] = c;
        }
        return next;
      });
    } catch {
      /* sessiz */
    }
  }

  return {
    pendingByTable,
    newCall,
    dismissNew: () => setNewCall(null),
    ack,
    refresh: fetchPending,
  };
}
