/**
 * Anthropic API maliyet hesaplama — model pricing tablosu + cost calculator.
 *
 * Pricing kaynak: docs.anthropic.com/en/docs/about-claude/pricing
 * (USD / 1M token). Cache read tokens %90 indirimli (ephemeral cache).
 */

interface ModelPricing {
  input_per_1m: number;
  output_per_1m: number;
  cache_read_per_1m: number;
  cache_write_per_1m: number;
}

const PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-6": {
    input_per_1m: 3,
    output_per_1m: 15,
    cache_read_per_1m: 0.30,
    cache_write_per_1m: 3.75,
  },
  "claude-haiku-4-5-20251001": {
    input_per_1m: 0.25,
    output_per_1m: 1.25,
    cache_read_per_1m: 0.025,
    cache_write_per_1m: 0.3125,
  },
};

const DEFAULT_MODEL = "claude-sonnet-4-6";

export function calculateCostUsd(
  model: string,
  input: number,
  output: number,
  cacheRead: number = 0,
  cacheWrite: number = 0,
): number {
  const p = PRICING[model] || PRICING[DEFAULT_MODEL];
  return (
    (input * p.input_per_1m) / 1_000_000 +
    (output * p.output_per_1m) / 1_000_000 +
    (cacheRead * p.cache_read_per_1m) / 1_000_000 +
    (cacheWrite * p.cache_write_per_1m) / 1_000_000
  );
}
