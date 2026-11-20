"use client";

import { useState } from "react";
import { addDepartment, removeDepartment, renameDepartment, setProfile, useOffice } from "@/lib/officeStore";
import type { Department } from "@/lib/officeState";
import Avatar from "./Avatar";
import type { Person } from "./office/Character";
import { card, input } from "./ui";

/** الهيكل التنظيمي: إدارات وأقسامها، ومن يعمل في كل منها */
export default function OrgStructure({ staff, onOpen }: { staff: Person[]; onOpen: (id: string) => void }) {
  const office = useOffice();
  const deps = office.departments;
  const tops = deps.filter((d) => !d.parentId);
  const [newTop, setNewTop] = useState("");
  const depOf = (id: string) => office.profiles[id]?.departmentId ?? null;
  const unassigned = staff.filter((p) => !deps.some((d) => d.id === depOf(p.id)));

  return (
    <section className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">🏢 الهيكل التنظيمي</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newTop.trim()) addDepartment(newTop);
            setNewTop("");
          }}
        >
          <input value={newTop} onChange={(e) => setNewTop(e.target.value)} placeholder="اسم إدارة جديدة (مثال: التسويق)" className={`${input} !p-2 text-sm`} maxLength={50} />
          <button className="tb tb-green shrink-0" disabled={!newTop.trim()}>➕ إدارة</button>
        </form>
      </div>
      {tops.length === 0 && (
        <p className="text-sm opacity-60">
          لا توجد إدارات بعد. أضف إدارة (مثل التسويق أو المبيعات)، ثم أضف لها أقساماً، وانقل الموظفين إليها من قائمة «نقل إلى…» بجانب اسم كل موظف.
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {tops.map((t) => (
          <Unit key={t.id} dep={t} staff={staff} depOf={depOf} onOpen={onOpen} subs={deps.filter((d) => d.parentId === t.id)} />
        ))}
      </div>
      {unassigned.length > 0 && tops.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs opacity-60">بدون إدارة (اختر مكان كل موظف):</div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <Member key={p.id} p={p} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Member({ p, onOpen }: { p: Person; onOpen: (id: string) => void }) {
  const office = useOffice();
  const deps = office.departments;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 py-0.5 pe-1 ps-0.5 text-xs">
      <button className="inline-flex items-center gap-1" onClick={() => onOpen(p.id)} title="فتح الملف">
        <Avatar person={p} size={22} ring={false} />
        <b>{p.name}</b>
      </button>
      <select
        aria-label={`نقل ${p.name}`}
        className="max-w-28 rounded bg-transparent text-xs opacity-70"
        value={office.profiles[p.id]?.departmentId ?? ""}
        onChange={(e) => setProfile(p.id, { departmentId: e.target.value || null })}
      >
        <option value="">نقل إلى…</option>
        {deps
          .filter((d) => !d.parentId)
          .flatMap((t) => [t, ...deps.filter((d) => d.parentId === t.id)])
          .map((d) => (
            <option key={d.id} value={d.id}>
              {d.parentId ? `↳ ${d.name}` : `إدارة ${d.name}`}
            </option>
          ))}
      </select>
    </span>
  );
}

function EditableName({ dep, prefix }: { dep: Department; prefix: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(dep.name);
  if (!editing)
    return (
      <span className="inline-flex items-center gap-1">
        <b>
          {prefix} {dep.name}
        </b>
        <button className="text-xs opacity-50 hover:opacity-100" title="تعديل الاسم" onClick={() => setEditing(true)}>
          ✏️
        </button>
      </span>
    );
  return (
    <form
      className="inline-flex gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) renameDepartment(dep.id, v);
        setEditing(false);
      }}
    >
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} className="rounded border px-2 py-0.5 text-sm" maxLength={50} />
      <button className="tb text-xs">حفظ</button>
    </form>
  );
}

function DeleteBtn({ id, what }: { id: string; what: string }) {
  return (
    <button className="text-xs opacity-40 hover:text-red-600 hover:opacity-100" title={`حذف ${what} (الموظفون يصبحون بدون إدارة)`} onClick={() => removeDepartment(id)}>
      🗑️
    </button>
  );
}

function Unit({
  dep,
  subs,
  staff,
  depOf,
  onOpen,
}: {
  dep: Department;
  subs: Department[];
  staff: Person[];
  depOf: (id: string) => string | null;
  onOpen: (id: string) => void;
}) {
  const [newSub, setNewSub] = useState("");
  const members = (id: string) => staff.filter((p) => depOf(p.id) === id);
  return (
    <div className="space-y-2 rounded-xl border border-black/10 dark:border-white/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <EditableName dep={dep} prefix="🏢 إدارة" />
        <DeleteBtn id={dep.id} what="الإدارة وأقسامها" />
      </div>
      <div className="flex flex-wrap gap-2">
        {members(dep.id).map((p) => (
          <Member key={p.id} p={p} onOpen={onOpen} />
        ))}
      </div>
      {subs.map((s) => (
        <div key={s.id} className="ms-3 space-y-1 border-s-2 border-black/10 dark:border-white/10 ps-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <EditableName dep={s} prefix="📁 قسم" />
            <DeleteBtn id={s.id} what="القسم" />
          </div>
          <div className="flex flex-wrap gap-2">
            {members(s.id).map((p) => (
              <Member key={p.id} p={p} onOpen={onOpen} />
            ))}
            {members(s.id).length === 0 && <span className="text-xs opacity-50">لا يوجد موظفون</span>}
          </div>
        </div>
      ))}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newSub.trim()) addDepartment(newSub, dep.id);
          setNewSub("");
        }}
      >
        <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="قسم جديد في هذه الإدارة" className="flex-1 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-2 py-1 text-sm" maxLength={50} />
        <button className="tb text-xs" disabled={!newSub.trim()}>➕ قسم</button>
      </form>
    </div>
  );
}
