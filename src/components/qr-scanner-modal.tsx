"use client";

/**
 * QR Scanner Modal — mobil panel "🖥 Bilgisayardan Aç" akışı.
 *
 * Kullanıcı tıklar → modal açılır → kamera erişimi ister → QR'ı tarar →
 * extract edilen code ile /api/panel-session/qr-claim çağrılır →
 * desktop tarayıcı pollu görür ve panele yönlenir.
 *
 * QR data: https://upudev.nl/qr?code=<code> (qr-giris sayfasının ürettiği)
 */

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { panelPathFromHost } from "@/lib/panel-path-from-host";

interface QrScannerModalProps {
  open: boolean;
  tenantKey: string;
  onClose: () => void;
}

type ScanState = "idle" | "scanning" | "claiming" | "success" | "error";

const QR_DATA_PREFIX = "https://upudev.nl/qr?code=";
const SCANNER_ELEMENT_ID = "qr-scanner-region";

export function QrScannerModal({ open, tenantKey, onClose }: QrScannerModalProps) {
  const [state, setState] = useState<ScanState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // C: success → 2.5s sonra otomatik kapan. Kullanıcı "Kapat" tıklamak
  // zorunda kalmadan modal kendi unmount eder, scanner cleanly destroy edilir.
  useEffect(() => {
    if (state !== "success") return;
    const t = setTimeout(() => {
      void safeClose();
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // A: "Kapat" butonu güvenli — scanner explicit stop sonra onClose, son
  // olarak underlying /tr/panel sayfasına navigate. Bu sıralama "This page
  // couldn't load" Chrome hatasını engelliyor (async cleanup race fix).
  async function safeClose() {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        await scanner.stop();
        await scanner.clear();
      } catch {
        /* ignore — zaten kapalı */
      }
      scannerRef.current = null;
    }
    onClose();
    if (typeof window !== "undefined") {
      // Tenant-aware panel: host'tan tespit et (retailai → bayi, marketai →
      // market, vb.). Tüm SaaS'larda QR scanner kapanınca doğru panele döner.
      // Zaten doğru panel'deyse no-op (URL aynı, sayfa yeniden yüklenmez).
      const target = panelPathFromHost();
      const path = window.location.pathname;
      if (!path.endsWith(target) && !path.endsWith(target + "/")) {
        window.location.href = target;
      }
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function startScanner() {
      try {
        setState("scanning");
        setErrorMsg("");
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 8,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1,
          },
          async (decodedText) => {
            // Önce duruşa geç
            try { await scanner.stop(); } catch { /* ignore */ }
            if (cancelled) return;

            const code = extractCode(decodedText);
            if (!code) {
              setState("error");
              setErrorMsg("Bu QR kodu UPU'ya ait değil. Lütfen 'qr.upudev.nl' sayfasındaki QR'ı kullanın.");
              return;
            }
            await claimCode(code);
          },
          () => {
            // scan failure callback — her frame için tetiklenir, görmezden gel
          },
        );
      } catch (err) {
        console.error("[qr-scanner] start error:", err);
        setState("error");
        setErrorMsg("Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin.");
      }
    }

    async function claimCode(code: string) {
      try {
        setState("claiming");
        const res = await fetch("/api/panel-session/qr-claim", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, tenant: tenantKey }),
        });
        const d = await res.json();
        if (!res.ok || !d?.success) {
          setState("error");
          setErrorMsg(d?.error || "QR kod kabul edilmedi.");
          return;
        }
        setState("success");
      } catch {
        setState("error");
        setErrorMsg("Bağlantı hatası.");
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => { /* ignore */ });
        scannerRef.current = null;
      }
    };
  }, [open, tenantKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">🖥 Bilgisayardan Aç</h2>
          <button
            onClick={() => void safeClose()}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          Bilgisayarınızda <span className="font-semibold text-slate-900 dark:text-slate-100">qr.upudev.nl</span> adresini açın ve oradaki QR kodu kameraya doğrultun.
        </p>

        <div className="bg-slate-900 rounded-xl overflow-hidden aspect-square relative">
          <div id={SCANNER_ELEMENT_ID} className="w-full h-full" />
          {state === "claiming" && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm">
              ⏳ Bağlanıyor…
            </div>
          )}
          {state === "success" && (
            <div className="absolute inset-0 bg-emerald-600/90 flex flex-col items-center justify-center text-white">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-sm font-semibold">Bilgisayarınızda panel açıldı.</div>
              <div className="text-xs opacity-80 mt-1">Bu pencereyi kapatabilirsiniz.</div>
            </div>
          )}
          {state === "error" && (
            <div className="absolute inset-0 bg-rose-700/90 flex flex-col items-center justify-center text-white p-4 text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <div className="text-sm">{errorMsg}</div>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          {(state === "error") && (
            <button
              onClick={() => { setState("idle"); setErrorMsg(""); window.location.reload(); }}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg text-sm font-medium"
            >
              Tekrar Dene
            </button>
          )}
          <button
            onClick={() => void safeClose()}
            className={`${state === "error" ? "flex-1" : "w-full"} bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-900 dark:text-slate-100 py-2.5 rounded-lg text-sm font-medium`}
          >
            {state === "success" ? "Kapat" : "Vazgeç"}
          </button>
        </div>
      </div>
    </div>
  );
}

function extractCode(scanned: string): string | null {
  if (!scanned) return null;
  const trimmed = scanned.trim();
  if (trimmed.startsWith(QR_DATA_PREFIX)) {
    try {
      const url = new URL(trimmed);
      return url.searchParams.get("code");
    } catch {
      return null;
    }
  }
  // Geri uyum: bazı tarayıcılar URL'i decode etmemiş olabilir
  if (/^[A-Za-z0-9_-]{16,64}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}
