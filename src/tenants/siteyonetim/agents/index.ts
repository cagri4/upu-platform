/**
 * Site Yonetim Agent Registry — all 4 autonomous agents (V2)
 */

import { muhasebeciAgent } from "./muhasebeci";
import { sekreterAgent } from "./sekreter";
import { teknisyenAgent } from "./teknisyen";
import { hukukAgent } from "./hukuk";
import type { AgentDefinition } from "@/platform/agents/types";

export const siteyonetimAgents: Record<string, AgentDefinition> = {
  sy_muhasebeci: muhasebeciAgent,
  sy_sekreter: sekreterAgent,
  sy_teknisyen: teknisyenAgent,
  sy_hukukMusaviri: hukukAgent,
};
