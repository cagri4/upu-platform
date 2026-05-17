#!/usr/bin/env node
/**
 * Sahibinden Cookie Receiver — local HTTP endpoint.
 *
 * Chrome extension (tools/sahibinden-cookie-bridge) her 5 dakikada bir
 * POST /cookies eder; bu server payload'i scripts/cookies.json'a yazar
 * (scrape-v3.mjs okuyacağı schema).
 *
 * Önceki cookies.json otomatik scripts/cookies.json.backup'a kopyalanır
 * (1 versiyon rolling backup).
 *
 * Çalıştırma:
 *   node tools/cookie-receiver.mjs
 *
 * Veya systemd user service (cookie-receiver.service):
 *   systemctl --user enable cookie-receiver.service
 *   systemctl --user start cookie-receiver.service
 */

import http from "http";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIES_PATH = path.join(__dirname, "../scripts/cookies.json");
const BACKUP_PATH = path.join(__dirname, "../scripts/cookies.json.backup");
const PORT = 3001;

const server = http.createServer(async (req, res) => {
  // CORS preflight — Chrome extension fetch host_permissions ile origin
  // gönderir; preflight'i kabul et.
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/cookies") {
    res.writeHead(404);
    res.end("not found");
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const payload = JSON.parse(body);
      const cookies = payload?.cookies;
      if (!Array.isArray(cookies) || cookies.length === 0) {
        res.writeHead(400, { "Access-Control-Allow-Origin": "*" });
        res.end("empty cookies");
        return;
      }

      // Backup current (best-effort; ilk run'da source yok, sessiz geç)
      try {
        await fs.copyFile(COOKIES_PATH, BACKUP_PATH);
      } catch {
        /* ilk run veya backup yazılamadı — kritik değil */
      }

      await fs.writeFile(
        COOKIES_PATH,
        JSON.stringify(cookies, null, 2),
        "utf-8",
      );

      const ts = new Date().toLocaleTimeString("tr-TR");
      console.log(`[Receiver] ${cookies.length} cookies saved → scripts/cookies.json at ${ts}`);
      res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
      res.end("ok");
    } catch (err) {
      console.error("[Receiver] Error:", err);
      res.writeHead(500, { "Access-Control-Allow-Origin": "*" });
      res.end("error");
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[Receiver] Listening on http://127.0.0.1:${PORT}/cookies`);
  console.log(`[Receiver] Writes to: ${COOKIES_PATH}`);
});
