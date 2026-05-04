/**
 * Sektör dataset dispatcher.
 *
 * profile.metadata.firma_profili.sektor → uygun dataset.
 * "diger" / unknown → boya default (genel-amaçlı, en zengin görselli set).
 */

import type { SectorDataset } from "./types";
import { boyaDataset } from "./boya";
import { gidaDataset } from "./gida";
import { hirdavatDataset } from "./hirdavat";
import { tekstilDataset } from "./tekstil";
import { temizlikDataset } from "./temizlik";

const REGISTRY: Record<string, SectorDataset> = {
  boya: boyaDataset,
  gida: gidaDataset,
  hirdavat: hirdavatDataset,
  tekstil: tekstilDataset,
  temizlik: temizlikDataset,
};

export function getSectorDataset(sector: string | undefined | null): SectorDataset {
  if (!sector) {
    console.warn(`[sectors] sector boş — boya default kullanılıyor`);
    return boyaDataset;
  }
  const slug = sector.toLowerCase().trim();
  const ds = REGISTRY[slug];
  if (ds) return ds;
  console.warn(`[sectors] unknown sector "${sector}" — boya default kullanılıyor`);
  return boyaDataset;
}

export function listSectorSlugs(): string[] {
  return Object.keys(REGISTRY);
}

export type { SectorDataset } from "./types";
