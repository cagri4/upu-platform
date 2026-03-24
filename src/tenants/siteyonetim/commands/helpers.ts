/**
 * Site Yonetim command helpers — shared context lookups and formatting
 */

import { getServiceClient } from "@/platform/auth/supabase";

const TENANT_ID = "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e";

export interface ResidentContext {
  building: { id: string; name: string; access_code: string | null };
  unit: { id: string; unit_number: string };
}

export interface ManagerContext {
  userId: string;
  role: string;
  building: { id: string; name: string; access_code: string | null; manager_id: string | null };
}

/**
 * Get resident's building + unit context via sy_user_residents join chain.
 */
export async function getResidentContext(userId: string): Promise<ResidentContext | null> {
  const supabase = getServiceClient();

  const { data: link } = await supabase
    .from("sy_user_residents")
    .select("building_id, resident_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!link) return null;

  const { data: building } = await supabase
    .from("sy_buildings")
    .select("id, name, access_code")
    .eq("id", link.building_id)
    .single();

  if (!building) return null;

  // Get unit from resident
  const { data: resident } = await supabase
    .from("sy_residents")
    .select("unit_id")
    .eq("id", link.resident_id)
    .single();

  if (!resident) return null;

  const { data: unit } = await supabase
    .from("sy_units")
    .select("id, unit_number")
    .eq("id", resident.unit_id)
    .single();

  if (!unit) return null;

  return { building, unit };
}

/**
 * Get manager context — checks if user is the manager of a building.
 * In the UPU platform, the profile's metadata.sy_role stores 'manager' | 'resident'.
 * Alternatively, we check if the user is sy_buildings.manager_id.
 */
export async function getManagerContext(userId: string): Promise<ManagerContext | null> {
  const supabase = getServiceClient();

  // Check if user is manager of any building
  const { data: building } = await supabase
    .from("sy_buildings")
    .select("id, name, access_code, manager_id")
    .eq("manager_id", userId)
    .eq("tenant_id", TENANT_ID)
    .limit(1)
    .maybeSingle();

  if (!building) return null;

  return {
    userId,
    role: "manager",
    building,
  };
}

/**
 * Generate a 6-character access code for building registration.
 */
export function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Format kurus amount to TL string.
 */
export function formatTL(kurus: number): string {
  return `${(kurus / 100).toFixed(2)} TL`;
}
