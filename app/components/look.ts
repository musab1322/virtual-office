// مظهر الشخصيات (مشترك بين المشهد ثلاثي الأبعاد والصور الرمزية)
export const SKIN_TONES = ["#f3d2b3", "#efc9a6", "#f6dcc4"]; // بشرة فاتحة للجميع

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// الفريق الأساسي: تنويع ثابت بين الشماغ الأحمر والغترة البيضاء
const CORE_RED: Record<string, boolean> = { musab: true, kareem: true, omar: false };

/** الشماغ يتنوع بين الأحمر والغترة البيضاء؛ مصعب دائماً بالأحمر */
export function personLook(p: { id: string; manager?: boolean }) {
  const h = hash(p.id);
  return {
    hash: h,
    skin: SKIN_TONES[h % SKIN_TONES.length],
    redShemagh: p.manager ? true : (CORE_RED[p.id] ?? (h >> 3) % 2 === 0),
  };
}
