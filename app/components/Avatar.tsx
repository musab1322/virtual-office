// صورة رمزية سعودية مبسطة (SVG): شماغ أحمر وعقال للرجال، وطرحة سوداء للنساء
import { personLook } from "./look";

export default function Avatar({
  person,
  size = 64,
  speaking = false,
  mouth = 0,
  blink = false,
  ring = true,
}: {
  person: { id: string; gender: "m" | "f"; color: string; manager?: boolean; photo?: string };
  size?: number;
  speaking?: boolean;
  /** فتحة الفم من 0 إلى 1 (لتحريك الشفاه أثناء الكلام) */
  mouth?: number;
  /** إغماض العينين (رمش) */
  blink?: boolean;
  ring?: boolean;
}) {
  const open = Math.max(0, Math.min(1, mouth));
  const eye = (cx: number, cy: number) =>
    blink ? (
      <path d={`M${cx - 2.6} ${cy} Q${cx} ${cy + 1.4} ${cx + 2.6} ${cy}`} stroke="#111" strokeWidth="1.4" fill="none" />
    ) : (
      <circle cx={cx} cy={cy} r="2.4" fill="#111" />
    );
  const { gender, color } = person;
  const { skin, redShemagh } = personLook(person);
  const pid = `sh-${person.id}`;
  return (
    <div
      className={`relative inline-grid place-items-center rounded-full ${speaking ? "avatar-speaking" : ""}`}
      style={{ width: size, height: size, background: color + "22", boxShadow: ring ? `0 0 0 3px ${color}` : undefined }}
    >
      {person.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photo}
          alt=""
          className="rounded-full object-cover"
          style={{
            width: size * 0.92,
            height: size * 0.92,
            transform: open > 0.05 ? `scale(${1 + open * 0.025})` : undefined,
            filter: blink ? "brightness(0.97)" : undefined,
          }}
        />
      ) : (
      <svg viewBox="0 0 100 100" width={size * 0.86} height={size * 0.86} aria-hidden>
        <defs>
          <pattern id={pid} width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#fff" />
            <rect width="5" height="10" fill="#c4161c" />
            <rect width="10" height="5" fill="#c4161c" />
          </pattern>
        </defs>
        {gender === "m" ? (
          <>
            {/* ثوب، وبشت للمدير */}
            <path d="M14 100 Q16 74 50 70 Q84 74 86 100 Z" fill={person.manager ? "#2a1f17" : "#f7f7f4"} stroke="#ddd" />
            <path d="M38 100 L42 72 L58 72 L62 100 Z" fill="#f7f7f4" />
            {person.manager && <path d="M40 100 L43 74" stroke="#d4a72c" strokeWidth="2" />}
            {person.manager && <path d="M60 100 L57 74" stroke="#d4a72c" strokeWidth="2" />}
            {/* شماغ */}
            <path d="M22 50 Q20 16 50 14 Q80 16 78 50 L84 78 L16 78 Z" fill={redShemagh ? `url(#${pid})` : "#ffffff"} stroke="#ddd" strokeWidth="1" />
            <ellipse cx="50" cy="50" rx="19" ry="23" fill={skin} />
            <path d="M33 56 Q50 80 67 56 Q66 70 50 74 Q34 70 33 56 Z" fill="#1c1612" />
            {open > 0.05 && <ellipse cx="50" cy="62" rx={4 + open * 2} ry={0.8 + open * 4} fill="#3a0d0d" stroke="#c0605a" strokeWidth="1.4" />}
            <rect x="42" y="56" width="16" height="3" rx="1.5" fill="#1c1612" />
            {eye(43, 47)}
            {eye(57, 47)}
            {/* عقال */}
            <ellipse cx="50" cy="22" rx="24" ry="6" fill="none" stroke="#111" strokeWidth="4" />
          </>
        ) : (
          <>
            <path d="M14 100 Q16 72 50 68 Q84 72 86 100 Z" fill="#16161a" />
            <path d="M24 56 Q20 14 50 12 Q80 14 76 56 Q78 76 50 80 Q22 76 24 56 Z" fill="#16161a" />
            <ellipse cx="50" cy="48" rx="17" ry="21" fill={skin} />
            {eye(43, 46)}
            {eye(57, 46)}
            {open > 0.05 ? (
              <ellipse cx="50" cy="59" rx={3.5 + open * 2} ry={0.8 + open * 3.6} fill="#6b2a24" stroke="#8a4b3a" strokeWidth="1" />
            ) : (
              <path d="M44 58 Q50 62 56 58" stroke="#8a4b3a" strokeWidth="2" fill="none" strokeLinecap="round" />
            )}
          </>
        )}
      </svg>
      )}
    </div>
  );
}
