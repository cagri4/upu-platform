import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["tr", "en", "nl"],
  defaultLocale: "tr",
  localePrefix: "always",
});
