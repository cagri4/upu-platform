import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

export async function askClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return ""; // AI disabled — graceful fallback
  }
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : "";
  } catch (err) {
    console.error("[ai:claude] error:", err);
    return "";
  }
}

// ── Property description generator ──────────────────────────────────────

export async function generatePropertyDescription(data: Record<string, unknown>): Promise<string> {
  const details = Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return askClaude(
    "Sen bir emlak danışmanısın. Verilen mülk bilgilerini kullanarak Türkçe, satış odaklı, etkileyici bir ilan açıklaması yaz. " +
    "3-4 paragraf, profesyonel ama sıcak ton. Mülkün öne çıkan özelliklerini vurgula. " +
    "Sadece açıklama metnini yaz, başlık veya fiyat yazma.",
    `Mülk bilgileri:\n${details}`,
    800,
  );
}

// ── Tool-using Claude call (for agent engine) ─────────────────────────

export async function askClaudeWithTools(
  systemPrompt: string,
  userMessage: string,
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
  maxTokens = 1024,
): Promise<{ text: string; toolCall: { name: string; input: Record<string, unknown> } | null }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { text: "", toolCall: null };
  }
  try {
    const anthropicTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool.InputSchema,
    }));

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: anthropicTools,
    });

    let text = "";
    let toolCall: { name: string; input: Record<string, unknown> } | null = null;

    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      } else if (block.type === "tool_use") {
        toolCall = { name: block.name, input: block.input as Record<string, unknown> };
      }
    }

    return { text, toolCall };
  } catch (err) {
    console.error("[ai:claude:tools] error:", err);
    return { text: "", toolCall: null };
  }
}

export async function detectIntent(text: string): Promise<{ command: string; args: string; confidence: number } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const response = await askClaude(
      `Sen bir emlak ofisi WhatsApp asistanisn. Kullanicinin mesajini analiz et ve hangi komutu tetiklemesi gerektigini belirle.

Mevcut komutlar:
- portfoyum: portfolyo ozeti
- mulkekle: yeni mulk ekleme
- mulkdetay: mulk detayi gorme
- mulkduzenle: mulk duzenleme
- mulksil: mulk silme
- tara: sahibinden URL'den mulk yukleme
- musterilerim: musteri listesi
- musteriEkle: yeni musteri ekleme
- eslestir: musteri-mulk eslestirme
- hatirlatma: hatirlatma olusturma
- fiyatsor: bolge fiyat sorgusu (arguman: bolge adi)
- degerle: mulk degerleme
- mulkoner: butceye gore mulk onerisi
- analiz: pazar analizi
- rapor: aylik rapor
- trend: pazar trendi
- brifing: gunluk brifing
- gorevler: gorev listesi
- sozlesme: sozlesme olusturma
- sozlesmelerim: sozlesme listesi
- satistavsiye: satis tavsiyesi
- menu: ana menu

JSON formatinda yanit ver: {"command": "komut_adi", "args": "varsa arguman", "confidence": 0.0-1.0}
Eger hicbir komutla eslesmiyorsa: {"command": "", "args": "", "confidence": 0.0}`,
      text,
      256,
    );
    const clean = response.trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}
