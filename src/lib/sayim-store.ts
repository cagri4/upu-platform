/**
 * Mobil sayım — IndexedDB taslak kuyruğu (Faz 5).
 *
 * ÖNEMLİ: Bu bir PWA/offline-cache/service-worker DEĞİL (bayi CLAUDE.md:
 * "PWA YOK"). Sadece veri dayanıklılığı: sayılan adetler lokal IndexedDB'ye
 * yazılır ki sekme kapanırsa / ağ koparsa kaybolmasın; online olunca server'a
 * senkronlanır. Service worker, manifest, install banner, app-shell cache YOK.
 *
 * Store: tek objectStore "counts", key = `${sessionId}:${productId}`.
 */

const DB_NAME = "upu_sayim";
const STORE = "counts";
const DB_VERSION = 1;

export interface CountDraft {
  key: string;        // sessionId:productId
  sessionId: string;
  productId: string;
  countedQty: number;
  synced: boolean;
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
        const os = db.createObjectStore(STORE, { keyPath: "key" });
        os.createIndex("session", "sessionId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Bir ürün sayımını taslak olarak kaydet (synced=false). */
export async function saveDraft(
  sessionId: string,
  productId: string,
  countedQty: number,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      key: `${sessionId}:${productId}`,
      sessionId,
      productId,
      countedQty,
      synced: false,
      updatedAt: Date.now(),
    } as CountDraft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Bir oturumun tüm taslaklarını oku. */
export async function listDrafts(sessionId: string): Promise<CountDraft[]> {
  const db = await openDb();
  const res = await new Promise<CountDraft[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const idx = tx.objectStore(STORE).index("session");
    const out: CountDraft[] = [];
    const cursorReq = idx.openCursor(IDBKeyRange.only(sessionId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        out.push(cursor.value as CountDraft);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  db.close();
  return res;
}

/** Senkronlanmamış taslakları döner. */
export async function listUnsynced(sessionId: string): Promise<CountDraft[]> {
  return (await listDrafts(sessionId)).filter((d) => !d.synced);
}

/**
 * H-18: senkronlanmış taslakları cihazdan SİL (synced=true işaretlemek yerine).
 * Sayılan adetler IndexedDB'de düz duruyor; sunucuya gittikten sonra cihazda
 * kalmasına gerek yok (paylaşılan depo cihazında artık veri bırakma). Server
 * artık tek doğruluk kaynağı.
 */
export async function clearSynced(sessionId: string, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    for (const pid of productIds) os.delete(`${sessionId}:${pid}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Verilen ürün anahtarlarını synced=true işaretle. */
export async function markSynced(sessionId: string, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    for (const pid of productIds) {
      const key = `${sessionId}:${pid}`;
      const getReq = os.get(key);
      getReq.onsuccess = () => {
        const v = getReq.result as CountDraft | undefined;
        if (v) {
          v.synced = true;
          os.put(v);
        }
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
