/**
 * Bayi İlk Karşılama config — saf-pasif 6 slayt (Faz 1B, 2026-05-29).
 *
 * Tasarım: input YOK. Kullanıcı sadece "İleri / Geri / Atla" görür.
 * Son slayt "Kurucu ile Başla" → onCompleted → layout Kurucu AI Eleman
 * widget'ını otomatik açar (Faz 1C).
 *
 * ESKİ İNPUT ADIMLARI (Step2Profile, Step3InviteDealer, Step4Vitrine,
 * Step5Complete) artık burada KULLANILMIYOR. Profil / davet / vitrin /
 * tamamlama akışları Kurucu sohbet ekibine devredildi (Faz 2 — Kurucu).
 * Component dosyaları kaldırılmadı (gelecekte tekrar kullanım potansiyeli
 * + git diff temiz tutmak için).
 *
 * Diğer 5 SaaS (emlak/market/otel/restoran/site) aynı pattern ile kendi
 * <tenant>/onboarding-config.ts dosyalarını yazar — engine ortak.
 */
import type { OnboardingConfig } from "@/platform/onboarding/engine";
import {
  SlideWelcome,
  SlideDealerManagement,
  SlideVitrineLead,
  SlideAutomation,
  SlideAITeam,
  SlideStart,
} from "@/components/onboarding/bayi/intro-slides";

export const BAYI_ONBOARDING: OnboardingConfig = {
  tenantKey: "bayi",
  totalSteps: 6,
  steps: [
    { id: "welcome",          title: "Hoşgeldin",     component: SlideWelcome,          skippable: true },
    { id: "dealer_management", title: "Yönetim",      component: SlideDealerManagement, skippable: true },
    { id: "vitrine_lead",     title: "Vitrin",        component: SlideVitrineLead,      skippable: true },
    { id: "automation",       title: "Otomasyon",     component: SlideAutomation,       skippable: true },
    { id: "ai_team",          title: "AI Eleman",     component: SlideAITeam,           skippable: true },
    { id: "start",            title: "Başla",         component: SlideStart,            skippable: false },
  ],
};
