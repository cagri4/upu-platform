/**
 * Bayi Agent Registry — all 8 autonomous agents
 */

import type { AgentDefinition } from "@/platform/agents/types";
import { asistanAgent } from "./asistan";
import { satisMuduruAgent } from "./satis-muduru";
import { satisTemsilcisiAgent } from "./satis-temsilcisi";
import { muhasebeciAgent } from "./muhasebeci";
import { tahsildarAgent } from "./tahsildar";
import { depocuAgent } from "./depocu";
import { lojistikciAgent } from "./lojistikci";
import { urunYoneticisiAgent } from "./urun-yoneticisi";

export const bayiAgents: Record<string, AgentDefinition> = {
  bayi_asistan: asistanAgent,
  bayi_satisMuduru: satisMuduruAgent,
  bayi_satisTemsilcisi: satisTemsilcisiAgent,
  bayi_muhasebeci: muhasebeciAgent,
  bayi_tahsildar: tahsildarAgent,
  bayi_depocu: depocuAgent,
  bayi_lojistikci: lojistikciAgent,
  bayi_urunYoneticisi: urunYoneticisiAgent,
};
