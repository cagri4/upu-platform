/**
 * Bayi Agent Registry — single UPU assistant (post-pivot).
 *
 * The former 8 virtual employees (asistan, satisMuduru, satisTemsilcisi,
 * muhasebeci, tahsildar, depocu, lojistikci, urunYoneticisi) were
 * collapsed into bayi_upu. Their tools are merged; menus are now
 * capability-filtered at the WA command layer rather than by agent key.
 */

import type { AgentDefinition } from "@/platform/agents/types";
import { bayiUpuAgent } from "./bayi-upu";

export const bayiAgents: Record<string, AgentDefinition> = {
  bayi_upu: bayiUpuAgent,
};
