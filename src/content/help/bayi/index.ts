import { parseHelpMarkdown, type HelpDoc } from "@/components/help/help-parser";
import tr from "./tr";
import en from "./en";
import nl from "./nl";

const SOURCE: Record<string, string> = { tr, en, nl };

/**
 * Bayi Kullanım Kılavuzu — locale göre parse edilmiş HelpDoc.
 * Bilinmeyen locale → TR fallback.
 */
export function getBayiHelpDoc(locale: string): HelpDoc {
  return parseHelpMarkdown(SOURCE[locale] ?? SOURCE.tr);
}
