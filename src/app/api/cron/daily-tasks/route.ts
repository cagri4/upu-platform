/**
 * Cron: Daily Task Generator
 *
 * Her gece çalışır, kullanıcı verisine göre günlük görevler üretir.
 * Vercel Cron: 0 6 * * * (her gün 06:00 UTC = 09:00 TR)
 */
import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { EMLAK_TASK_RULES } from "@/tenants/emlak/gamification";
import { BAYI_ADMIN_TASK_RULES } from "@/tenants/bayi/gamification";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServiceClient();
    const today = new Date().toISOString().split("T")[0];

    // Get all active users with their tenants
    const { data: users } = await supabase
      .from("profiles")
      .select("id, tenant_id, role, whatsapp_phone")
      .not("whatsapp_phone", "is", null)
      .in("role", ["admin", "user"]);

    if (!users?.length) return NextResponse.json({ generated: 0 });

    // Get tenant info
    const tenantIds = [...new Set(users.map(u => u.tenant_id).filter(Boolean))];
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, saas_type")
      .in("id", tenantIds);

    const tenantMap: Record<string, string> = {};
    for (const t of tenants || []) tenantMap[t.id] = t.saas_type;

    let totalGenerated = 0;

    for (const user of users) {
      const tenantKey = tenantMap[user.tenant_id] || "";

      // Check if tasks already generated today
      const { data: existingTasks } = await supabase
        .from("user_daily_tasks")
        .select("id")
        .eq("user_id", user.id)
        .eq("due_date", today)
        .limit(1);

      if (existingTasks?.length) continue; // Already generated

      // Get task rules based on tenant
      let rules: typeof EMLAK_TASK_RULES = [];
      if (tenantKey === "emlak") rules = EMLAK_TASK_RULES;
      else if (tenantKey === "bayi") rules = BAYI_ADMIN_TASK_RULES;

      // Generate tasks
      for (const rule of rules) {
        try {
          const matches = await rule.check(user.id, user.tenant_id);
          for (const match of matches) {
            await supabase.from("user_daily_tasks").insert({
              user_id: user.id,
              tenant_key: tenantKey,
              task_type: rule.task_type,
              title: rule.title,
              description: match.description,
              emoji: rule.emoji,
              command: rule.command,
              entity_id: match.entityId || null,
              points: rule.points,
              employee_key: rule.employee_key || null,
              xp_reward: rule.xp_reward || rule.points || 5,
              status: "pending",
              due_date: today,
            });
            totalGenerated++;
          }
        } catch (err) {
          console.error(`[daily-tasks] Rule ${rule.task_type} error for user ${user.id}:`, err);
        }
      }
    }

    return NextResponse.json({ generated: totalGenerated, users: users.length, date: today });
  } catch (err) {
    console.error("[daily-tasks] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
