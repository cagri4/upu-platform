/**
 * Onboarding wizard engine — tenant-agnostic infra.
 *
 * Her tenant kendi `<tenant>/onboarding-config.ts` adapter'ı yazar:
 *   import type { OnboardingConfig } from "@/platform/onboarding/engine";
 *   import { Step1, Step2, ... } from "@/components/onboarding/bayi";
 *
 *   export const BAYI_ONBOARDING: OnboardingConfig = {
 *     tenantKey: "bayi",
 *     totalSteps: 5,
 *     steps: [
 *       { id: "welcome", title: "Hoşgeldin", component: Step1, skippable: false },
 *       ...
 *     ],
 *   };
 *
 * Wizard component bu config'i tüketir; aynı UI tüm tenant'larda.
 * DB state profiles.onboarding_completed + onboarding_step + onboarding_skipped_at
 * (yatay migration).
 */
import type { ComponentType } from "react";

export interface OnboardingStepContext {
  /** Current step index (0-based) */
  index: number;
  /** Total step count */
  total: number;
  /** Go to next step (validates if step has required action) */
  next: () => void | Promise<void>;
  /** Go to previous step */
  back: () => void;
  /** Skip current step (only if step.skippable) */
  skip: () => void | Promise<void>;
  /** Mark wizard fully completed (final step) */
  complete: () => void | Promise<void>;
  /** Close wizard without marking completed (e.g. "Sonra yapayım") */
  dismiss: () => void;
  /** Shared state across steps */
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
}

export interface OnboardingStep {
  /** Stable identifier (used in DB + analytics) */
  id: string;
  /** Display title in stepper indicator */
  title: string;
  /** React component rendered for this step */
  component: ComponentType<OnboardingStepContext>;
  /** Can the user skip this step entirely? Default false. */
  skippable?: boolean;
}

export interface OnboardingConfig {
  tenantKey: string;
  totalSteps: number;
  steps: OnboardingStep[];
  /** Optional final completion message override */
  completionMessage?: string;
}

export function getStepByIndex(config: OnboardingConfig, idx: number): OnboardingStep | null {
  return config.steps[idx] || null;
}
