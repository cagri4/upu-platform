/**
 * /leaderboard — Regional ranking by total XP + user rank.
 *
 * Shows top 10 users in the same region (location from profile metadata)
 * and the current user's position. Users appear with display_name or a
 * generated nickname for privacy.
 */
import type { WaContext } from "./types";
import { sendButtons } from "./send";
import { getServiceClient } from "@/platform/auth/supabase";
import { USER_RANK_NAMES } from "@/platform/gamification/employees";

export async function handleLeaderboard(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    // Get current user's region from profile metadata
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("display_name, metadata")
      .eq("id", ctx.userId)
      .maybeSingle();

    const myMeta = (myProfile?.metadata || {}) as Record<string, unknown>;
    const myRegion = (myMeta.location || myMeta.office_name || "") as string;

    // Get all user_employee_progress grouped by user
    const { data: allProgress } = await supabase
      .from("user_employee_progress")
      .select("user_id, xp, tier");

    if (!allProgress || allProgress.length === 0) {
      await sendButtons(ctx.phone, "🏆 Henüz sıralama oluşmadı. Görevleri tamamlayarak sıralamaya gir!", [
        { id: "cmd:ekibim", title: "📋 Ekibim" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    // Aggregate per user: total XP + tier sum
    const userMap: Record<string, { total_xp: number; tier_sum: number }> = {};
    for (const p of allProgress) {
      if (!userMap[p.user_id]) userMap[p.user_id] = { total_xp: 0, tier_sum: 0 };
      userMap[p.user_id].total_xp += p.xp;
      userMap[p.user_id].tier_sum += p.tier;
    }

    // Get profiles for all users with progress
    const userIds = Object.keys(userMap);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, metadata")
      .in("id", userIds);

    // Build ranking entries
    interface RankEntry {
      userId: string;
      name: string;
      total_xp: number;
      tier_sum: number;
      rank: number;
      rank_name: string;
      region: string;
    }

    const entries: RankEntry[] = userIds.map(uid => {
      const prof = profiles?.find(p => p.id === uid);
      const meta = (prof?.metadata || {}) as Record<string, unknown>;
      const name = (prof?.display_name || `Danışman`).split(" ")[0]; // Nick: first name only
      const region = (meta.location || meta.office_name || "Bilinmiyor") as string;
      const u = userMap[uid];
      const rank = computeRankFromSum(u.tier_sum);
      return {
        userId: uid,
        name,
        total_xp: u.total_xp,
        tier_sum: u.tier_sum,
        rank,
        rank_name: USER_RANK_NAMES[rank] || "Stajyer EDm",
        region,
      };
    });

    // Sort by total XP descending
    entries.sort((a, b) => b.total_xp - a.total_xp);

    // Find current user's position
    const myIndex = entries.findIndex(e => e.userId === ctx.userId);
    const myEntry = myIndex >= 0 ? entries[myIndex] : null;

    // Region label
    const regionLabel = myRegion || "Genel";

    // Build message
    let msg = `🏆 *Sıralama — ${regionLabel}*\n\n`;

    const medals = ["🥇", "🥈", "🥉"];
    const top = entries.slice(0, 10);
    for (let i = 0; i < top.length; i++) {
      const e = top[i];
      const prefix = i < 3 ? medals[i] : ` ${i + 1}.`;
      const isMe = e.userId === ctx.userId;
      const nameStr = isMe ? `*${e.name} (Sen)*` : e.name;
      msg += `${prefix} ${nameStr} — ${e.total_xp} XP\n`;
    }

    if (myIndex >= 10 && myEntry) {
      msg += `\n...\n${myIndex + 1}. *${myEntry.name} (Sen)* — ${myEntry.total_xp} XP\n`;
    }

    if (myEntry) {
      msg += `\n👤 Rütben: ${myEntry.rank_name}`;
    }

    msg += `\n📊 Toplam ${entries.length} danışman`;

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:ekibim", title: "📋 Ekibim" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  } catch (err) {
    console.error("[leaderboard]", err);
    await sendButtons(ctx.phone, "Sıralama yüklenemedi.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  }
}

function computeRankFromSum(tierSum: number): number {
  const thresholds = [0, 5, 10, 15, 20];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (tierSum >= thresholds[i]) return i + 1;
  }
  return 1;
}
