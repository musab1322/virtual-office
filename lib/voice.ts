// اختيار صوت سعودي لكل موظف (أصوات نموذج Orpheus العربي على Groq)
const CORE_VOICES: Record<string, string> = { kareem: "sultan", omar: "abdullah", mona: "noura", musab: "fahad" };
const MALE = ["fahad", "abdullah", "sultan"];
const FEMALE = ["lulwa", "aisha", "noura"];

export function voiceFor(p: { id: string; gender: "m" | "f" }) {
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
