/**
 * Saha ziyaret — IndexedDB offline kuyruğu (Faz 6).
 *
 * ÖNEMLİ: PWA/service-worker DEĞİL (bayi CLAUDE.md "PWA YOK"). Sadece veri
 * dayanıklılığı: saha elemanı çevrimdışıyken yaptığı check-in lokal
 * IndexedDB'ye yazılır; online olunca server'a senkronlanır. client_uuid ile
 * idempotent (server (tenant_id, client_uuid) UNIQUE) — iki kez gitse tek
 * ziyaret olur.
 *
 * Store: tek objectStore "checkins", key = clientUuid.
 */

const DB_NAME = "upu_saha";
const STORE = "checkins";
const DB_VERSION = 1;

export interface CheckInDraft {
  clientUuid: string;
  dealerId: string;
  dealerName: string;
  planId: string | null;
  note: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  synced: boolean;
  serverId: string | null;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB yok"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clientUuid" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Çevrimdışı check-in'i kuyruğa al (synced=false). */
export async function queueCheckIn(
  draft: Omit<CheckInDraft, "synced" | "serverId" | "updatedAt">,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      ...draft,
      synced: false,
      serverId: null,
      updatedAt: Date.now(),
    } as CheckInDraft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Tüm taslakları oku. */
export async function listCheckIns(): Promise<CheckInDraft[]> {
  const db = await openDb();
  const res = await new Promise<CheckInDraft[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as CheckInDraft[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return res;
}

/** Senkronlanmamış check-in'leri döner. */
export async function listPendingCheckIns(): Promise<CheckInDraft[]> {
  return (await listCheckIns()).filter((d) => !d.synced);
}

/**
 * Senkronlanmış taslağı cihazdan SİL — server tek doğruluk kaynağı.
 * (Paylaşılan saha cihazında artık veri bırakma.)
 */
export async function clearSyncedCheckIn(clientUuid: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(clientUuid);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
