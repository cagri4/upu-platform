"use client";

/**
 * /tr/qr-giris — Desktop QR login giriş kapısı (qr.upudev.nl domain'i bu
 * sayfaya yönlenir).
 *
 * Akış:
 *   1) Mount → POST /api/panel-session/qr-create → code al
 *   2) QR data: https://upudev.nl/qr?code=<code> (panel scanner parse eder)
 *   3) Her 2 sn polluyor /api/panel-session/qr-status?code=<code>
 *   4) status='claimed' olursa → /api/panel-session/qr-finish?code=<code>
 *      (server cookie set + tenant subdomain redirect)
 *   5) status='expired' veya TTL bittiyse → "Yeni QR Kod Oluştur" buton
 *
 * Desktop'tan ilk girişte kullanılır; sonraki ziyaretlerde cookie zaten
 * .upudev.nl scope'ta olduğu için tenant subdomain'i direkt açılır.
 */

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type FlowState = "loading" | "showing" | "claimed" | "expired" | "error";

const QR_DATA_PREFIX = "https://upudev.nl/qr?code=";

export default function QrGirisPage() {
  const [state, setState] = useState<FlowState>("loading");
  const [code, setCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(60);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimers() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pollRef.current = null;
    tickRef.current = null;
  }

  async function createQr() {
    clearTimers();
    setState("loading");
    setErrorMsg("");
    setSecondsLeft(60);
    setCode(null);
    try {
      const res = await fetch("/api/panel-session/qr-create", { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d?.code) {
        setState("error");
        setErrorMsg(d?.error || "QR kod oluşturulamadı.");
        return;
      }
      setCode(d.code);
      setState("showing");
      // QR çizimi state="showing" + canvas mount edildikten sonra effect ile yapılır
    } catch {
      setState("error");
      setErrorMsg("Bağlantı hatası.");
    }
  }

  useEffect(() => {
    createQr();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canvas mount edildikten sonra QR çiz — race condition önler
  useEffect(() => {
    if (state !== "showing" || !code || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, `${QR_DATA_PREFIX}${code}`, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    }).catch((err) => {
      console.error("[qr-giris] QRCode.toCanvas error:", err);
      setState("error");
      setErrorMsg("QR kod çizilemedi.");
    });
  }, [state, code]);

  useEffect(() => {
    if (state !== "showing" || !code) return;

    // Geri sayım
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearTimers();
          setState("expired");
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    // Polling
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/panel-session/qr-status?code=${encodeURIComponent(code)}`);
        const d = await res.json();
        if (d?.status === "claimed") {
          clearTimers();
          setState("claimed");
          // Finish endpoint server-side cookie set + redirect yapar
          window.location.href = `/api/panel-session/qr-finish?code=${encodeURIComponent(code)}`;
        } else if (d?.status === "expired") {
          clearTimers();
          setState("expired");
        }
      } catch {
        // Geçici network hatası — bir sonraki tick devam et
      }
    }, 2000);

    return () => clearTimers();
  }, [state, code]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg max-w-md w-full p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🖥</div>
          <h1 className="text-2xl font-bold text-slate-900">Bilgisayardan Giriş</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Telefonunuzdaki UPU panelinden bu QR kodunu tarayın
          </p>
        </div>

        <div className="relative bg-slate-50 border-2 border-slate-200 rounded-xl p-4 flex items-center justify-center min-h-[300px]">
          {state === "loading" && (
            <div className="text-center text-slate-500 text-sm">QR oluşturuluyor…</div>
          )}

          {state === "showing" && (
            <div className="text-center">
              <canvas ref={canvasRef} className="mx-auto rounded" />
              <div className="text-xs text-slate-500 mt-3">
                Bu kod <span className="font-semibold text-slate-700">{secondsLeft}</span> saniye sonra yenilenecek
              </div>
            </div>
          )}

          {state === "claimed" && (
            <div className="text-center">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-sm font-semibold text-emerald-700">Giriş yapılıyor…</div>
            </div>
          )}

          {state === "expired" && (
            <div className="text-center">
              <div className="text-3xl mb-2">⏰</div>
              <div className="text-sm text-slate-600 mb-4">QR kodun süresi doldu.</div>
              <button
                onClick={createQr}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Yeni QR Kod Oluştur
              </button>
            </div>
          )}

          {state === "error" && (
            <div className="text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <div className="text-sm text-rose-700 mb-4">{errorMsg || "Hata oluştu."}</div>
              <button
                onClick={createQr}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Tekrar Dene
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-slate-700 leading-relaxed">
          <div className="font-semibold text-slate-900 mb-2">📱 Nasıl yapılır?</div>
          <ol className="space-y-1 list-decimal list-inside">
            <li>Telefonunuzdaki WhatsApp&apos;tan UPU panelinizi açın</li>
            <li>Sol menüden <span className="font-semibold">🖥 Bilgisayardan Aç</span> seçeneğine dokunun</li>
            <li>Kamerayı bu QR koduna doğrultun</li>
            <li>Saniyeler içinde panel açılır</li>
          </ol>
        </div>

        <div className="mt-4 text-center text-xs text-slate-400">
          QR kod tek kullanımlıktır ve 60 saniye geçerlidir
        </div>
      </div>
    </div>
  );
}
