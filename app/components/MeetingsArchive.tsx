"use client";

import { useState } from "react";
import { update, useOffice } from "@/lib/officeStore";
import { card, fmtDate } from "./ui";

// أرشيف الاجتماعات السابقة ومحاضرها
export default function MeetingsArchive() {
  const office = useOffice();
  const [filter, setFilter] = useState<"all" | "team" | "private">("all");
  const [q, setQ] = useState("");
  const list = office.meetings
    .filter((m) => filter === "all" || m.kind === filter)
    .filter((m) => !q.trim() || (m.topic + m.minutes + m.participants.join(" ")).includes(q.trim()))
    .slice()
    .reverse();

  return (
    <section className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">📚 الاجتماعات السابقة والمحاضر ({office.meetings.length})</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "الكل"],
              ["team", "👥 اجتماعات الفريق"],
              ["private", "🔒 الخاصة"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} className={`tb ${filter === k ? "tb-active" : ""}`} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث في المحاضر…"
            className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-1 text-sm"
          />
        </div>
      </div>
      {list.length === 0 && <p className="text-sm opacity-60">لا توجد اجتماعات محفوظة بعد. كل اجتماع جديد يُحفظ هنا تلقائياً.</p>}
      <div className="space-y-2">
        {list.map((m) => (
          <details key={m.id} className="rounded-xl border border-black/10 dark:border-white/10 p-3">
            <summary className="cursor-pointer text-sm">
              <span className="font-semibold">
                {m.kind === "team" ? "👥" : "🔒"} {m.topic}
              </span>
              <span className="ms-2 text-xs opacity-60">
                {fmtDate(m.at)} • {m.participants.join("، ")}
              </span>
            </summary>
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {m.teamsUrl && (
                  <a href={m.teamsUrl} target="_blank" rel="noreferrer" className="tb tb-violet">
                    رابط Teams
                  </a>
                )}
                <button className="tb" onClick={() => navigator.clipboard.writeText(m.minutes)}>
                  📋 نسخ المحضر
                </button>
                <button
                  className="tb"
                  onClick={() => update((s) => ({ ...s, meetings: s.meetings.filter((x) => x.id !== m.id) }))}
                >
                  🗑️ حذف
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-7 font-sans">{m.minutes}</pre>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
