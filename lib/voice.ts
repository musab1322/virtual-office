// اختيار صوت سعودي لكل موظف (أصوات نموذج Orpheus العربي على Groq)
const CORE_VOICES: Record<string, string> = {
  musaed: "fahad",
  othman: "sultan",
  faisal: "abdullah",
  abdulrahman: "fahad",
  khalid: "sultan",
  majed: "abdullah",
  nawaf: "sultan",
  latifa: "lulwa",
  ruqayya: "noura",
  sahar: "aisha",
  haya: "noura",
  muneera: "lulwa",
  reem: "aisha",
};
const MALE = ["fahad", "abdullah", "sultan"];
const FEMALE = ["lulwa", "aisha", "noura"];

export const VOICE_OPTIONS: Record<"m" | "f", { id: string; label: string }[]> = {
  m: [
    { id: "fahad", label: "فهد" },
    { id: "abdullah", label: "عبدالله" },
    { id: "sultan", label: "سلطان" },
  ],
  f: [
    { id: "lulwa", label: "لولوة" },
    { id: "aisha", label: "عائشة" },
    { id: "noura", label: "نورة" },
  ],
};

/** الصوت الثابت للموظف (أو الصوت الذي اختاره صاحب العمل له) */
export function voiceFor(p: { id: string; gender: "m" | "f"; voice?: string }) {
  if (p.voice && VOICE_OPTIONS[p.gender].some((v) => v.id === p.voice)) return p.voice;
  if (CORE_VOICES[p.id]) return CORE_VOICES[p.id];
  let h = 0;
  for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const list = p.gender === "f" ? FEMALE : MALE;
  return list[Math.abs(h) % list.length];
}

/** يقسم النص إلى مقاطع قصيرة (≤ 190 حرفاً) عند نهايات الجمل */
export function splitForSpeech(text: string, max = 190): string[] {
  const clean = text.replace(/[*#_`>|]/g, " ").replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?؟،\n]+[.!?؟،]?/g) ?? [clean];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    const piece = s.trim();
    if (!piece) continue;
    if ((cur + " " + piece).trim().length <= max) {
      cur = (cur + " " + piece).trim();
    } else {
      if (cur) out.push(cur);
      if (piece.length <= max) cur = piece;
      else {
        // جملة طويلة جداً: نقسمها على المسافات
        let chunk = "";
        for (const w of piece.split(" ")) {
          if ((chunk + " " + w).trim().length > max) {
            out.push(chunk.trim());
            chunk = w;
          } else chunk += " " + w;
        }
        cur = chunk.trim();
      }
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** مثل splitForSpeech لكن الجملة الأولى وحدها حتى يبدأ الصوت بأسرع وقت */
export function speechChunks(text: string, max = 190): string[] {
  const parts = splitForSpeech(text, max);
  if (!parts.length) return parts;
  const first = parts[0].match(/^[^.!?؟]+[.!?؟]/)?.[0]?.trim();
  if (first && first.length >= 12 && first.length < parts[0].length) {
    return [first, ...splitForSpeech(parts[0].slice(first.length), max), ...parts.slice(1)];
  }
  return parts;
}
