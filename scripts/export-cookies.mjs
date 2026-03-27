#!/usr/bin/env node
/**
 * Chrome Cookie Exporter for Sahibinden
 *
 * Reads Chrome's cookie database, decrypts cookies, and saves to cookies.json.
 * No extension needed — runs directly from terminal.
 *
 * Usage: node scripts/export-cookies.mjs
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Find Chrome profile with sahibinden cookies
const chromeBase = path.join(process.env.HOME, '.config/google-chrome');
const profiles = ['Default', 'Profile 1', 'Profile 2', 'Profile 3', 'Profile 4'];

async function main() {
  // Get Chrome encryption key from GNOME keyring
  let chromeSecret;
  try {
    chromeSecret = execSync(
      `python3 -c "import secretstorage; conn = secretstorage.dbus_init(); coll = secretstorage.get_default_collection(conn); items = list(coll.get_all_items()); keys = [i for i in items if i.get_label() == 'Chrome Safe Storage']; print(keys[0].get_secret().decode() if keys else '')"`,
      { encoding: 'utf-8' }
    ).trim();
  } catch {
    chromeSecret = 'peanuts'; // Linux fallback
  }

  if (!chromeSecret) {
    console.error('❌ Chrome encryption key bulunamadı');
    process.exit(1);
  }

  // Chrome Linux: PBKDF2(password, 'saltysalt', iterations=1, keyLen=16, sha1)
  const keyCBC = crypto.pbkdf2Sync(chromeSecret, 'saltysalt', 1, 16, 'sha1');

  const SQL = await initSqlJs();

  // Find which profile has sahibinden cookies
  let bestProfile = null;
  let bestCount = 0;

  for (const profile of profiles) {
    const cookiePath = path.join(chromeBase, profile, 'Cookies');
    if (!fs.existsSync(cookiePath)) continue;

    const buf = fs.readFileSync(cookiePath);
    const db = new SQL.Database(buf);
    const result = db.exec("SELECT COUNT(*) FROM cookies WHERE host_key LIKE '%sahibinden%'");
    const count = result[0]?.values[0]?.[0] || 0;
    db.close();

    if (count > bestCount) {
      bestCount = count;
      bestProfile = profile;
    }
  }

  if (!bestProfile) {
    console.error('❌ Sahibinden cookie bulunamadı — Chrome\'da sahibinden.com\'a giriş yap');
    process.exit(1);
  }

  console.log(`📂 Profil: ${bestProfile} (${bestCount} cookie)`);

  // Read and decrypt cookies
  const cookiePath = path.join(chromeBase, bestProfile, 'Cookies');
  const buf = fs.readFileSync(cookiePath);
  const db = new SQL.Database(buf);

  const rows = db.exec(
    "SELECT name, host_key, path, encrypted_value, expires_utc, is_secure, is_httponly FROM cookies WHERE host_key LIKE '%sahibinden%'"
  );

  const cookies = [];
  for (const row of rows[0].values) {
    const [name, host_key, cookiePath, encrypted_value, expires_utc, is_secure, is_httponly] = row;
    const enc = Buffer.from(encrypted_value);

    let value = '';
    const prefix = enc.slice(0, 3).toString();
    if (prefix === 'v11' || prefix === 'v10') {
      // Linux Chrome: AES-128-CBC
      // v10 = "peanuts" password, v11 = GNOME keyring password
      // IV = 16 space chars (0x20) — NOT null bytes!
      const iv = Buffer.alloc(16, 0x20); // ' ' (space)
      try {
        const decipher = crypto.createDecipheriv('aes-128-cbc', keyCBC, iv);
        decipher.setAutoPadding(true);
        const decrypted = Buffer.concat([decipher.update(enc.slice(3)), decipher.final()]);
        // Chrome adds a 32-byte constant header to decrypted values — skip it
        value = decrypted.slice(32).toString('utf-8');
      } catch {
        continue;
      }
    }

    if (value) {
      cookies.push({
        name,
        value,
        domain: host_key,
        path: cookiePath,
        secure: Boolean(is_secure),
        httpOnly: Boolean(is_httponly),
      });
    }
  }

  db.close();

  if (cookies.length === 0) {
    console.error('❌ Cookie decrypt edilemedi');
    process.exit(1);
  }

  const outPath = path.join(__dirname, 'cookies.json');
  fs.writeFileSync(outPath, JSON.stringify(cookies, null, 2));
  console.log(`✅ ${cookies.length} cookie kaydedildi → scripts/cookies.json`);
}

main().catch(e => {
  console.error('Hata:', e.message);
  process.exit(1);
});
