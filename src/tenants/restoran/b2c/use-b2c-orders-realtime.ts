"use client";

/**
 * Panel için Supabase Realtime — yeni B2C sipariş gelince notification.
 *
 * Kullanım (panel sayfasında):
 *   const { newOrder, dismissNew } = useB2cOrdersRealtime(restaurantId);
 *
 * Yeni sipariş INSERT event'iyle gelir → state'e set, ses çalar, banner gösterilir.
 * Status UPDATE event'leri de dinlenir (panel'deki sipariş listesi auto-refresh için).
 *
 * Ses: /sounds/new-order.mp3 (yoksa beep fallback)
 * Permission: window.Notification API (browser native, user grant şart)
 */
import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export interface B2cOrderEvent {
  id: string;
  order_number: string;
  customer_name: string;
  delivery_type: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  source: string;
}

export function useB2cOrdersRealtime(restaurantId: string | null) {
  const [newOrder, setNewOrder] = useState<B2cOrderEvent | null>(null);
  const [updateCounter, setUpdateCounter] = useState(0);  // panel listesi tetikleme için
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Ses preload
  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio("/sounds/new-order.mp3");
    audio.preload = "auto";
    audio.volume = 0.6;
    audioRef.current = audio;
  }, []);

  // Notification permission iste (sessizce, ilk subscribe'da)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => { /* yut */ });
    }
  }, []);

  // Realtime subscribe
  useEffect(() => {
    if (!restaurantId) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const sb = createBrowserClient(url, key);
    const channel = sb
      .channel(`b2c-orders-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rst_b2c_orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          // pending_payment ise gözükmesin; received olunca push gelir
          const status = String(row.status || "");
          if (status === "pending_payment") return;

          const evt: B2cOrderEvent = {
            id: String(row.id),
            order_number: String(row.order_number),
            customer_name: String(row.customer_name),
            delivery_type: String(row.delivery_type),
            total: Number(row.total) || 0,
            status,
            payment_status: String(row.payment_status || ""),
            created_at: String(row.created_at),
            source: String(row.source || "web"),
          };
          setNewOrder(evt);
          playSound();
          showNativeNotification(evt);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rst_b2c_orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const before = payload.old as Record<string, unknown>;
          const after = payload.new as Record<string, unknown>;
          // pending_payment → received geçişi de yeni sipariş bildirimi gibi
          if (before.status === "pending_payment" && after.status === "received") {
            const evt: B2cOrderEvent = {
              id: String(after.id),
              order_number: String(after.order_number),
              customer_name: String(after.customer_name),
              delivery_type: String(after.delivery_type),
              total: Number(after.total) || 0,
              status: "received",
              payment_status: String(after.payment_status || ""),
              created_at: String(after.created_at),
              source: String(after.source || "web"),
            };
            setNewOrder(evt);
            playSound();
            showNativeNotification(evt);
          }
          setUpdateCounter((c) => c + 1);
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
    audio.play().catch(() => {
      // Autoplay policy: kullanıcı sayfayla etkileşmediyse ses çalmaz. Sessiz.
    });
  }

  function showNativeNotification(evt: B2cOrderEvent) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification("🍽 Yeni sipariş!", {
        body: `${evt.customer_name} · €${evt.total.toFixed(2)} · ${evt.delivery_type === "delivery" ? "Eve teslimat" : evt.delivery_type === "pickup" ? "Gel-al" : "Masa"}`,
        icon: "/icons/icon-192x192.png",
        tag: `b2c-order-${evt.id}`,
      });
    } catch {
      /* iOS Safari vs eski browser sessiz */
    }
  }

  function dismissNew() {
    setNewOrder(null);
  }

  return { newOrder, updateCounter, dismissNew };
}
