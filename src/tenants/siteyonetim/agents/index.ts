/**
 * Site Yonetim Agent Registry — all 4 autonomous agents
 */

import type { AgentDefinition } from "@/platform/agents/types";
import { muhasebeciAgent } from "./muhasebeci";
import { sekreterAgent } from "./sekreter";
import { teknisyenAgent } from "./teknisyen";
import { hukukAgent } from "./hukuk";

export const siteyonetimAgents: Record<string, AgentDefinition> = {
  sy_muhasebeci: muhasebeciAgent,
  sy_sekreter: sekreterAgent,
  sy_teknisyen: teknisyenAgent,
  sy_hukukMusaviri: hukukAgent,
};
