"use client";

import { useState } from "react";
import type { Gender } from "@/lib/agents";
import { addEmployee, setProfile, useOffice } from "@/lib/officeStore";
import DepartmentSelect from "./DepartmentSelect";
import { card, input } from "./ui";

export default function AddEmployeeDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [gender, setGender] = useState<Gender>("m");
  const [dep, setDep] = useState<string | null>(null);
  const office = useOffice();
  const valid = name.trim() && role.trim();

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        className={`${card} w-full max-w-md space-y-3 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const created = addEmployee({ name: name.trim(), role: role.trim(), specialty: specialty.trim(), gender });
          if (dep) setProfile(created.id, { departmentId: dep });
          onClose();
        }}
      >
        <h2 className="text-lg font-bold">➕ إضافة موظف جديد</h2>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم (مثال: فهد)" className={input} maxLength={40} />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="المسمى الوظيفي (مثال: محلل بيانات)" className={input} maxLength={60} />
        <textarea
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          placeholder="ماذا يتقن؟ (يستخدمه الذكاء الاصطناعي لتحديد أسلوب عمله)"
          className={`${input} min-h-20`}
          maxLength={400}
        />
        {office.departments.length > 0 && <DepartmentSelect departments={office.departments} value={dep} onChange={setDep} />}
        <div className="flex gap-2 text-sm">
          {(
            [
              ["m", "رجل (ثوب وشماغ)"],
              ["f", "امرأة (عباية)"],
            ] as const
          ).map(([g, label]) => (
            <label key={g} className={`tb flex-1 justify-center ${gender === g ? "tb-active" : ""}`}>
              <input type="radio" name="gender" className="sr-only" checked={gender === g} onChange={() => setGender(g)} />
              {label}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={!valid} className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
            إضافة وتخصيص مكتب
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
