"use client";

import { useState } from "react";
import { OFFICE_AGENTS, type AgentId } from "@/lib/agents";
import type { TaskResult } from "@/lib/orchestrator";

type Status = "idle" | "working" | "done";

// مواقع المكاتب ومقاعد غرفة الاجتماعات (بالنسبة المئوية داخل أرضية المكتب)
const DESKS: Record<AgentId, { x: number; y: number }> = {
  musab: { x: 12, y: 22 },
  kareem: { x: 12, y: 72 },
  mona: { x: 40, y: 72 },
  omar: { x: 40, y: 22 },
};
const MEETING_SEATS: Record<AgentId, { x: number; y: number }> = {
  musab: { x: 70, y: 32 },
  kareem: { x: 88, y: 32 },
  mona: { x: 70, y: 66 },
  omar: { x: 88, y: 66 },
};

interface MeetingResult {
  topic: string;
  meetingUrl: string | null;
  meetingError: string | null;
  minutes: string;
  teamsNotified: boolean;
}

export default function OfficePage() {
  const [goal, setGoal] = useState("");
  const [topic, setTopic] = useState("");
  const [statuses, setStatuses] = useState<Record<AgentId, Status>>({
    musab: "idle", kareem: "idle", mona: "idle", omar: "idle",
  });
  const [inMeeting, setInMeeting] = useState(false);
  const [busy, setBusy] = useState<"task" | "meeting" | null>(null);
  const [result, setResult] = useState<(TaskResult & { teamsNotified: boolean }) | null>(null);
  const [meeting, setMeeting] = useState<MeetingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setAll = (s: Status) => setStatuses({ musab: s, kareem: s, mona: s, omar: s });

  async function dispatchTask() {
    if (!goal.trim()) return;
    setBusy("task");
    setError(null);
    setResult(null);
    setInMeeting(false);
    setAll("working");
    try {
      const res = await fetch("/api/dispatch-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      const next: Record<AgentId, Status> = { musab: "done", kareem: "idle", mona: "idle", omar: "idle" };
      for (const d of data.deliverables as TaskResult["deliverables"]) next[d.agentId] = "done";
      setStatuses(next);
    } catch (e) {
      setError((e as Error).message);
      setAll("idle");
    } finally {
      setBusy(null);
    }
  }

  async function callTeamMeeting() {
    setBusy("meeting");
    setError(null);
    setMeeting(null);
    setInMeeting(true); // الشخصيات تتحرك إلى غرفة الاجتماعات
    setAll("working");
    try {
      const res = await fetch("/api/team-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMeeting(data);
      setAll("done");
    } catch (e) {
      setError((e as Error).message);
      setAll("idle");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-4 md:p-8 space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">🏢 المكتب الافتراضي</h1>
        <p className="text-sm opacity-70">مصعب يوزّع المهام على الفريق ويرسل التقرير إلى Microsoft Teams</p>
      </header>

      {/* أرضية المكتب */}
      <section className="relative h-80 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="absolute left-[60%] top-[8%] h-[84%] w-[38%] rounded-xl border-2 border-dashed border-sky-400/60 bg-sky-400/5">
          <span className="absolute top-2 right-3 text-xs text-sky-600 dark:text-sky-300">غرفة الاجتماعات</span>
          <div className="absolute inset-x-[25%] inset-y-[38%] rounded-full bg-sky-200/50 dark:bg-sky-800/40" />
        </div>
        {(Object.keys(OFFICE_AGENTS) as AgentId[]).map((id) => {
          const a = OFFICE_AGENTS[id];
          const pos = inMeeting ? MEETING_SEATS[id] : DESKS[id];
          return (
            <div
              key={id}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-in-out text-center"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div
                className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl shadow-md ${statuses[id] === "working" ? "working" : ""}`}
                style={{ background: a.color + "22", border: `2px solid ${a.color}` }}
              >
                {a.emoji}
              </div>
              <div className="mt-1 text-sm font-semibold">{a.name}</div>
              <div className="text-[11px] opacity-60">{a.role}</div>
              <div className="text-[11px]">
                {statuses[id] === "working" ? "⏳ يعمل" : statuses[id] === "done" ? "✅ أنجز" : ""}
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <h2 className="font-bold">📋 مهمة جديدة لمصعب</h2>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="مثال: جهّز خطة إعلانية لإطلاق دورة تدريبية أونلاين خلال أسبوعين"
            className="w-full min-h-24 rounded-lg border border-black/15 dark:border-white/15 bg-transparent p-3"
          />
          <button
            onClick={dispatchTask}
            disabled={!!busy || !goal.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy === "task" ? "الفريق يعمل…" : "إرسال المهمة للفريق"}
          </button>
        </section>

        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <h2 className="font-bold">🎥 اجتماع الفريق على Teams</h2>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="موضوع الاجتماع (اختياري)"
            className="w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent p-3"
          />
          <button
            onClick={callTeamMeeting}
            disabled={!!busy}
            className="w-full rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy === "meeting" ? "جاري تجهيز الاجتماع…" : "Call Team Meeting"}
          </button>
        </section>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {meeting && (
        <section className="rounded-2xl border border-violet-300 dark:border-violet-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-bold">اجتماع: {meeting.topic}</h2>
            {meeting.meetingUrl && (
              <a
                href={meeting.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white"
              >
                انضمام لاجتماع Teams الآن
              </a>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(meeting.minutes)}
              className="rounded-lg border px-3 py-1.5 text-sm"
            >
              نسخ المحضر
            </button>
          </div>
          {meeting.meetingError && <p className="text-sm text-amber-600">⚠️ {meeting.meetingError}</p>}
          <p className="text-xs opacity-60">
            {meeting.teamsNotified ? "✅ أُرسل الرابط والمحضر إلى قناة Teams" : "لم يُرسل إلى Teams (تحقق من TEAMS_WEBHOOK_URL)"}
          </p>
          <pre className="whitespace-pre-wrap text-sm leading-7 font-sans">{meeting.minutes}</pre>
        </section>
      )}

      {result && (
        <section className="space-y-3">
          <div className="rounded-2xl border border-blue-300 dark:border-blue-800 bg-white dark:bg-zinc-900 p-4">
            <h2 className="font-bold mb-2">🧑‍💼 ملخص مصعب</h2>
            <pre className="whitespace-pre-wrap text-sm leading-7 font-sans">{result.managerSummary}</pre>
            <p className="mt-2 text-xs opacity-60">
              {result.teamsNotified ? "✅ أُرسل التقرير إلى Teams" : "لم يُرسل إلى Teams (تحقق من TEAMS_WEBHOOK_URL)"}
            </p>
          </div>
          {result.deliverables.map((d) => (
            <details key={d.agentId} className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4" open>
              <summary className="cursor-pointer font-semibold">
                {OFFICE_AGENTS[d.agentId].emoji} {d.agentName} ({d.role}) — {d.subtask}
              </summary>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 font-sans">{d.deliverable}</pre>
            </details>
          ))}
        </section>
      )}
    </main>
  );
}
