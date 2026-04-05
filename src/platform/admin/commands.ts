/**
 * Admin WhatsApp Commands — platform admin monitoring via WhatsApp
 *
 * Commands prefixed with "a " or triggered via admin:* button callbacks.
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import type { WaContext } from "@/platform/whatsapp/types";

// ── Admin phone list (fallback if DB metadata not set) ───────────────────

const ADMIN_PHONES = [
  process.env.ADMIN_PHONE || "905551234567",
];

// ── Check if user is platform admin ──────────────────────────────────────

export async function isAdmin(ctx: WaContext): Promise<boolean> {
  // Check hardcoded phone list
  if (ADMIN_PHONES.includes(ctx.phone)) return true;

  // Check profile metadata
  try {
    const supabase = getServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("metadata")
      .eq("id", ctx.userId)
      .single();

    const meta = (profile?.metadata || {}) as Record<string, unknown>;
    if (meta.is_platform_admin === true) return true;
  } catch { /* ignore */ }

  return false;
}

// ── Route admin commands ─────────────────────────────────────────────────

export async function routeAdminCommand(ctx: WaContext, input: string): Promise<boolean> {
  const lower = input.toLowerCase().trim();

  // Text commands: "a ozet", "a kullanicilar", etc.
  if (lower === "ozet" || lower === "özet") {
    await adminOzet(ctx);
    return true;
  }
  if (lower === "kullanicilar" || lower === "kullanıcılar") {
    await adminKullanicilar(ctx);
    return true;
  }
  if (lower.startsWith("kullanici ") || lower.startsWith("kullanıcı ")) {
    const query = input.replace(/^kullan[ıi]c[ıi]\s+/i, "").trim();
    await adminKullaniciDetay(ctx, query);
    return true;
  }
  if (lower === "hatalar") {
    await adminHatalar(ctx);
    return true;
  }
  if (lower.startsWith("tenant ")) {
    const key = lower.replace("tenant ", "").trim();
    await adminTenant(ctx, key);
    return true;
  }
  if (lower === "alertler") {
    await adminAlertler(ctx);
    return true;
  }
  if (lower === "insight" || lower === "performans") {
    await adminInsight(ctx);
    return true;
  }

  return false;
}

// ── Route admin button callbacks ─────────────────────────────────────────

export async function routeAdminCallback(ctx: WaContext, callbackId: string): Promise<boolean> {
  if (callbackId === "admin:panel") {
    await showAdminMenu(ctx);
    return true;
  }
  if (callbackId === "admin:ozet") {
    await adminOzet(ctx);
    return true;
  }
  if (callbackId === "admin:kullanicilar") {
    await adminKullanicilar(ctx);
    return true;
  }
  if (callbackId === "admin:hatalar") {
    await adminHatalar(ctx);
    return true;
  }
  if (callbackId === "admin:tenant") {
    await adminTenantList(ctx);
    return true;
  }
  if (callbackId.startsWith("admin:tenant_")) {
    const key = callbackId.replace("admin:tenant_", "");
    await adminTenant(ctx, key);
    return true;
  }
  if (callbackId === "admin:alertler") {
    await adminAlertler(ctx);
    return true;
  }
  if (callbackId === "admin:insight") {
    await adminInsight(ctx);
    return true;
  }

  return false;
}

// ── Admin sub-menu ───────────────────────────────────────────────────────

async function showAdminMenu(ctx: WaContext): Promise<void> {
  await sendList(ctx.phone,
    "📊 *Admin Panel*\n\nBir rapor seçin:",
    "Raporlar",
    [
      {
        title: "Admin Raporları",
        rows: [
          { id: "admin:ozet", title: "📈 Günlük Özet", description: "Bugünün platform özeti" },
          { id: "admin:kullanicilar", title: "👥 Kullanıcılar", description: "Tüm kullanıcı listesi" },
          { id: "admin:hatalar", title: "⚠️ Hatalar", description: "Son hatalar" },
          { id: "admin:tenant", title: "🏢 Tenant Raporu", description: "Tenant bazlı rapor" },
          { id: "admin:insight", title: "📊 Insight", description: "Toplu performans raporu" },
          { id: "admin:alertler", title: "🔔 Alert Ayarları", description: "Bildirim tercihleri" },
        ],
      },
    ],
  );
}

// ── a ozet — Daily platform summary ──────────────────────────────────────

async function adminOzet(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  // Active users today
  const { data: todayEvents } = await supabase
    .from("platform_events")
    .select("user_id")
    .gte("created_at", todayStart.toISOString());

  const todayUsers = new Set((todayEvents || []).map(e => e.user_id).filter(Boolean));

  // Active users this week
  const { data: weekEvents } = await supabase
    .from("platform_events")
    .select("user_id")
    .gte("created_at", weekStart.toISOString());

  const weekUsers = new Set((weekEvents || []).map(e => e.user_id).filter(Boolean));

  // Commands today
  const { count: commandCount } = await supabase
    .from("platform_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "command")
    .gte("created_at", todayStart.toISOString());

  // Errors today
  const { count: errorCount } = await supabase
    .from("platform_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "error")
    .gte("created_at", todayStart.toISOString());

  // New signups (profiles created today)
  const { count: signupCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  // Per-tenant breakdown
  const { data: tenantBreakdown } = await supabase
    .from("platform_events")
    .select("tenant_key")
    .gte("created_at", todayStart.toISOString());

  const tenantCounts: Record<string, number> = {};
  for (const e of tenantBreakdown || []) {
    if (e.tenant_key) {
      tenantCounts[e.tenant_key] = (tenantCounts[e.tenant_key] || 0) + 1;
    }
  }

  let text = `📊 *Platform Günlük Özet*\n`;
  text += `📅 ${new Date().toLocaleDateString("tr-TR")}\n\n`;
  text += `👥 Aktif kullanıcı (bugün): *${todayUsers.size}*\n`;
  text += `👥 Aktif kullanıcı (bu hafta): *${weekUsers.size}*\n`;
  text += `⚡ Komut sayısı: *${commandCount || 0}*\n`;
  text += `⚠️ Hata sayısı: *${errorCount || 0}*\n`;
  text += `🆕 Yeni kayıt: *${signupCount || 0}*\n`;

  if (Object.keys(tenantCounts).length > 0) {
    text += `\n📋 *Tenant Dağılımı:*\n`;
    for (const [key, count] of Object.entries(tenantCounts).sort((a, b) => b[1] - a[1])) {
      text += `  • ${key}: ${count} işlem\n`;
    }
  }

  // Total users
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  text += `\n📊 Toplam kayıtlı kullanıcı: *${totalUsers || 0}*`;

  await sendButtons(ctx.phone, text, [
    { id: "admin:panel", title: "📊 Admin Panel" },
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);
}

// ── a kullanicilar — User list ───────────────────────────────────────────

async function adminKullanicilar(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id, display_name, whatsapp_phone, tenant_id, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!users?.length) {
    await sendButtons(ctx.phone, "Henüz kayıtlı kullanıcı yok.", [
      { id: "admin:panel", title: "📊 Admin Panel" },
    ]);
    return;
  }

  // Get tenant names
  const tenantIds = [...new Set(users.map(u => u.tenant_id).filter(Boolean))];
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, saas_type")
    .in("id", tenantIds);

  const tenantMap: Record<string, string> = {};
  for (const t of tenants || []) {
    tenantMap[t.id] = t.saas_type || t.name;
  }

  // Get command counts per user (last 7 days)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const { data: cmdEvents } = await supabase
    .from("platform_events")
    .select("user_id")
    .eq("event_type", "command")
    .gte("created_at", weekStart.toISOString());

  const cmdCounts: Record<string, number> = {};
  for (const e of cmdEvents || []) {
    if (e.user_id) cmdCounts[e.user_id] = (cmdCounts[e.user_id] || 0) + 1;
  }

  // Get last active time per user
  const { data: lastActive } = await supabase
    .from("platform_events")
    .select("user_id, created_at")
    .in("user_id", users.map(u => u.id))
    .order("created_at", { ascending: false });

  const lastActiveMap: Record<string, string> = {};
  for (const e of lastActive || []) {
    if (e.user_id && !lastActiveMap[e.user_id]) {
      lastActiveMap[e.user_id] = e.created_at;
    }
  }

  let text = `👥 *Kullanıcılar* (${users.length})\n\n`;

  for (const user of users) {
    const meta = (user.metadata || {}) as Record<string, unknown>;
    const tenant = user.tenant_id ? tenantMap[user.tenant_id] || "?" : "-";
    const cmds = cmdCounts[user.id] || 0;
    const lastTime = lastActiveMap[user.id]
      ? new Date(lastActiveMap[user.id]).toLocaleDateString("tr-TR")
      : "—";
    const onb = meta.onboarding_completed ? "✅" : "⏳";

    text += `*${user.display_name || "İsimsiz"}*\n`;
    text += `  📱 ${user.whatsapp_phone || "-"}\n`;
    text += `  🏢 ${tenant} | ${onb} | ⚡${cmds} (7g)\n`;
    text += `  Son aktif: ${lastTime}\n\n`;
  }

  await sendButtons(ctx.phone, text, [
    { id: "admin:panel", title: "📊 Admin Panel" },
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);
}

// ── a kullanici [phone or name] — Individual user detail ─────────────────

async function adminKullaniciDetay(ctx: WaContext, query: string): Promise<void> {
  const supabase = getServiceClient();

  // Search by phone or name
  let user;
  const cleanPhone = query.replace(/[\s\-\(\)]/g, "");

  // Try phone match first
  const { data: byPhone } = await supabase
    .from("profiles")
    .select("*")
    .ilike("whatsapp_phone", `%${cleanPhone}%`)
    .limit(1);

  if (byPhone?.length) {
    user = byPhone[0];
  } else {
    // Try name match
    const { data: byName } = await supabase
      .from("profiles")
      .select("*")
      .ilike("display_name", `%${query}%`)
      .limit(1);

    if (byName?.length) user = byName[0];
  }

  if (!user) {
    await sendButtons(ctx.phone, `❌ "${query}" ile eşleşen kullanıcı bulunamadı.`, [
      { id: "admin:kullanicilar", title: "👥 Kullanıcılar" },
    ]);
    return;
  }

  // Get tenant info
  let tenantName = "-";
  if (user.tenant_id) {
    const { data: t } = await supabase.from("tenants").select("name, saas_type").eq("id", user.tenant_id).single();
    if (t) tenantName = `${t.name} (${t.saas_type})`;
  }

  // Last 10 commands
  const { data: recentCmds } = await supabase
    .from("platform_events")
    .select("event_name, created_at, success")
    .eq("user_id", user.id)
    .eq("event_type", "command")
    .order("created_at", { ascending: false })
    .limit(10);

  // Error count
  const { count: errorCount } = await supabase
    .from("platform_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("event_type", "error");

  // Active agents
  const { data: agents } = await supabase
    .from("agent_configs")
    .select("agent_key, is_active")
    .eq("user_id", user.id);

  const meta = (user.metadata || {}) as Record<string, unknown>;
  const onbStatus = meta.onboarding_completed ? "Tamamlandı ✅" : "Devam ediyor ⏳";

  let text = `👤 *Kullanıcı Detay*\n\n`;
  text += `*Ad:* ${user.display_name || "-"}\n`;
  text += `*Telefon:* ${user.whatsapp_phone || "-"}\n`;
  text += `*E-posta:* ${user.email || "-"}\n`;
  text += `*Tenant:* ${tenantName}\n`;
  text += `*Kayıt:* ${new Date(user.created_at).toLocaleDateString("tr-TR")}\n`;
  text += `*Onboarding:* ${onbStatus}\n`;
  text += `*Hata sayısı:* ${errorCount || 0}\n`;

  if (agents?.length) {
    text += `\n🤖 *Aktif Ajanlar:*\n`;
    for (const a of agents) {
      text += `  • ${a.agent_key} ${a.is_active ? "✅" : "❌"}\n`;
    }
  }

  if (recentCmds?.length) {
    text += `\n📋 *Son Komutlar:*\n`;
    for (const cmd of recentCmds) {
      const date = new Date(cmd.created_at).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
      const icon = cmd.success ? "✅" : "❌";
      text += `  ${icon} ${cmd.event_name} — ${date}\n`;
    }
  }

  await sendButtons(ctx.phone, text, [
    { id: "admin:kullanicilar", title: "👥 Kullanıcılar" },
    { id: "admin:panel", title: "📊 Admin Panel" },
  ]);
}

// ── a hatalar — Recent errors ────────────────────────────────────────────

async function adminHatalar(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: errors } = await supabase
    .from("platform_events")
    .select("event_name, error_message, phone, tenant_key, created_at, metadata")
    .eq("event_type", "error")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!errors?.length) {
    await sendButtons(ctx.phone, "✅ Son zamanlarda hata kaydedilmemiş.", [
      { id: "admin:panel", title: "📊 Admin Panel" },
    ]);
    return;
  }

  let text = `⚠️ *Son Hatalar* (${errors.length})\n\n`;

  for (const err of errors) {
    const date = new Date(err.created_at).toLocaleString("tr-TR", {
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
    });
    const meta = (err.metadata || {}) as Record<string, unknown>;
    text += `*${date}*\n`;
    text += `📱 ${err.phone || "?"} | 🏢 ${err.tenant_key || "?"}\n`;
    text += `❌ ${(err.error_message || "Bilinmeyen hata").substring(0, 150)}\n`;
    if (meta.text) text += `💬 "${String(meta.text).substring(0, 80)}"\n`;
    text += `\n`;
  }

  await sendButtons(ctx.phone, text, [
    { id: "admin:panel", title: "📊 Admin Panel" },
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);
}

// ── a tenant [key] — Tenant report ───────────────────────────────────────

async function adminTenantList(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, saas_type")
    .order("name");

  if (!tenants?.length) {
    await sendButtons(ctx.phone, "Tenant bulunamadı.", [
      { id: "admin:panel", title: "📊 Admin Panel" },
    ]);
    return;
  }

  const rows = tenants.map(t => ({
    id: `admin:tenant_${t.saas_type}`,
    title: t.name.substring(0, 24),
    description: t.saas_type,
  }));

  await sendList(ctx.phone,
    "🏢 *Tenant Seçin:*",
    "Tenantlar",
    [{ title: "Tenantlar", rows }],
  );
}

async function adminTenant(ctx: WaContext, key: string): Promise<void> {
  const supabase = getServiceClient();

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, saas_type")
    .eq("saas_type", key)
    .single();

  if (!tenant) {
    await sendButtons(ctx.phone, `❌ Tenant "${key}" bulunamadı.`, [
      { id: "admin:tenant", title: "🏢 Tenantlar" },
    ]);
    return;
  }

  // Users in tenant
  const { data: users, count: userCount } = await supabase
    .from("profiles")
    .select("id, display_name, whatsapp_phone", { count: "exact" })
    .eq("tenant_id", tenant.id);

  // Most used commands (last 7 days)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const { data: cmdEvents } = await supabase
    .from("platform_events")
    .select("event_name")
    .eq("event_type", "command")
    .eq("tenant_key", key)
    .gte("created_at", weekStart.toISOString());

  const cmdFreq: Record<string, number> = {};
  for (const e of cmdEvents || []) {
    cmdFreq[e.event_name] = (cmdFreq[e.event_name] || 0) + 1;
  }
  const topCmds = Object.entries(cmdFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Error rate
  const { count: totalEvents } = await supabase
    .from("platform_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_key", key)
    .gte("created_at", weekStart.toISOString());

  const { count: errorEvents } = await supabase
    .from("platform_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "error")
    .eq("tenant_key", key)
    .gte("created_at", weekStart.toISOString());

  const errorRate = totalEvents ? ((errorEvents || 0) / totalEvents * 100).toFixed(1) : "0";

  // Agent usage
  const { data: agentConfigs } = await supabase
    .from("agent_configs")
    .select("agent_key, is_active, user_id")
    .in("user_id", (users || []).map(u => u.id));

  let text = `🏢 *${tenant.name}* (${key})\n\n`;
  text += `👥 Kullanıcı sayısı: *${userCount || 0}*\n`;
  text += `⚡ Toplam işlem (7g): *${totalEvents || 0}*\n`;
  text += `⚠️ Hata oranı: *${errorRate}%*\n`;

  if (topCmds.length > 0) {
    text += `\n📋 *En Çok Kullanılan Komutlar (7g):*\n`;
    for (const [cmd, count] of topCmds) {
      text += `  • ${cmd}: ${count}\n`;
    }
  }

  if (agentConfigs?.length) {
    const activeAgents = agentConfigs.filter(a => a.is_active);
    text += `\n🤖 *Ajan Kullanımı:*\n`;
    text += `  Toplam: ${agentConfigs.length} | Aktif: ${activeAgents.length}\n`;
  }

  if (users?.length) {
    text += `\n👥 *Kullanıcılar:*\n`;
    for (const u of users.slice(0, 10)) {
      text += `  • ${u.display_name || "İsimsiz"} (${u.whatsapp_phone || "-"})\n`;
    }
  }

  await sendButtons(ctx.phone, text, [
    { id: "admin:tenant", title: "🏢 Tenantlar" },
    { id: "admin:panel", title: "📊 Admin Panel" },
  ]);
}

// ── a insight — Aggregate platform insights ─────────────────────────────

async function adminInsight(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    weekEventsRes,
    monthEventsRes,
    feedbackRes,
    salesRes,
    presRes,
    activeUsersRes,
  ] = await Promise.all([
    // Events this week
    supabase.from("platform_events").select("user_id, event_type")
      .gte("created_at", sevenDaysAgo),
    // Events this month
    supabase.from("platform_events").select("user_id, event_type")
      .gte("created_at", thirtyDaysAgo),
    // Sale feedback
    supabase.from("platform_events").select("metadata")
      .eq("event_type", "sale_feedback")
      .gte("created_at", thirtyDaysAgo),
    // Sales (status changes)
    supabase.from("platform_events").select("user_id, metadata")
      .eq("event_name", "property_status_change")
      .gte("created_at", thirtyDaysAgo),
    // Presentations
    supabase.from("emlak_presentations").select("id, user_id")
      .gte("created_at", thirtyDaysAgo),
    // Active users (distinct)
    supabase.from("platform_events").select("user_id")
      .gte("created_at", sevenDaysAgo),
  ]);

  const weekEvents = weekEventsRes.data || [];
  const monthEvents = monthEventsRes.data || [];
  const weekActiveUsers = new Set(weekEvents.map(e => e.user_id).filter(Boolean));
  const monthActiveUsers = new Set(monthEvents.map(e => e.user_id).filter(Boolean));

  // Command counts
  const weekCommands = weekEvents.filter(e => e.event_type === "command").length;
  const monthCommands = monthEvents.filter(e => e.event_type === "command").length;
  const weekErrors = weekEvents.filter(e => e.event_type === "error").length;

  // Feedback stats
  const feedbacks = feedbackRes.data || [];
  const ratings = feedbacks
    .map(f => (f.metadata as Record<string, unknown>)?.system_rating as number)
    .filter(r => typeof r === "number");
  const avgRating = ratings.length > 0
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : "—";

  // Sales
  const salesData = salesRes.data || [];
  const saleCount = salesData.filter(s => {
    const detail = String((s.metadata as Record<string, unknown>)?.new_status || "");
    return detail.includes("satildi") || detail.includes("kiralandi");
  }).length;

  // Presentations
  const presCount = presRes.data?.length || 0;

  let text = `📊 *Platform Insight* (Son 30 gün)\n\n`;
  text += `*Kullanıcılar*\n`;
  text += `  Bu hafta aktif: ${weekActiveUsers.size}\n`;
  text += `  Bu ay aktif: ${monthActiveUsers.size}\n\n`;

  text += `*Aktivite*\n`;
  text += `  Bu hafta komut: ${weekCommands}\n`;
  text += `  Bu ay komut: ${monthCommands}\n`;
  text += `  Hata (7g): ${weekErrors}\n\n`;

  text += `*İş Sonuçları*\n`;
  text += `  Satış/Kiralama: ${saleCount}\n`;
  text += `  Sunum gönderilen: ${presCount}\n`;
  if (presCount > 0 && saleCount > 0) {
    text += `  Dönüşüm: ~%${Math.round((saleCount / presCount) * 100)}\n`;
  }
  text += `\n`;

  text += `*Sistem Değerlendirmesi*\n`;
  text += `  Ortalama puan: ${avgRating}/10 (${ratings.length} oy)\n`;

  // Top users by activity
  const userActivity: Record<string, number> = {};
  for (const e of monthEvents) {
    if (e.user_id) userActivity[e.user_id] = (userActivity[e.user_id] || 0) + 1;
  }
  const topUsers = Object.entries(userActivity).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (topUsers.length > 0) {
    // Get names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", topUsers.map(u => u[0]));
    const nameMap: Record<string, string> = {};
    for (const p of profiles || []) nameMap[p.id] = p.display_name || "?";

    text += `\n*En Aktif Kullanıcılar*\n`;
    for (const [uid, count] of topUsers) {
      text += `  ${nameMap[uid] || uid.substring(0, 8)}: ${count} işlem\n`;
    }
  }

  await sendButtons(ctx.phone, text, [
    { id: "admin:panel", title: "📊 Admin Panel" },
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}

// ── a alertler — Alert settings ──────────────────────────────────────────

async function adminAlertler(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  // Get current alert settings from profile metadata
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", ctx.userId)
    .single();

  const meta = (profile?.metadata || {}) as Record<string, unknown>;
  const alerts = (meta.admin_alerts || {}) as Record<string, boolean>;

  const newUserAlerts = alerts.new_user !== false; // default on
  const errorAlerts = alerts.errors !== false; // default on
  const dailySummary = alerts.daily_summary !== false; // default on

  let text = `🔔 *Alert Ayarları*\n\n`;
  text += `Yeni kullanıcı bildirimi: ${newUserAlerts ? "✅ Açık" : "❌ Kapalı"}\n`;
  text += `Hata bildirimi: ${errorAlerts ? "✅ Açık" : "❌ Kapalı"}\n`;
  text += `Günlük özet: ${dailySummary ? "✅ Açık" : "❌ Kapalı"}\n`;
  text += `\nDeğiştirmek için "a alert [tip] [ac/kapat]" yazın.\n`;
  text += `Örn: "a alert hata kapat"`;

  await sendButtons(ctx.phone, text, [
    { id: "admin:panel", title: "📊 Admin Panel" },
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);
}

// ── Send alert to admin (used by cron) ───────────────────────────────────

export async function sendAdminAlert(message: string): Promise<void> {
  const supabase = getServiceClient();

  // Find all admin users
  const { data: admins } = await supabase
    .from("profiles")
    .select("whatsapp_phone, metadata")
    .not("whatsapp_phone", "is", null);

  for (const admin of admins || []) {
    const meta = (admin.metadata || {}) as Record<string, unknown>;
    const isAdm = meta.is_platform_admin === true || ADMIN_PHONES.includes(admin.whatsapp_phone);
    if (!isAdm) continue;

    await sendText(admin.whatsapp_phone, message);
  }
}
