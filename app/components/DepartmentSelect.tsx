"use client";

import type { Department } from "@/lib/officeState";
import { input } from "./ui";

/** قائمة اختيار الإدارة/القسم، مرتبة: كل إدارة ثم أقسامها */
export default function DepartmentSelect({
  departments,
  value,
  onChange,
}: {
  departments: Department[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const tops = departments.filter((d) => !d.parentId);
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={input}>
      <option value="">— بدون إدارة —</option>
      {tops.map((t) => [
        <option key={t.id} value={t.id}>
          🏢 إدارة {t.name}
        </option>,
        ...departments
          .filter((d) => d.parentId === t.id)
          .map((d) => (
            <option key={d.id} value={d.id}>
              {"   "}↳ قسم {d.name}
            </option>
          )),
      ])}
    </select>
  );
}
