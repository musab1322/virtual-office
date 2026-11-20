// تحويل صوت المستخدم إلى نص من الخادم عبر Groq Whisper
// (لا يعتمد على دعم المتصفح للتعرف على الكلام، فيعمل على كل المتصفحات والجوال)
const BASE_URL = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
const STT_MODEL = process.env.STT_MODEL || "whisper-large-v3-turbo";
const MAX_BYTES = 10 * 1024 * 1024;

export const maxDuration = 30;

// عبارات يهلوس بها Whisper عند الصمت أو الضجيج
const HALLUCINATIONS = [/ترجمة نانسي/, /اشتركوا في القناة/, /شكرا للمشاهدة/, /شكراً للمشاهدة/, /موسيقى/, /^\s*[.،,!؟?]*\s*$/];

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: "GROQ_API_KEY غير موجود" }, { status: 500 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob) || file.size === 0) return Response.json({ error: "لا يوجد صوت" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "التسجيل طويل جداً" }, { status: 413 });

  const type = file.type || "audio/webm";
  const ext = type.includes("mp4") || type.includes("m4a") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  const out = new FormData();
  out.append("file", file, `speech.${ext}`);
  out.append("model", STT_MODEL);
  out.append("language", "ar");
  out.append("response_format", "json");
  out.append("temperature", "0");

  const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: out,
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return Response.json({ error: `تعذّر فهم الصوت (${res.status}): ${detail.slice(0, 300)}` }, { status: 502 });
  }
  const data = (await res.json().catch(() => ({}))) as { text?: string };
  let text = (data.text ?? "").trim();
  if (HALLUCINATIONS.some((r) => r.test(text))) text = "";
  return Response.json({ text });
}
