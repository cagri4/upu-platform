"use client";

/**
 * Generic onboarding wizard host (tenant-agnostic).
 *
 * Props:
 *   config: OnboardingConfig — tenant adapter dosyasından gelir
 *   onClose: () => void — dismiss callback (parent layout)
 *   initialStep?: number — DB'den son kalınan adım
 *   initialState?: Record<string, unknown> — displayName, firmaUnvani vb.
 *
 * UI:
 *   Full-screen modal (mobile-first). Stepper indicator üstte, aktif
 *   step component ortada, navigasyon footer'da step component'in içinde.
 *   ESC veya backdrop tıklama → dismiss (skip yapmaz, completed işaretlemez).
 *
 * State persist:
 *   - next/skip → POST /api/bayi-onboarding/state { step }
 *   - complete → POST /api/bayi-onboarding/complete
 *   - dismiss → close only (kalıcılık yok; tekrar açılır)
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { OnboardingConfig, OnboardingStepContext } from "@/platform/onboarding/engine";

interface OnboardingWizardProps {
  config: OnboardingConfig;
  onClose: () => void;
  onCompleted: () => void;
  initialStep?: number;
  initialState?: Record<string, unknown>;
  stateApi?: string;
  completeApi?: string;
}

export function OnboardingWizard({
  config,
  onClose,
  onCompleted,
  initialStep = 0,
  initialState = {},
  stateApi = "/api/bayi-onboarding/state",
  completeApi = "/api/bayi-onboarding/complete",
}: OnboardingWizardProps) {
  const [index, setIndex] = useState(Math.min(initialStep, config.steps.length - 1));
  const [state, setStateRaw] = useState<Record<string, unknown>>(initialState);

  // ESC → dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, []);

  async function persistStep(newIndex: number, opts?: { skipped?: boolean }) {
    try {
      await fetch(stateApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ step: newIndex, skipped: opts?.skipped || false }),
      });
    } catch (err) {
      console.error("[onboarding:persistStep]", err);
    }
  }

  async function persistComplete() {
    try {
      await fetch(completeApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
    } catch (err) {
      console.error("[onboarding:persistComplete]", err);
    }
  }

  function setState(patch: Record<string, unknown>) {
    setStateRaw(prev => ({ ...prev, ...patch }));
  }

  async function next() {
    const newIdx = Math.min(index + 1, config.steps.length - 1);
    setIndex(newIdx);
    await persistStep(newIdx);
  }

  function back() {
    setIndex(i => Math.max(0, i - 1));
  }

  async function skip() {
    const step = config.steps[index];
    if (!step?.skippable) return;
    const newIdx = Math.min(index + 1, config.steps.length - 1);
    setIndex(newIdx);
    await persistStep(newIdx, { skipped: true });
  }

  async function complete() {
    await persistComplete();
    onCompleted();
  }

  const step = config.steps[index];
  if (!step) return null;

  const StepComponent = step.component;
  const ctx: OnboardingStepContext = {
    index,
    total: config.totalSteps,
    next,
    back,
    skip,
    complete,
    dismiss: onClose,
    state,
    setState,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog" aria-modal="true">
      <div className="relative w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex-1">
            <Stepper current={index} total={config.totalSteps} steps={config.steps} />
          </div>
          <button onClick={onClose}
            className="ml-3 rounded-full w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Kapat">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step body */}
        <div className="flex-1">
          <StepComponent {...ctx} />
        </div>
      </div>
    </div>
  );
}

function Stepper({ current, total, steps }: { current: number; total: number; steps: Array<{ id: string; title: string }> }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-slate-500">
          Adım {current + 1} / {total}
        </span>
        <span className="text-[11px] text-slate-500">{steps[current]?.title}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i}
            className={`flex-1 h-1.5 rounded-full ${i <= current ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"}`} />
        ))}
      </div>
    </div>
  );
}
