// نطق عربي من الخادم عبر Groq (لا يعتمد على الأصوات المثبتة في جهاز المستخدم)
const BASE_URL = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
const TTS_MODEL = process.env.TTS_MODEL || "canopylabs/orpheus-arabic-saudi";
const VOICES = ["abdullah", "fahad", "sultan", "lulwa", "noura", "aisha"];
const MAX_CHARS = 200; // حد النموذج لكل طلب

export const maxDuration = 30;

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: "GROQ_API_KEY غير موجود" }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { text?: unknown; voice?: unknown };
  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  const voice = typeof body.voice === "string" && VOICES.includes(body.voice) ? body.voice : "fahad";
  if (!text) return Response.json({ error: "لا يوجد نص" }, { status: 400 });

  const res = await fetch(`${BASE_URL}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: TTS_MODEL, input: text, voice, response_format: "wav" }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return Response.json({ error: `تعذّر توليد الصوت (${res.status}): ${detail.slice(0, 300)}` }, { status: 502 });
  }
  return new Response(res.body, {
    headers: { "Content-Type": res.headers.get("content-type") || "audio/wav", "Cache-Control": "no-store" },
  });
}
