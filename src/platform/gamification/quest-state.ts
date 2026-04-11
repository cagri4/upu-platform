/**
 * Quest State Machine — chapter-based progression with data-driven transitions.
 *
 * Patterns applied:
 *   - State Machine: 5 chapters, each with transition conditions
 *   - Object Pool: 33 commands reused across chapters
 *   - Game Loop: mission complete → next mission immediately (no artificial delay)
 *   - Type Object: missions are data, not code
 *   - Observer: mission complete → check chapter transition
 *   - Flyweight: mission definitions shared, user progress per-user
 *
 * Corridor rule: ONE active mission at a time. User doesn't choose.
 */

import { getServiceClient } from "@/platform/auth/supabase";

// ── Chapter definitions ────────────────────────────────────────────

export interface ChapterDef {
  chapter: number;
  name: string;
  emoji: string;
  title: string;
  completionMessage: string;
}

export const CHAPTERS: ChapterDef[] = [
  {
    chapter: 1,
    name: "Çaylak",
    emoji: "🌱",
    title: "Ekibinle Tanış",
    completionMessage: "🎉 *Bölüm 1 Tamamlandı!*\n\nTebrikler! 5 elemanınla tanıştın. Her biri senin için çalışmaya hazır.\n\n⚡ *Bölüm 2: Araçlarını Kur* başlıyor!",
  },
  {
    chapter: 2,
    name: "Öğrenci",
    emoji: "⚡",
    title: "Araçlarını Kur",
    completionMessage: "🎉 *Bölüm 2 Tamamlandı!*\n\nAraçlarına hakimsin! Artık profesyonel altyapın hazır.\n\n💼 *Bölüm 3: İlk Satış Döngüsü* başlıyor!",
  },
  {
    chapter: 3,
    name: "Pratisyen",
    emoji: "💼",
    title: "İlk Satış Döngüsü",
    completionMessage: "🎉 *Bölüm 3 Tamamlandı!*\n\nİlk satış döngünü tamamladın! Mülk hazırla → müşteri bul → sun → takip et.\n\n🏆 *Bölüm 4: Büyüt ve Optimize Et* başlıyor!",
  },
  {
    chapter: 4,
    name: "Profesyonel",
    emoji: "🏆",
    title: "Büyüt ve Optimize Et",
    completionMessage: "🎉 *Bölüm 4 Tamamlandı!*\n\nProfesyonel araçlara hakimsin! Portföyün büyüyor.\n\n👑 *Bölüm 5: Ağını Genişlet* başlıyor!",
  },
  {
    chapter: 5,
    name: "Uzman",
    emoji: "👑",
    title: "Ağını Genişlet",
    completionMessage: "🎉 *Tüm Bölümler Tamamlandı!*\n\nArtık bir uzman emlak danışmanısın. Tüm araçlara hakimsin.\n\nBundan sonra günlük görevler, streak, leaderboard ve sezonsal etkinliklerle devam!",
  },
];

// ── Quest state CRUD ───────────────────────────────────────────────

export interface QuestState {
  user_id: string;
  tenant_key: string;
  current_chapter: number;
  active_mission_key: string | null;
  commands_used: string[];
}

export async function getQuestState(userId: string, tenantKey: string): Promise<QuestState> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("user_quest_state")
    .select("*")
    .eq("user_id", userId)
    .eq("tenant_key", tenantKey)
    .maybeSingle();

  if (data) return data as QuestState;

  // Initialize quest state — chapter 1, no active mission yet
  const fresh: QuestState = {
    user_id: userId,
    tenant_key: tenantKey,
    current_chapter: 1,
    active_mission_key: null,
    commands_used: [],
  };

  await supabase.from("user_quest_state").insert(fresh);
  return fresh;
}

export async function updateQuestState(
  userId: string,
  tenantKey: string,
  updates: Partial<Pick<QuestState, "current_chapter" | "active_mission_key" | "commands_used">>,
): Promise<void> {
  const supabase = getServiceClient();
  await supabase
    .from("user_quest_state")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("tenant_key", tenantKey);
}

// ── Track command usage ────────────────────────────────────────────

export async function trackCommandUsed(userId: string, tenantKey: string, command: string): Promise<void> {
  const state = await getQuestState(userId, tenantKey);
  if (state.commands_used.includes(command)) return;

  const updated = [...state.commands_used, command];
  await updateQuestState(userId, tenantKey, { commands_used: updated });
}

// ── Get current active mission (or activate first of current chapter) ─

export async function ensureActiveMission(userId: string, tenantKey: string): Promise<string | null> {
  const supabase = getServiceClient();
  const state = await getQuestState(userId, tenantKey);

  // Endgame — no more chapter missions
  if (state.current_chapter > 5) return null;

  // Check if there's already an active mission in user_mission_progress
  const { data: activeProgress } = await supabase
    .from("user_mission_progress")
    .select("mission_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (activeProgress && activeProgress.length > 0) {
    // Verify it's a mission from current or earlier chapter
    const { data: mission } = await supabase
      .from("platform_missions")
      .select("mission_key")
      .eq("id", activeProgress[0].mission_id)
      .eq("tenant_key", tenantKey)
      .maybeSingle();

    if (mission) {
      // Update quest state if needed
      if (state.active_mission_key !== mission.mission_key) {
        await updateQuestState(userId, tenantKey, { active_mission_key: mission.mission_key });
      }
      return mission.mission_key;
    }
  }

  // No active mission — activate first mission of current chapter
  const { data: firstMission } = await supabase
    .from("platform_missions")
    .select("id, mission_key")
    .eq("tenant_key", tenantKey)
    .eq("chapter", state.current_chapter)
    .order("chapter_order")
    .limit(1)
    .maybeSingle();

  if (!firstMission) return null;

  // Check if already completed
  const { data: existingProgress } = await supabase
    .from("user_mission_progress")
    .select("id, status")
    .eq("user_id", userId)
    .eq("mission_id", firstMission.id)
    .maybeSingle();

  if (!existingProgress) {
    await supabase.from("user_mission_progress").insert({
      user_id: userId,
      mission_id: firstMission.id,
      status: "active",
    });
  } else if (existingProgress.status !== "active" && existingProgress.status !== "completed") {
    await supabase
      .from("user_mission_progress")
      .update({ status: "active" })
      .eq("id", existingProgress.id);
  }

  await updateQuestState(userId, tenantKey, { active_mission_key: firstMission.mission_key });
  return firstMission.mission_key;
}

// ── Check chapter completion + transition ──────────────────────────

export interface ChapterTransitionResult {
  chapterCompleted: boolean;
  oldChapter: number;
  newChapter: number;
  completionMessage: string | null;
  nextMissionKey: string | null;
  isEndgame: boolean;
}

export async function checkChapterTransition(
  userId: string,
  tenantKey: string,
): Promise<ChapterTransitionResult> {
  const supabase = getServiceClient();
  const state = await getQuestState(userId, tenantKey);
  const chapter = state.current_chapter;

  if (chapter > 5) {
    return { chapterCompleted: false, oldChapter: chapter, newChapter: chapter, completionMessage: null, nextMissionKey: null, isEndgame: true };
  }

  // Check: are ALL missions in current chapter completed?
  const { data: chapterMissions } = await supabase
    .from("platform_missions")
    .select("id, mission_key")
    .eq("tenant_key", tenantKey)
    .eq("chapter", chapter)
    .order("chapter_order");

  if (!chapterMissions || chapterMissions.length === 0) {
    return { chapterCompleted: false, oldChapter: chapter, newChapter: chapter, completionMessage: null, nextMissionKey: null, isEndgame: false };
  }

  const missionIds = chapterMissions.map(m => m.id);
  const { data: completedProgress } = await supabase
    .from("user_mission_progress")
    .select("mission_id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("mission_id", missionIds);

  const completedIds = new Set((completedProgress || []).map(p => p.mission_id));
  const allCompleted = missionIds.every(id => completedIds.has(id));

  if (!allCompleted) {
    return { chapterCompleted: false, oldChapter: chapter, newChapter: chapter, completionMessage: null, nextMissionKey: null, isEndgame: false };
  }

  // Chapter completed! Transition to next chapter.
  const chapterDef = CHAPTERS.find(c => c.chapter === chapter);
  const newChapter = chapter + 1;
  const isEndgame = newChapter > 5;

  await updateQuestState(userId, tenantKey, {
    current_chapter: newChapter,
    active_mission_key: null,
  });

  // Activate first mission of new chapter (if not endgame)
  let nextMissionKey: string | null = null;
  if (!isEndgame) {
    const { data: nextFirst } = await supabase
      .from("platform_missions")
      .select("id, mission_key")
      .eq("tenant_key", tenantKey)
      .eq("chapter", newChapter)
      .order("chapter_order")
      .limit(1)
      .maybeSingle();

    if (nextFirst) {
      await supabase.from("user_mission_progress").insert({
        user_id: userId,
        mission_id: nextFirst.id,
        status: "active",
      });
      nextMissionKey = nextFirst.mission_key;
      await updateQuestState(userId, tenantKey, { active_mission_key: nextFirst.mission_key });
    }
  }

  return {
    chapterCompleted: true,
    oldChapter: chapter,
    newChapter,
    completionMessage: chapterDef?.completionMessage || null,
    nextMissionKey,
    isEndgame,
  };
}

// ── Get chapter info for display ───────────────────────────────────

export function getChapterDef(chapter: number): ChapterDef | undefined {
  return CHAPTERS.find(c => c.chapter === chapter);
}

export async function getChapterProgress(userId: string, tenantKey: string): Promise<{
  chapter: number;
  chapterDef: ChapterDef | undefined;
  completed: number;
  total: number;
  isEndgame: boolean;
}> {
  const supabase = getServiceClient();
  const state = await getQuestState(userId, tenantKey);

  if (state.current_chapter > 5) {
    return { chapter: state.current_chapter, chapterDef: undefined, completed: 0, total: 0, isEndgame: true };
  }

  const { data: chapterMissions } = await supabase
    .from("platform_missions")
    .select("id")
    .eq("tenant_key", tenantKey)
    .eq("chapter", state.current_chapter);

  const missionIds = (chapterMissions || []).map(m => m.id);

  const { data: completedProgress } = await supabase
    .from("user_mission_progress")
    .select("mission_id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("mission_id", missionIds.length > 0 ? missionIds : ["_none_"]);

  return {
    chapter: state.current_chapter,
    chapterDef: getChapterDef(state.current_chapter),
    completed: completedProgress?.length || 0,
    total: missionIds.length,
    isEndgame: false,
  };
}
