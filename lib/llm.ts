// عميل بسيط لـ Groq (واجهة متوافقة مع OpenAI). يمكن تغيير المزود من متغيرات البيئة.
const BASE_URL = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
const MODEL = process.env.LLM_MODEL || "llama-3.3-70b-versatile";
// نموذج بحث مع إنترنت (Groq Compound فيه بحث ويب مدمج)؛ يمكن تغييره بـ RESEARCH_MODEL
const RESEARCH_MODEL = process.env.RESEARCH_MODEL || "groq/compound-mini";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; json?: boolean; maxTokens?: number; model?: string } = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY غير موجود في متغيرات البيئة");

  // نعيد المحاولة عند تجاوز حد الطلبات (429) بانتظار قصير
  let res: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model || MODEL,
      messages,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 1500,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
    });
    if (res.status !== 429 || attempt === 3) break;
    const wait = Math.min(Number(res.headers.get("retry-after")) || 2 ** attempt * 2, 20);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  if (!res) throw new Error("LLM request failed");

  if (!res.ok) {
    throw new Error(`LLM error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned an empty response");
  return content;
}

/**
 * بحث فعلي في الإنترنت عبر نموذج Groq Compound (يبحث ويقرأ المصادر ثم يجيب).
 * إذا لم يتوفر النموذج نرجع للنموذج العادي من معرفته، مع ذكر ذلك.
 */
export async function research(
  messages: ChatMessage[],
  opts: { maxTokens?: number } = {}
): Promise<{ text: string; web: boolean }> {
  try {
    const text = await chat(messages, { model: RESEARCH_MODEL, maxTokens: opts.maxTokens ?? 1500, temperature: 0.3 });
    return { text, web: true };
  } catch {
    const text = await chat(
      [
        ...messages.slice(0, -1),
        {
          role: "user",
          content: `${messages[messages.length - 1].content}\n\n(البحث في الإنترنت غير متاح الآن: اعتمد على معرفتك، ونبّه أن المعلومات تحتاج تحققاً من مصادر حديثة.)`,
        },
      ],
      { maxTokens: opts.maxTokens ?? 1500 }
    );
    return { text, web: false };
  }
}
