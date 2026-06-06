/**
 * Minimal markdown parser — Kullanım Kılavuzu için. Statik içerik kontrolde,
 * react-markdown dependency'sini avoid eder.
 *
 * Desteklenenler:
 *   - # (page title — ilk satırda, body'den ayrılır)
 *   - ## Bölüm başlığı  → yeni section
 *   - ### Alt başlık
 *   - - liste maddesi  (- veya *)
 *   - **bold** (inline)
 *   - [link](url) (inline)
 *   - boş satır → paragraph break
 *
 * Çıktı: { title, sections: [{ id, title, blocks: Block[] }] }
 *
 * Block tipleri renderer tarafında HTML'e çevrilir.
 */

export type HelpBlock =
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

export interface HelpSection {
  id: string;
  title: string;
  blocks: HelpBlock[];
}

export interface HelpDoc {
  title: string;
  sections: HelpSection[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseHelpMarkdown(md: string): HelpDoc {
  const lines = md.split(/\r?\n/);
  let title = "";
  const sections: HelpSection[] = [];
  let current: HelpSection | null = null;
  let listBuf: string[] | null = null;
  let paraBuf: string[] = [];

  function flushPara() {
    if (paraBuf.length) {
      const text = paraBuf.join(" ").trim();
      if (text && current) current.blocks.push({ type: "p", text });
      paraBuf = [];
    }
  }
  function flushList() {
    if (listBuf && listBuf.length && current) {
      current.blocks.push({ type: "ul", items: listBuf });
    }
    listBuf = null;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith("# ") && !title) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      flushPara();
      flushList();
      const t = line.slice(3).trim();
      current = { id: slugify(t), title: t, blocks: [] };
      sections.push(current);
      continue;
    }
    if (line.startsWith("### ")) {
      flushPara();
      flushList();
      const t = line.slice(4).trim();
      if (current) current.blocks.push({ type: "h3", text: t });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      listBuf = listBuf ?? [];
      listBuf.push(line.replace(/^\s*[-*]\s+/, "").trim());
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      flushList();
      continue;
    }
    flushList();
    paraBuf.push(line.trim());
  }
  flushPara();
  flushList();

  return { title, sections };
}

/**
 * Inline render: **bold** + [text](url) → React-safe markup için string'leri
 * token'lara çevirir. Component tarafında <strong>/<a>/text render edilir.
 */
export type InlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        tokens.push({ type: "bold", text: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "[") {
      const close = text.indexOf("]", i + 1);
      if (close !== -1 && text[close + 1] === "(") {
        const urlEnd = text.indexOf(")", close + 2);
        if (urlEnd !== -1) {
          tokens.push({
            type: "link",
            text: text.slice(i + 1, close),
            href: text.slice(close + 2, urlEnd),
          });
          i = urlEnd + 1;
          continue;
        }
      }
    }
    // collect until next special
    let j = i;
    while (j < text.length) {
      if (text[j] === "*" && text[j + 1] === "*") break;
      if (text[j] === "[") break;
      j++;
    }
    tokens.push({ type: "text", text: text.slice(i, j) });
    i = j;
  }
  return tokens.filter((t) => t.type !== "text" || t.text.length > 0);
}
