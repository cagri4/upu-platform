/**
 * Sahibinden single-listing scraper using ScrapingBee proxy API.
 * Solves: sahibinden.com blocks non-TR IPs + Cloudflare bot protection.
 * ScrapingBee free tier: 1000 requests/month — plenty for ad-hoc user additions.
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
}

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, "");
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

function extractField(html: string, label: string): string | null {
  const re = new RegExp(
    `<strong>\\s*${label}\\s*</strong>[\\s\\S]*?<span[^>]*>([^<]+)</span>`,
    "i",
  );
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<h1[^>]*class="[^"]*classifiedDetailTitle[^"]*"[^>]*>([^<]+)<\/h1>/i)
         || html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  return m ? m[1].trim() : null;
}

function extractPrice(html: string): number | null {
  const m = html.match(/<div[^>]*class="[^"]*classifiedPrice[^"]*"[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>/i)
         || html.match(/<h3[^>]*>([\d.,\s]+TL)<\/h3>/i);
  return m ? parsePrice(m[1]) : null;
}

function extractLocation(html: string): { city: string | null; district: string | null; neighborhood: string | null } {
  // Sahibinden shows breadcrumbs: İlan konumu: Muğla / Bodrum / Yalıkavak Mh.
  const m = html.match(/İlan konumu[\s\S]{0,200}?<a[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
  if (m) return { city: m[1].trim(), district: m[2].trim(), neighborhood: m[3].trim() };
  return { city: null, district: null, neighborhood: null };
}

function extractDescription(html: string): string | null {
  const m = html.match(/<div[^>]*id="classifiedDescription"[^>]*>([\s\S]*?)<\/div>/i);
  if (!m) return null;
  const text = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.substring(0, 2000) || null;
}

export async function scrapeSahibindenListing(url: string): Promise<SahibindenDetails | null> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    console.error("[scrape:sahibinden] SCRAPINGBEE_API_KEY not set");
    return null;
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    url,
    country_code: "tr",
    render_js: "false",
  });

  try {
    const res = await fetch(`${SCRAPINGBEE_BASE}?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[scrape:sahibinden] API error:", res.status, await res.text());
      return null;
    }
    const html = await res.text();

    const areaRaw = extractField(html, "m² \\(Brüt\\)");
    const netAreaRaw = extractField(html, "m² \\(Net\\)");
    const loc = extractLocation(html);

    return {
      title: extractTitle(html),
      price: extractPrice(html),
      area: areaRaw ? parseInt(areaRaw.replace(/[^\d]/g, ""), 10) || null : null,
      net_area: netAreaRaw ? parseInt(netAreaRaw.replace(/[^\d]/g, ""), 10) || null : null,
      rooms: extractField(html, "Oda Sayısı"),
      floor: extractField(html, "Bulunduğu Kat"),
      total_floors: extractField(html, "Binanın Kat Sayısı"),
      building_age: extractField(html, "Bina Yaşı"),
      heating: extractField(html, "Isıtma"),
      location_city: loc.city,
      location_district: loc.district,
      location_neighborhood: loc.neighborhood,
      description: extractDescription(html),
    };
  } catch (err) {
    console.error("[scrape:sahibinden] fetch error:", err);
    return null;
  }
}
