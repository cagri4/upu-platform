/**
 * Market Agent Registry — all 3 autonomous agents
 */

import type { AgentDefinition } from "@/platform/agents/types";
import { stokSorumlusuAgent } from "./stok-sorumlusu";
import { siparisYoneticisiAgent } from "./siparis-yoneticisi";
import { finansAnalistiAgent } from "./finans-analisti";

export const marketAgents: Record<string, AgentDefinition> = {
  mkt_stokSorumlusu: stokSorumlusuAgent,
  mkt_siparisYoneticisi: siparisYoneticisiAgent,
  mkt_finansAnalisti: finansAnalistiAgent,
};
