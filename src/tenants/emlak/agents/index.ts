/**
 * Emlak Agent Registry — all 5 autonomous agents
 */

import { portfoyAgent } from "./portfoy";
import { satisAgent } from "./satis";
import { medyaAgent } from "./medya";
import { pazarAgent } from "./pazar";
import { sekreterAgent } from "./sekreter";
import type { AgentDefinition } from "@/platform/agents/types";

export const emlakAgents: Record<string, AgentDefinition> = {
  portfoy: portfoyAgent,
  satis: satisAgent,
  medya: medyaAgent,
  pazar: pazarAgent,
  sekreter: sekreterAgent,
};
