"use client";

import { useState } from "react";
import { CORE_SPECIALTY, speakingStyle } from "@/lib/agents";
import { setProfile, useOffice } from "@/lib/officeStore";
import { voiceFor, VOICE_OPTIONS } from "@/lib/voice";
import DepartmentSelect from "./DepartmentSelect";
import type { Person } from "./office/Character";
import Avatar from "./Avatar";
import { card, input } from "./ui";

/** تصغير الصورة وقصها مربعاً من المنتصف (256 بكسل) حتى تبقى خفيفة في التخزين */
async function shrinkPhoto(file: File, size = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    // نميل للأعلى قليلاً لأن الوجه غالباً في أعلى الصورة
    const sx = (img.naturalWidth - side) / 2;
    const sy = Math.max(0, (img.naturalHeight - side) * 0.3);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    c.getContext("2d")!.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** تعديل ملف موظف: الاسم، المسمى، التخصص، الأسلوب، الإدارة/القسم، والصوت */
export default function EditEmployeeDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const office = useOffice();
  const p = office.profiles[person.id] ?? {};
  const custom = office.employees.find((e) => e.id === person.id);
  const defaultSpecialty = custom?.specialty || CORE_SPECIALTY[person.id] || "";
  const defaultStyle = speakingStyle(person.id).replace(/^أسلوبك ثابت دائماً:\s*/, "");

  const [name, setName] = useState(person.name);
  const [role, setRole] = useState(person.role);
  const [specialty, setSpecialty] = useState(p.specialty ?? defaultSpecialty);
  const [style, setStyle] = useState(p.style ?? defaultStyle);
  const [dep, setDep] = useState<string | null>(p.departmentId ?? null);
  const [voice, setVoice] = useState(p.voice ?? "");
  const [gender, setGender] = useState<"m" | "f">(person.gender);
  const [photo, setPhoto] = useState<string | undefined>(p.photo);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const valid = name.trim() && role.trim();
  const currentVoice = voiceFor({ id: person.id, gender });

  return (
    <div className="fixed inset-0 z-[2050] grid place-items-center bg-black/40 p-2 sm:p-4" onClick={onClose}>
      <form
        className={`${card} max-h-[92svh] w-full max-w-lg min-[1800px]:max-w-2xl space-y-3 overflow-auto shadow-xl`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          setProfile(person.id, {
            name: name.trim(),
            role: role.trim(),
            specialty: specialty.trim() && specialty.trim() !== defaultSpecialty ? specialty.trim() : undefined,
            style: style.trim() && style.trim() !== defaultStyle ? style.trim() : undefined,
            departmentId: dep,
            voice: voice && VOICE_OPTIONS[gender].some((v) => v.id === voice) ? voice : undefined,
            gender,
            photo,
          });
          onClose();
        }}
      >
        <h2 className="text-lg font-bold">✏️ تعديل ملف {person.name}</h2>
        <label className="block space-y-1 text-sm">
          <span className="opacity-70">الاسم</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} maxLength={40} />
        </label>
        <div className="flex items-center gap-3 text-sm">
          <Avatar person={{ ...person, gender, photo }} size={64} />
          <div className="space-y-1">
            <span className="opacity-70">صورة الشخصية (تظهر في ملفه وعلى وجهه في المكتب ثلاثي الأبعاد)</span>
            <div className="flex flex-wrap gap-2">
              <label className="tb tb-green cursor-pointer">
                📷 رفع صورة
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    setPhotoErr(null);
                    try {
                      setPhoto(await shrinkPhoto(f));
                    } catch {
                      setPhotoErr("تعذّر قراءة الصورة، جرّب صورة أخرى (JPG أو PNG).");
                    }
                  }}
                />
              </label>
              {photo && (
                <button type="button" className="tb" onClick={() => setPhoto(undefined)}>
                  إزالة الصورة
                </button>
              )}
            </div>
            {photoErr && <p className="text-xs text-red-600">{photoErr}</p>}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <span className="opacity-70">الجنس</span>
          <div className="flex gap-2">
            {(
              [
                ["m", "👨 ذكر (ثوب وشماغ)"],
                ["f", "👩 أنثى (عباية)"],
              ] as const
            ).map(([g, label]) => (
              <label key={g} className={`tb flex-1 justify-center ${gender === g ? "tb-active" : ""}`}>
                <input
                  type="radio"
                  name="edit-gender"
                  className="sr-only"
                  checked={gender === g}
                  onChange={() => {
                    setGender(g);
                    setVoice("");
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="opacity-70">المسمى الوظيفي</span>
          <input value={role} onChange={(e) => setRole(e.target.value)} className={input} maxLength={60} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="opacity-70">التخصص (ماذا يتقن)</span>
          <textarea value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={`${input} min-h-16`} maxLength={400} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="opacity-70">الأسلوب (طريقة كلامه وتعامله، ثابت في كل المحادثات والمكالمات)</span>
          <textarea
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className={`${input} min-h-16`}
            maxLength={400}
            placeholder="مثال: هادئ ومختصر، يبدأ بـ«تم» ويعطي رقماً واحداً واضحاً"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="opacity-70">الإدارة / القسم</span>
          <DepartmentSelect departments={office.departments} value={dep} onChange={setDep} />
          {office.departments.length === 0 && (
            <span className="text-xs opacity-60">لا توجد إدارات بعد. أضفها من «الهيكل التنظيمي» في الصفحة الرئيسية.</span>
          )}
        </label>
        <label className="block space-y-1 text-sm">
          <span className="opacity-70">صوت المكالمات</span>
          <select value={voice} onChange={(e) => setVoice(e.target.value)} className={input}>
            <option value="">بدون تغيير (الصوت الحالي)</option>
            {VOICE_OPTIONS[gender].map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
                {v.id === currentVoice ? " (الحالي)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!valid} className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
            حفظ التعديلات
          </button>
          {Object.keys(p).length > 0 && (
            <button
              type="button"
              className="rounded-lg border px-4 py-2"
              onClick={() => {
                setProfile(person.id, null);
                onClose();
              }}
            >
              استعادة الأصل
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
