/**
 * Muhasebe Agent Registry — all 4 autonomous agents
 */

import type { AgentDefinition } from "@/platform/agents/types";
import { faturaUzmaniAgent } from "./fatura-uzmani";
import { sekreterAgent } from "./sekreter";
import { vergiUzmaniAgent } from "./vergi-uzmani";
import { tahsilatUzmaniAgent } from "./tahsilat-uzmani";

export const muhasebeAgents: Record<string, AgentDefinition> = {
  muh_faturaUzmani: faturaUzmaniAgent,
  muh_sekreter: sekreterAgent,
  muh_vergiUzmani: vergiUzmaniAgent,
  muh_tahsilatUzmani: tahsilatUzmaniAgent,
};
