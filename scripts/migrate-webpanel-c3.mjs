#!/usr/bin/env node
/**
 * Migrate: move `emlak_c2_webpanel` mission → `emlak_c3_webpanel`.
 *
 * One-off migration. Safe to re-run (idempotent).
 *
 * Changes:
 *   - Deletes emlak_c2_webpanel row (platform_missions + user_mission_progress)
 *   - Inserts emlak_c3_webpanel at chapter 3, order 8
 *   - Rewires chains: c2_tara → c2_gorevler, c3_trend → c3_webpanel
 *   - Shifts sort_orders for c2_gorevler, c2_uzanti, and all c3 missions
 *   - Resets active_mission_key for any user still pointing to the old key
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync("/home/cagr/Masaüstü/upu-platform/.env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

const SORT_UPDATES = [
  // c2 shifts after removal
  { mission_key: "emlak_c2_gorevler", sort_order: 12, chapter_order: 7, next_mission: "emlak_c2_uzanti" },
  { mission_key: "emlak_c2_uzanti",   sort_order: 13, chapter_order: 8, next_mission: null },
  // c3 shifts with webpanel appended at end
  { mission_key: "emlak_c3_mulkyonet", sort_order: 14, chapter_order: 1, next_mission: "emlak_c3_degerle" },
  { mission_key: "emlak_c3_degerle",   sort_order: 15, chapter_order: 2, next_mission: "emlak_c3_hatirlatma" },
  { mission_key: "emlak_c3_hatirlatma",sort_order: 16, chapter_order: 3, next_mission: "emlak_c3_yayinla" },
  { mission_key: "emlak_c3_yayinla",   sort_order: 17, chapter_order: 4, next_mission: "emlak_c3_sunum" },
  { mission_key: "emlak_c3_sunum",     sort_order: 18, chapter_order: 5, next_mission: "emlak_c3_takip" },
  { mission_key: "emlak_c3_takip",     sort_order: 19, chapter_order: 6, next_mission: "emlak_c3_trend" },
  { mission_key: "emlak_c3_trend",     sort_order: 20, chapter_order: 7, next_mission: "emlak_c3_webpanel" },
];

const NEW_MISSION = {
  tenant_key: "emlak",
  role: "admin",
  category: "analiz",
  mission_key: "emlak_c3_webpanel",
  title: "Web paneline girin",
  description: "Portföyünüzü büyük ekrandan görüntüleyin — 15 dk geçerli magic link ile mülk/müşteri listenizi inceleyin",
  emoji: "🖥",
  points: 10,
  sort_order: 21,
  is_repeatable: false,
  next_mission: null,
  employee_key: "analist",
  xp_reward: 10,
  chapter: 3,
  chapter_order: 8,
};

// Fix c2_tara chain (was pointing at webpanel; now skips to c2_gorevler)
const C2_TARA_UPDATE = { mission_key: "emlak_c2_tara", next_mission: "emlak_c2_gorevler" };

async function main() {
  console.log("▶ Starting emlak webpanel migration (c2 → c3)");

  // 1. Get old mission id to clean up user progress
  const { data: oldMission } = await sb
    .from("platform_missions")
    .select("id")
    .eq("mission_key", "emlak_c2_webpanel")
    .maybeSingle();

  if (oldMission) {
    // 1a. Delete any user progress pointing at the old mission
    const { count: progDel } = await sb
      .from("user_mission_progress")
      .delete({ count: "exact" })
      .eq("mission_id", oldMission.id);
    console.log(`  ✓ Cleared ${progDel || 0} user_mission_progress rows for old mission`);

    // 1b. Delete the old mission row
    await sb.from("platform_missions").delete().eq("id", oldMission.id);
    console.log("  ✓ Deleted emlak_c2_webpanel from platform_missions");
  } else {
    console.log("  • emlak_c2_webpanel not in DB (already migrated?)");
  }

  // 2. Upsert new mission
  const { data: existingNew } = await sb
    .from("platform_missions")
    .select("id")
    .eq("mission_key", "emlak_c3_webpanel")
    .maybeSingle();
  if (existingNew) {
    await sb.from("platform_missions").update(NEW_MISSION).eq("id", existingNew.id);
    console.log("  ✓ Updated emlak_c3_webpanel");
  } else {
    await sb.from("platform_missions").insert(NEW_MISSION);
    console.log("  ✓ Inserted emlak_c3_webpanel");
  }

  // 3. Update c2_tara chain
  await sb.from("platform_missions")
    .update({ next_mission: C2_TARA_UPDATE.next_mission })
    .eq("mission_key", C2_TARA_UPDATE.mission_key);
  console.log("  ✓ Rewired emlak_c2_tara → emlak_c2_gorevler");

  // 4. Sort + chapter_order + next_mission shifts
  for (const u of SORT_UPDATES) {
    await sb.from("platform_missions")
      .update({
        sort_order: u.sort_order,
        chapter_order: u.chapter_order,
        next_mission: u.next_mission,
      })
      .eq("mission_key", u.mission_key);
    console.log(`  ✓ Re-ordered ${u.mission_key} (sort=${u.sort_order}, next=${u.next_mission})`);
  }

  // 5. Reset any user with active_mission_key = old key
  const { data: stuckUsers } = await sb
    .from("user_quest_state")
    .select("user_id")
    .eq("active_mission_key", "emlak_c2_webpanel");
  if (stuckUsers && stuckUsers.length > 0) {
    await sb.from("user_quest_state")
      .update({ active_mission_key: null })
      .eq("active_mission_key", "emlak_c2_webpanel");
    console.log(`  ✓ Reset active_mission_key for ${stuckUsers.length} user(s)`);
  } else {
    console.log("  • No users stuck on old mission");
  }

  console.log("✅ Migration complete");
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
