"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { OFFICE_AGENTS, WORKER_IDS, type Gender } from "@/lib/agents";
import type { TaskResult } from "@/lib/orchestrator";
import { addEmployee, removeEmployee, useEmployees } from "@/lib/employeeStore";
import type { CameraView, Person } from "./components/Office3D";
import { MAX_EMPLOYEES, MEETING_SEATS, seatsFor, type OfficeMode } from "./components/office/floorplan";

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
interface PrivateResult {
  employeeId: string;
  name: string;
  role: string;
  topic: string;
  reply: string;
}

const card = "rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4";
const input = "w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent p-3";

export default function OfficePage() {
  const employees = useEmployees();
  const [goal, setGoal] = useState("");
  const [topic, setTopic] = useState("");
  const [privateTopic, setPrivateTopic] = useState("");
  const [privateGuest, setPrivateGuest] = useState<string>("kareem");
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [mode, setMode] = useState<OfficeMode>({ kind: "desks" });
  const [busy, setBusy] = useState<"task" | "meeting" | "private" | null>(null);
  const [result, setResult] = useState<(TaskResult & { teamsNotified: boolean }) | null>(null);
  const [meeting, setMeeting] = useState<MeetingResult | null>(null);
  const [privateResult, setPrivateResult] = useState<PrivateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CameraView>("overview");
  const [viewNonce, setViewNonce] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const taskRef = useRef<HTMLTextAreaElement>(null);
  const privateRef = useRef<HTMLInputElement>(null);

  // الفريق كاملاً: المدير أولاً، ثم الأساسيون، ثم الموظفون الجدد
  const people: Person[] = useMemo(
    () => [
      ...(["musab", ...WORKER_IDS] as const).map((id) => {
        const a = OFFICE_AGENTS[id];
        return { id, name: a.name, role: a.role, color: a.color, gender: a.gender, manager: id === "musab" };
      }),
      ...employees.map((e) => ({ id: e.id, name: e.name, role: e.role, color: e.color, gender: e.gender })),
    ],
    [employees]
  );
  const byId = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);
  const ids = useMemo(() => people.map((p) => p.id), [people]);
  const seats = useMemo(() => seatsFor(ids, mode), [ids, mode]);
  const homeDesk = useMemo(() => Object.fromEntries(ids.slice(1).map((id, i) => [id, i])), [ids]);
  const staff = people.slice(1);
  const deskFull = employees.length >= MAX_EMPLOYEES - WORKER_IDS.length;

  const goTo = (v: CameraView) => {
    setView(v);
    setViewNonce((n) => n + 1);
    setSelected(v.startsWith("agent:") ? v.slice(6) : null);
  };
  const setAll = (s: Status, only?: string[]) =>
    setStatuses(Object.fromEntries((only ?? ids).map((id) => [id, s])));

  async function post<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "حدث خطأ");
    return data as T;
  }

  async function dispatchTask() {
    if (!goal.trim()) return;
    setBusy("task");
    setError(null);
    setResult(null);
    setMode({ kind: "desks" });
    setAll("working");
    try {
      const data = await post<TaskResult & { teamsNotified: boolean }>("/api/dispatch-task", { goal, employees });
      setResult(data);
      const next: Record<string, Status> = { musab: "done" };
      for (const d of data.deliverables) next[d.agentId] = "done";
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
    setMode({ kind: "team" }); // الفريق يمشي إلى غرفة الاجتماعات الكبيرة
    goTo("meeting");
    const attendees = ids.slice(0, MEETING_SEATS.length);
    setAll("working", attendees);
    try {
      const data = await post<MeetingResult>("/api/team-meeting", { topic, employees });
      setMeeting(data);
      setAll("done", attendees);
    } catch (e) {
      setError((e as Error).message);
      setAll("idle");
    } finally {
      setBusy(null);
    }
  }

  async function callPrivateMeeting() {
    if (!privateTopic.trim()) {
      privateRef.current?.focus();
      return;
    }
    const guest = privateGuest;
    setBusy("private");
    setError(null);
    setPrivateResult(null);
    setMode({ kind: "private", guestId: guest }); // مصعب والموظف يذهبان للغرفة الخاصة
    goTo("private");
    setAll("working", ["musab", guest]);
    try {
      const data = await post<PrivateResult>("/api/private-meeting", {
        employeeId: guest,
        topic: privateTopic,
        employees,
      });
      setPrivateResult(data);
      setAll("done", ["musab", guest]);
    } catch (e) {
      setError((e as Error).message);
      setAll("idle");
    } finally {
      setBusy(null);
    }
  }

  function backToDesks() {
    setMode({ kind: "desks" });
    goTo("overview");
  }

  const sel = selected ? byId[selected] : null;
  const selIsCustom = !!sel && sel.id.startsWith("emp_");

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
        <button className="tb tb-teal" onClick={() => privateRef.current?.focus()} disabled={!!busy}>
          🔒 اجتماع خاص
        </button>
        <button className="tb tb-green" onClick={() => setShowAdd(true)} disabled={deskFull}>
          ➕ موظف جديد
        </button>
        <button className="tb" onClick={backToDesks} disabled={mode.kind === "desks"}>
          🪑 العودة للمكاتب
        </button>
        <span className="tb-sep" />
        {(
          [
            ["overview", "🏢 منظر عام"],
            ["manager", "🏛️ مكتب المدير"],
            ["meeting", "👥 الاجتماعات"],
            ["private", "🔒 الغرفة الخاصة"],
          ] as const
        ).map(([v, label]) => (
          <button key={v} className={`tb ${view === v ? "tb-active" : ""}`} onClick={() => goTo(v)}>
            {label}
          </button>
        ))}
        <span className="tb-sep" />
        {people.map((p) => (
          <button
            key={p.id}
            className={`tb ${view === `agent:${p.id}` ? "tb-active" : ""}`}
            style={{ ["--c" as string]: p.color }}
            onClick={() => goTo(`agent:${p.id}`)}
          >
            <span className="tb-dot" /> {p.name}
            {statuses[p.id] === "working" ? " ⏳" : statuses[p.id] === "done" ? " ✅" : ""}
          </button>
        ))}
      </nav>

      {/* المكتب ثلاثي الأبعاد */}
      <section className="relative h-[66vh] min-h-[440px] overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 shadow-sm">
        <Office3D
          people={people}
          seats={seats}
          homeDesk={homeDesk}
          statuses={statuses}
          view={view}
          viewNonce={viewNonce}
          selected={selected}
          onSelect={(id) => goTo(`agent:${id}`)}
          onEmptyDesk={() => !deskFull && setShowAdd(true)}
        />
        {sel && (
          <div className="absolute bottom-3 right-3 w-64 rounded-xl bg-white/95 dark:bg-zinc-900/95 p-3 text-sm shadow-lg backdrop-blur space-y-2">
            <div>
              <div className="font-bold">{sel.name}</div>
              <div className="opacity-70">{sel.role}</div>
              <div className="mt-1 text-xs">
                {statuses[sel.id] === "working" ? "⏳ يعمل الآن" : statuses[sel.id] === "done" ? "✅ أنجز مهمته" : "متاح"}
              </div>
            </div>
            {!sel.manager && (
              <div className="flex flex-wrap gap-2">
                <button
                  className="tb tb-teal"
                  onClick={() => {
                    setPrivateGuest(sel.id);
                    privateRef.current?.focus();
                  }}
                >
                  🔒 اجتماع خاص معه
                </button>
                {selIsCustom && (
                  <button
                    className="tb"
                    onClick={() => {
                      removeEmployee(sel.id);
                      goTo("overview");
                    }}
                  >
                    🗑️ حذف
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/40 px-2 py-1 text-[11px] text-white">
          اسحب للتدوير • عجلة الفأرة للتكبير • اضغط على موظف أو مكتب شاغر
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${card} space-y-3`}>
          <h2 className="font-bold">📋 مهمة جديدة لمصعب</h2>
          <textarea
            ref={taskRef}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="مثال: جهّز خطة إعلانية لإطلاق دورة تدريبية أونلاين خلال أسبوعين"
            className={`${input} min-h-24`}
          />
          <button
            onClick={dispatchTask}
            disabled={!!busy || !goal.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy === "task" ? "الفريق يعمل…" : "إرسال المهمة للفريق"}
          </button>
        </section>

        <section className={`${card} space-y-3`}>
          <h2 className="font-bold">🎥 اجتماع الفريق (الغرفة الكبيرة + Teams)</h2>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="موضوع الاجتماع (اختياري)"
            className={input}
          />
          <button
            onClick={callTeamMeeting}
            disabled={!!busy}
            className="w-full rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy === "meeting" ? "جاري تجهيز الاجتماع…" : "Call Team Meeting"}
          </button>
          {people.length > MEETING_SEATS.length && (
            <p className="text-xs opacity-60">تتسع الغرفة لـ {MEETING_SEATS.length} أشخاص، والبقية يتابعون من مكاتبهم.</p>
          )}
        </section>

        <section className={`${card} space-y-3`}>
          <h2 className="font-bold">🔒 اجتماع خاص مع موظف</h2>
          <select
            value={privateGuest}
            onChange={(e) => setPrivateGuest(e.target.value)}
            className={input}
          >
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.role}
              </option>
            ))}
          </select>
          <input
            ref={privateRef}
            value={privateTopic}
            onChange={(e) => setPrivateTopic(e.target.value)}
            placeholder="موضوع الاجتماع الخاص (مثال: تقييم أداء الحملة)"
            className={input}
          />
          <button
            onClick={callPrivateMeeting}
            disabled={!!busy || !privateTopic.trim()}
            className="w-full rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy === "private" ? "الاجتماع جارٍ…" : "بدء الاجتماع الخاص"}
          </button>
        </section>
      </div>

      {/* الفريق */}
      <section className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">👥 فريق المكتب ({people.length})</h2>
          <button className="tb tb-green" onClick={() => setShowAdd(true)} disabled={deskFull}>
            ➕ إضافة موظف
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 px-3 py-2 text-sm"
              style={{ borderInlineStartWidth: 4, borderInlineStartColor: p.color }}
            >
              <button className="text-start" onClick={() => goTo(`agent:${p.id}`)}>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs opacity-60">{p.role}</div>
              </button>
              {p.id.startsWith("emp_") && (
                <button
                  title="حذف الموظف"
                  className="rounded-md px-1.5 text-xs opacity-50 hover:bg-red-50 hover:text-red-600 hover:opacity-100"
                  onClick={() => removeEmployee(p.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs opacity-60">
          الموظفون الجدد يشاركون في المهام والاجتماعات، ويُحفظون في هذا المتصفح. المكاتب الشاغرة: {MAX_EMPLOYEES - staff.length}
        </p>
      </section>

      {error && (
        <div className="rounded-lg border border-red-400 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {privateResult && (
        <section className="rounded-2xl border border-teal-300 dark:border-teal-800 bg-white dark:bg-zinc-900 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">
              🔒 اجتماع خاص: مصعب و{privateResult.name} — {privateResult.topic}
            </h2>
            <button className="tb" onClick={backToDesks}>🪑 إنهاء الاجتماع</button>
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-7 font-sans">{privateResult.reply}</pre>
        </section>
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
            <details key={d.agentId} className={card} open>
              <summary className="cursor-pointer font-semibold">
                <span className="tb-dot" style={{ ["--c" as string]: byId[d.agentId]?.color }} /> {d.agentName} ({d.role}) — {d.subtask}
              </summary>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 font-sans">{d.deliverable}</pre>
            </details>
          ))}
        </section>
      )}

      {showAdd && <AddEmployeeDialog onClose={() => setShowAdd(false)} />}
    </main>
  );
}

function AddEmployeeDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [gender, setGender] = useState<Gender>("m");
  const valid = name.trim() && role.trim();

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        className={`${card} w-full max-w-md space-y-3 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          addEmployee({ name: name.trim(), role: role.trim(), specialty: specialty.trim(), gender });
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
