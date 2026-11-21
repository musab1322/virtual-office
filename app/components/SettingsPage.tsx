"use client";

import { useRef, useState } from "react";
import { getOffice, replaceState, setSettings, useOffice, useStorageMode } from "@/lib/officeStore";
import type { OfficeSettings } from "@/lib/officeState";
import { shrinkPhoto } from "./EditEmployeeDialog";
import { card, input } from "./ui";

export const DEFAULT_NAME = "المكتب الافتراضي";
export const DEFAULT_PURPOSE = "فريق وكلاء إدارة الاتصال والتسويق: المدير العام يوزّع، الإدارات تنفّذ، لطيفة تدقق، والخطة تصلك وإلى Microsoft Teams";

/** ألوان جاهزة: الخلفية، النص، البطاقات، اللون الرئيسي */
const THEMES: { name: string; v: Required<Pick<OfficeSettings, "bg" | "fg" | "cardBg" | "accent">> }[] = [
  { name: "فاتح (الافتراضي)", v: { bg: "#f5f6fa", fg: "#171717", cardBg: "#ffffff", accent: "#2563eb" } },
  { name: "أخضر قرآني", v: { bg: "#eef5f0", fg: "#14281d", cardBg: "#ffffff", accent: "#0f7a4a" } },
  { name: "ذهبي وبني", v: { bg: "#f7f1e6", fg: "#2b2214", cardBg: "#fffdf8", accent: "#a16207" } },
  { name: "كحلي داكن", v: { bg: "#0b1626", fg: "#e8eef7", cardBg: "#13233a", accent: "#38bdf8" } },
  { name: "داكن", v: { bg: "#0b0d12", fg: "#ededed", cardBg: "#18181b", accent: "#22c55e" } },
];

function ColorField({ label, value, fallback, onChange }: { label: string; value?: string; fallback: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-black/10 dark:border-white/10 px-3 py-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <span dir="ltr" className="text-xs opacity-60">{value || "تلقائي"}</span>
        <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent" />
      </span>
    </label>
  );
}

/** إعدادات المكتب: الهوية (الاسم والشعار والوظيفة)، الألوان، حجم العرض، والبيانات */
export default function SettingsPage() {
  const office = useOffice();
  const storage = useStorageMode();
  const s = office.settings ?? {};
  const [msg, setMsg] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const set = (patch: OfficeSettings) => setSettings(patch);

  function exportData() {
    const blob = new Blob([JSON.stringify(getOffice(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `office-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function importData(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object" || !Array.isArray(data.tasks)) throw new Error();
      if (!confirm("سيتم استبدال كل بيانات المكتب الحالية بالنسخة المرفوعة. متابعة؟")) return;
      replaceState(data);
      setMsg("✅ تمت استعادة النسخة الاحتياطية.");
    } catch {
      setMsg("⚠️ الملف غير صالح. اختر ملف نسخة احتياطية صدّرته من هذه الصفحة.");
    }
  }

  return (
    <div className="space-y-4">
      <section className={`${card} space-y-3`}>
        <h2 className="font-bold">🏢 هوية المكتب</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 text-4xl">
            {s.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- شعار محفوظ كـ data URL
              <img src={s.logo} alt="الشعار" className="h-full w-full object-cover" />
            ) : (
              "🏢"
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="tb tb-primary cursor-pointer">
              📷 رفع شعار أو صورة
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) set({ logo: await shrinkPhoto(f, 192) });
                  e.target.value = "";
                }}
              />
            </label>
            {s.logo && <button className="tb" onClick={() => set({ logo: undefined })}>🗑️ إزالة الشعار</button>}
          </div>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="opacity-70">اسم المكتب</span>
          <input className={input} value={s.name ?? ""} placeholder={DEFAULT_NAME} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="opacity-70">الجهة</span>
          <input className={input} value={s.org ?? ""} placeholder="مثال: جمعية تحفيظ القرآن الكريم بالأحساء — إدارة الاتصال والتسويق" maxLength={100} onChange={(e) => set({ org: e.target.value })} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="opacity-70">وظيفة المكتب (تظهر تحت الاسم)</span>
          <textarea className={`${input} min-h-20`} value={s.purpose ?? ""} placeholder={DEFAULT_PURPOSE} maxLength={240} onChange={(e) => set({ purpose: e.target.value })} />
        </label>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-bold">🎨 الألوان</h2>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button key={t.name} className="tb" onClick={() => set(t.v)}>
              <span className="flex overflow-hidden rounded-full border border-black/20">
                {[t.v.bg, t.v.cardBg, t.v.accent, t.v.fg].map((c) => (
                  <span key={c} className="h-4 w-3" style={{ background: c }} />
                ))}
              </span>
              {t.name}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ColorField label="لون الخلفية" value={s.bg} fallback="#f5f6fa" onChange={(v) => set({ bg: v })} />
          <ColorField label="لون النص" value={s.fg} fallback="#171717" onChange={(v) => set({ fg: v })} />
          <ColorField label="لون البطاقات" value={s.cardBg} fallback="#ffffff" onChange={(v) => set({ cardBg: v })} />
          <ColorField label="اللون الرئيسي للأزرار" value={s.accent} fallback="#2563eb" onChange={(v) => set({ accent: v })} />
        </div>
        <button className="tb" onClick={() => set({ bg: undefined, fg: undefined, cardBg: undefined, accent: undefined })}>
          ↩️ الألوان التلقائية (تتبع الوضع الفاتح/الداكن للجهاز)
        </button>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-bold">📺 حجم العرض</h2>
        <p className="text-sm opacity-70">«تلقائي» يكبّر الخط على الشاشات الكبيرة. اختر «كبير جداً» لشاشة التلفاز إذا كنت تشاهد من بعيد.</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["auto", "تلقائي"],
              ["normal", "عادي"],
              ["large", "كبير"],
              ["xlarge", "كبير جداً (تلفاز)"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} className={`tb ${(s.scale ?? "auto") === k ? "tb-active" : ""}`} onClick={() => set({ scale: k })}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-bold">💾 البيانات</h2>
        <p className="text-sm opacity-70">
          مكان الحفظ:{" "}
          {storage === "cloud" ? "☁️ قاعدة البيانات (تظهر على كل أجهزتك)" : storage === "error" ? "⚠️ تعذّر الحفظ في قاعدة البيانات (محفوظ في هذا المتصفح)" : "💾 هذا المتصفح فقط"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="tb tb-green" onClick={exportData}>⬇️ تنزيل نسخة احتياطية</button>
          <button className="tb" onClick={() => importRef.current?.click()}>⬆️ استعادة نسخة احتياطية</button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importData(f);
              e.target.value = "";
            }}
          />
          <button
            className="tb"
            onClick={() => {
              if (confirm("إعادة كل الإعدادات (الاسم والشعار والألوان وحجم العرض) إلى الافتراضي؟")) setSettings(null);
            }}
          >
            ♻️ إعادة ضبط الإعدادات
          </button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
      </section>
    </div>
  );
}

/** يطبّق ألوان المكتب وحجم العرض على الصفحة كلها */
export function applySettings(s: OfficeSettings | undefined) {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  if (!root) return;
  const vars: [string, string | undefined][] = [
    ["--background", s?.bg],
    ["--foreground", s?.fg],
    ["--card", s?.cardBg],
    ["--accent", s?.accent],
  ];
  for (const [k, v] of vars) {
    if (v) root.style.setProperty(k, v);
    else root.style.removeProperty(k);
  }
  if (s?.scale && s.scale !== "auto") root.dataset.scale = s.scale;
  else delete root.dataset.scale;
}
