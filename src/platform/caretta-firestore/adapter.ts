/**
 * Caretta Firestore Adapter (STUB) — Faz 5
 *
 * Caretta Pansiyon'un mevcut Firebase Firestore verilerini OKUMA/YAZMA için
 * adapter. Caretta'nın mevcut sistemi: Firebase Auth + Firestore.
 *
 * UPU AI Asistan, Caretta sistemine bağlanırken Caretta Firestore'undan
 * misafir bilgisi, rez detayı vb. okuyabilmeli (taşıma yapmadan). Yazarken
 * ise pending kayıtlar Caretta tarafına da düşmeli.
 *
 * BU MODÜL ŞU AN STUB. Gerçek bağlantı için:
 *   - firebase-admin SDK + Caretta service account JSON
 *   - env: CARETTA_FIREBASE_PROJECT_ID, CARETTA_FIREBASE_PRIVATE_KEY
 *   - Caretta'dan service account anahtar gerekli
 *
 * Şimdilik tüm metodlar:
 *   - readGuestByPhone() — mock kayıt döner veya null
 *   - readReservation() — mock veya null
 *   - writePendingReservation() — DB log, gerçek yazma yok
 *
 * UPU'nun kendi Supabase'i ana persistence katmanı. Caretta Firestore'u
 * SADECE Caretta için bağlanıp UPU AI'ın oraya yansıması için.
 */

export interface CarettaGuest {
  firestore_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  last_visit_at: string | null;
  source: "caretta_firestore";
}

export interface CarettaReservation {
  firestore_id: string;
  guest_name: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  room_name: string | null;
  status: string;
  source: "caretta_firestore";
}

const STUB_LOG_PREFIX = "[caretta-adapter:STUB]";

function isEnabled(): boolean {
  // Gerçek bağlantı için: env'ler set edilmiş + bağlantı başarılı
  return !!(process.env.CARETTA_FIREBASE_PROJECT_ID && process.env.CARETTA_FIREBASE_PRIVATE_KEY);
}

export async function readGuestByPhone(phone: string): Promise<CarettaGuest | null> {
  if (!isEnabled()) {
    console.log(`${STUB_LOG_PREFIX} readGuestByPhone(${phone}) — adapter disabled, returning null`);
    return null;
  }
  // TODO: firebase-admin firestore('guests').where('phone', '==', phone).get()
  return null;
}

export async function readReservation(firestoreId: string): Promise<CarettaReservation | null> {
  if (!isEnabled()) {
    console.log(`${STUB_LOG_PREFIX} readReservation(${firestoreId}) — adapter disabled`);
    return null;
  }
  // TODO: firestore('reservations').doc(firestoreId).get()
  return null;
}

export interface WritePendingReservationInput {
  guest_name: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  room_name: string | null;
  total_price: number | null;
  upu_reservation_id: string;        // UPU'daki rez id (referans için)
  notes?: string | null;
}

export interface WriteResult {
  success: boolean;
  caretta_firestore_id: string | null;
  is_stub: boolean;
  message: string;
}

export async function writePendingReservation(input: WritePendingReservationInput): Promise<WriteResult> {
  if (!isEnabled()) {
    console.log(`${STUB_LOG_PREFIX} writePendingReservation(${input.upu_reservation_id}) — adapter disabled, skipping`);
    return {
      success: false,
      caretta_firestore_id: null,
      is_stub: true,
      message: "Caretta adapter disabled — Firestore'a yazılmadı (UPU Supabase tek persistence)",
    };
  }
  // TODO: firestore('reservations').add({ ...input, source: 'upu_ai', status: 'pending' })
  return {
    success: false,
    caretta_firestore_id: null,
    is_stub: true,
    message: "Real adapter not implemented yet",
  };
}

export function getAdapterStatus(): { enabled: boolean; mode: "stub" | "real" } {
  return {
    enabled: isEnabled(),
    mode: isEnabled() ? "real" : "stub",
  };
}
