/**
 * Otel Agent Registry — all 4 autonomous agents
 */

import type { AgentDefinition } from "@/platform/agents/types";
import { resepsiyonAgent } from "./resepsiyon";
import { rezervasyonAgent } from "./rezervasyon";
import { katHizmetleriAgent } from "./kat-hizmetleri";
import { misafirDeneyimiAgent } from "./misafir-deneyimi";

export const otelAgents: Record<string, AgentDefinition> = {
  otel_resepsiyon: resepsiyonAgent,
  otel_rezervasyon: rezervasyonAgent,
  otel_katHizmetleri: katHizmetleriAgent,
  otel_misafirDeneyimi: misafirDeneyimiAgent,
};
