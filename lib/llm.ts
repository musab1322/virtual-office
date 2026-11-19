// عميل بسيط لـ Groq (واجهة متوافقة مع OpenAI). يمكن تغيير المزود من متغيرات البيئة.
const BASE_URL = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
const MODEL = process.env.LLM_MODEL || "llama-3.3-70b-versatile";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; json?: boolean; maxTokens?: number } = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY غير موجود في متغيرات البيئة");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 1500,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    throw new Error(`LLM error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned an empty response");
  return content;
}
