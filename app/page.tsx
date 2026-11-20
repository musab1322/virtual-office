"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { OFFICE_AGENTS, type AgentId } from "@/lib/agents";
import type { TaskResult } from "@/lib/orchestrator";
import type { CameraView } from "./components/Office3D";

type Status = "idle" | "working" | "done";

// المشهد ثلاثي الأبعاد يعمل في المتصفح فقط
const Office3D = dynamic(() => import("./components/Office3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm opacity-60">جاري تحميل المكتب…</div>,
});

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
  const [view, setView] = useState<CameraView>("overview");
  const [viewNonce, setViewNonce] = useState(0);
  const [selected, setSelected] = useState<AgentId | null>(null);
  const taskRef = useRef<HTMLTextAreaElement>(null);

  const goTo = (v: CameraView) => {
    setView(v);
    setViewNonce((n) => n + 1);
    setSelected(v === "overview" || v === "meeting" ? null : v);
  };

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
    setInMeeting(true); // الشخصيات تمشي إلى غرفة الاجتماعات
    goTo("meeting");
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
    <main className="mx-auto w-full max-w-7xl p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">🏢 المكتب الافتراضي</h1>
          <p className="text-sm opacity-70">مصعب يوزّع المهام على الفريق ويرسل التقرير إلى Microsoft Teams</p>
        </div>
      </header>

      {/* شريط الأدوات */}
      <nav className="office-toolbar">
        <button className="tb tb-primary" onClick={() => taskRef.current?.focus()}>📋 مهمة جديدة</button>
        <button className="tb tb-violet" onClick={callTeamMeeting} disabled={!!busy}>
          🎥 {busy === "meeting" ? "جاري الاجتماع…" : "اجتماع الفريق"}
        </button>
        <button
          className="tb"
          onClick={() => {
            setInMeeting(false);
            goTo("overview");
          }}
          disabled={!inMeeting}
        >
          🪑 العودة للمكاتب
        </button>
        <span className="tb-sep" />
        <button className={`tb ${view === "overview" ? "tb-active" : ""}`} onClick={() => goTo("overview")}>🏢 منظر عام</button>
        <button className={`tb ${view === "meeting" ? "tb-active" : ""}`} onClick={() => goTo("meeting")}>🤝 غرفة الاجتماعات</button>
        <span className="tb-sep" />
        {(Object.keys(OFFICE_AGENTS) as AgentId[]).map((id) => (
          <button
            key={id}
            className={`tb ${view === id ? "tb-active" : ""}`}
            style={{ ["--c" as string]: OFFICE_AGENTS[id].color }}
            onClick={() => goTo(id)}
          >
            <span className="tb-dot" /> {OFFICE_AGENTS[id].name}
            {statuses[id] === "working" ? " ⏳" : statuses[id] === "done" ? " ✅" : ""}
          </button>
        ))}
      </nav>

      {/* المكتب ثلاثي الأبعاد */}
      <section className="relative h-[62vh] min-h-[420px] overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 shadow-sm">
        <Office3D
          statuses={statuses}
          inMeeting={inMeeting}
          view={view}
          viewNonce={viewNonce}
          selected={selected}
          onSelect={(id) => goTo(id)}
        />
        {selected && (
          <div className="absolute bottom-3 right-3 max-w-xs rounded-xl bg-white/90 dark:bg-zinc-900/90 p-3 text-sm shadow-lg backdrop-blur">
            <div className="font-bold">
              {OFFICE_AGENTS[selected].emoji} {OFFICE_AGENTS[selected].name}
            </div>
            <div className="opacity-70">{OFFICE_AGENTS[selected].role}</div>
            <div className="mt-1 text-xs">
              {statuses[selected] === "working" ? "⏳ يعمل الآن" : statuses[selected] === "done" ? "✅ أنجز مهمته" : "متاح"}
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/40 px-2 py-1 text-[11px] text-white">
          اسحب للتدوير • عجلة الفأرة للتكبير • اضغط على أي موظف
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <h2 className="font-bold">📋 مهمة جديدة لمصعب</h2>
          <textarea
            ref={taskRef}
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
