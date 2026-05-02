/**
 * Site Yonetim command helpers — shared context lookups and formatting
 *
 * Role model:
 *   - SiteYonetim SaaS users are building managers/staff by definition.
 *   - getStaffContext() is the primary context function — tries manager_id,
 *     then resident link, then first building in tenant. All paths grant
 *     management-level access to building data.
 *   - getResidentContext() is only for resident-specific views (single unit).
 */

import { getServiceClient } from "@/platform/auth/supabase";

const TENANT_ID = "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e";

export interface ResidentContext {
  building: { id: string; name: string; access_code: string | null };
  unit: { id: string; unit_number: string };
}

export interface StaffContext {
  userId: string;
  role: "manager" | "staff";
  building: { id: string; name: string; access_code: string | null };
  unit?: { id: string; unit_number: string };
}

/**
 * Get building context for any SiteYonetim user.
 * Tries (in order):
 *   1. sy_buildings.manager_id = userId → role: manager
 *   2. sy_user_residents link → role: staff (+ unit info)
 *
 * No tenant-fallback: returning a context for a user with no building link
 * leaks staff data to anyone (#3 in earlier code did this — every resident
 * appeared as "first building staff"). Callers must handle null and tell
 * the user to register.
 */
export async function getStaffContext(userId: string): Promise<StaffContext | null> {
  const supabase = getServiceClient();

  // 1. Direct manager link
  const { data: managed } = await supabase
    .from("sy_buildings")
    .select("id, name, access_code")
    .eq("manager_id", userId)
    .eq("tenant_id", TENANT_ID)
    .limit(1)
    .maybeSingle();

  if (managed) {
    return { userId, role: "manager", building: managed };
  }

  // 2. Resident link (staff associated with a building)
  const { data: link } = await supabase
    .from("sy_user_residents")
    .select("building_id, resident_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (link) {
    const { data: building } = await supabase
      .from("sy_buildings")
      .select("id, name, access_code")
      .eq("id", link.building_id)
      .single();

    if (building) {
      // Try to get unit info
      const { data: resident } = await supabase
        .from("sy_residents")
        .select("unit_id")
        .eq("id", link.resident_id)
        .single();

      let unit: { id: string; unit_number: string } | undefined;
      if (resident?.unit_id) {
        const { data: u } = await supabase
          .from("sy_units")
          .select("id, unit_number")
          .eq("id", resident.unit_id)
          .single();
        if (u) unit = u;
      }

      return { userId, role: "staff", building, unit };
    }
  }

  return null;
}

/**
 * Get resident's building + unit context via sy_user_residents join chain.
 * Only used for resident-specific views (single unit debt, etc.)
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
