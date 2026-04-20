/**
 * Sahibinden single-listing scraper using ScrapingBee proxy API.
 * Solves: sahibinden.com blocks non-TR IPs + Cloudflare bot protection.
 * Uses ScrapingBee's extract_rules (CSS selectors) for robust extraction.
 */

const SCRAPINGBEE_BASE = "https://app.scrapingbee.com/api/v1";

export interface SahibindenDetails {
  title: string | null;
  price: number | null;
  area: number | null;      // m² brüt
  net_area: number | null;  // m² net
  rooms: string | null;
  floor: string | null;
  total_floors: string | null;
  building_age: string | null;
  heating: string | null;
  location_city: string | null;
  location_district: string | null;
  location_neighborhood: string | null;
  description: string | null;
  raw_html_head?: string;  // for debugging
}

function parseNum(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^\d]/g, "");
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

function clean(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > 0 ? t : null;
}

// Normalize label text (collapse whitespace, remove nbsp) so key matching is reliable
function labelKey(label: string): string {
  return label.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export async function scrapeSahibindenListing(url: string): Promise<SahibindenDetails | null> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    console.error("[scrape:sahibinden] SCRAPINGBEE_API_KEY not set");
    return null;
  }

  // ScrapingBee extract_rules — CSS selectors for reliable extraction.
  // Sahibinden key selectors (2026 layout):
  //  h1.classifiedDetailTitle       → title
  //  div.classifiedInfo h3          → price (e.g. "18.000.000 TL")
  //  ul.classifiedInfoList > li     → detail rows (strong=label, span=value)
  //  #classifiedDescription         → description
  //  h2 a (inside classifiedInfo)   → location breadcrumb links
  const extractRules = {
    title: "h1",
    price: "div.classifiedInfo h3",
    description: "#classifiedDescription",
    details: {
      selector: "ul.classifiedInfoList li",
      type: "list",
      output: {
        label: "strong",
        value: "span",
      },
    },
    location: {
      selector: "h2.classifiedInfo > a, .classifiedInfo h2 a",
      type: "list",
      output: "@text",
    },
  };

  const params = new URLSearchParams({
    api_key: apiKey,
    url,
    country_code: "tr",
    render_js: "false",
    extract_rules: JSON.stringify(extractRules),
  });

  try {
    const res = await fetch(`${SCRAPINGBEE_BASE}?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[scrape:sahibinden] API error:", res.status, body.substring(0, 300));
      return null;
    }
    const data = await res.json() as {
      title?: string;
      price?: string;
      description?: string;
      details?: Array<{ label?: string; value?: string }>;
      location?: string[];
    };

    // Build a label → value map from the detail rows
    const byLabel: Record<string, string> = {};
    for (const d of data.details || []) {
      const k = d.label ? labelKey(d.label) : "";
      const v = clean(d.value);
      if (k && v) byLabel[k] = v;
    }
    const getDetail = (label: string) => byLabel[labelKey(label)] ?? null;

    const loc = Array.isArray(data.location) ? data.location.map(x => clean(x)).filter(Boolean) as string[] : [];

    const result: SahibindenDetails = {
      title: clean(data.title),
      price: parseNum(data.price),
      area: parseNum(getDetail("m² (Brüt)")),
      net_area: parseNum(getDetail("m² (Net)")),
      rooms: getDetail("Oda Sayısı"),
      floor: getDetail("Bulunduğu Kat"),
      total_floors: getDetail("Binanın Kat Sayısı"),
      building_age: getDetail("Bina Yaşı"),
      heating: getDetail("Isıtma"),
      location_city: loc[0] || null,
      location_district: loc[1] || null,
      location_neighborhood: loc[2] || null,
      description: clean(data.description)?.substring(0, 2000) || null,
    };

    console.log("[scrape:sahibinden] extracted:", {
      title: result.title?.substring(0, 50),
      price: result.price,
      area: result.area,
      detailKeys: Object.keys(byLabel),
      locCount: loc.length,
    });

    return result;
  } catch (err) {
    console.error("[scrape:sahibinden] fetch error:", err);
    return null;
  }
}
