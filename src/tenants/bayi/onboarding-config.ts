/**
 * Bayi onboarding wizard config — engine'in tüketeceği adım listesi.
 * Diğer 5 SaaS (emlak/market/otel/restoran/site) aynı pattern ile
 * kendi <tenant>/onboarding-config.ts dosyalarını yazar.
 */
import type { OnboardingConfig } from "@/platform/onboarding/engine";
import { Step1Welcome } from "@/components/onboarding/bayi/Step1Welcome";
import { Step2Profile } from "@/components/onboarding/bayi/Step2Profile";
import { Step3InviteDealer } from "@/components/onboarding/bayi/Step3InviteDealer";
import { Step4Vitrine } from "@/components/onboarding/bayi/Step4Vitrine";
import { Step5Complete } from "@/components/onboarding/bayi/Step5Complete";

export const BAYI_ONBOARDING: OnboardingConfig = {
  tenantKey: "bayi",
  totalSteps: 5,
  steps: [
    { id: "welcome", title: "Hoşgeldin", component: Step1Welcome, skippable: false },
    { id: "profile", title: "Profil", component: Step2Profile, skippable: true },
    { id: "invite_dealer", title: "İlk bayi", component: Step3InviteDealer, skippable: true },
    { id: "vitrine", title: "Vitrin", component: Step4Vitrine, skippable: true },
    { id: "complete", title: "Tamamla", component: Step5Complete, skippable: false },
  ],
};
