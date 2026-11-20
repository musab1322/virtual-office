// صورة رمزية سعودية مبسطة (SVG): شماغ أحمر وعقال للرجال، وطرحة سوداء للنساء
export default function Avatar({
  gender,
  color,
  size = 64,
  speaking = false,
}: {
  gender: "m" | "f";
  color: string;
  size?: number;
  speaking?: boolean;
}) {
  return (
    <div
      className={`relative inline-grid place-items-center rounded-full ${speaking ? "avatar-speaking" : ""}`}
      style={{ width: size, height: size, background: color + "22", boxShadow: `0 0 0 3px ${color}` }}
    >
      <svg viewBox="0 0 100 100" width={size * 0.86} height={size * 0.86} aria-hidden>
        <defs>
          <pattern id="shemagh" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#fff" />
            <rect width="5" height="10" fill="#c4161c" />
            <rect width="10" height="5" fill="#c4161c" />
          </pattern>
        </defs>
        {gender === "m" ? (
          <>
            {/* بشت وثوب */}
            <path d="M14 100 Q16 74 50 70 Q84 74 86 100 Z" fill="#2a1f17" />
            <path d="M38 100 L42 72 L58 72 L62 100 Z" fill="#f7f7f4" />
            <path d="M40 100 L43 74" stroke="#d4a72c" strokeWidth="2" />
            <path d="M60 100 L57 74" stroke="#d4a72c" strokeWidth="2" />
            {/* شماغ */}
            <path d="M22 50 Q20 16 50 14 Q80 16 78 50 L84 78 L16 78 Z" fill="url(#shemagh)" />
            <ellipse cx="50" cy="50" rx="19" ry="23" fill="#c98f65" />
            <path d="M33 56 Q50 80 67 56 Q66 70 50 74 Q34 70 33 56 Z" fill="#1c1612" />
            <rect x="42" y="56" width="16" height="3" rx="1.5" fill="#1c1612" />
            <circle cx="43" cy="47" r="2.4" fill="#111" />
            <circle cx="57" cy="47" r="2.4" fill="#111" />
            {/* عقال */}
            <ellipse cx="50" cy="22" rx="24" ry="6" fill="none" stroke="#111" strokeWidth="4" />
          </>
        ) : (
          <>
            <path d="M14 100 Q16 72 50 68 Q84 72 86 100 Z" fill="#16161a" />
            <path d="M24 56 Q20 14 50 12 Q80 14 76 56 Q78 76 50 80 Q22 76 24 56 Z" fill="#16161a" />
            <ellipse cx="50" cy="48" rx="17" ry="21" fill="#d9a47c" />
            <circle cx="43" cy="46" r="2.4" fill="#111" />
            <circle cx="57" cy="46" r="2.4" fill="#111" />
            <path d="M44 58 Q50 62 56 58" stroke="#8a4b3a" strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        )}
      </svg>
    </div>
  );
}
