"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MANAGER_ID, OFFICE_AGENTS, WORKER_IDS } from "@/lib/agents";
import type { TaskResult } from "@/lib/orchestrator";
import { addMeeting, addTasks, teamPayload, useOffice, useStorageMode } from "@/lib/officeStore";
import type { CameraView, Person } from "./components/Office3D";
import AddEmployeeDialog from "./components/AddEmployeeDialog";
import CallDialog from "./components/CallDialog";
import EmployeePanel, { performance } from "./components/EmployeePanel";
import OrgStructure from "./components/OrgStructure";
import { departmentLabel } from "@/lib/officeState";
import { useAutoLearning, useLearningNow } from "@/lib/selfLearning";
import MeetingsArchive from "./components/MeetingsArchive";
import { card, input, postJSON } from "./components/ui";
import Avatar from "./components/Avatar";
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
  teamsLinkEnabled?: boolean;
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


export default function OfficePage() {
  const office = useOffice();
  const storage = useStorageMode();
  const employees = office.employees;
  const [goal, setGoal] = useState("");
  const [topic, setTopic] = useState("");
  const [privateTopic, setPrivateTopic] = useState("");
  const [privateGuest, setPrivateGuest] = useState<string>("othman");
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
  const [panelFor, setPanelFor] = useState<string | null>(null);
  const [call, setCall] = useState<{ id: string; video: boolean } | null>(null);
  const taskRef = useRef<HTMLTextAreaElement>(null);
  const privateRef = useRef<HTMLInputElement>(null);

  // الفريق كاملاً: المدير أولاً، ثم الأساسيون، ثم الموظفون الجدد
  const people: Person[] = useMemo(
    () => [
      ...[MANAGER_ID, ...WORKER_IDS].map((id) => {
        const a = OFFICE_AGENTS[id];
        return { id, name: a.name, role: a.role, color: a.color, gender: a.gender, manager: id === MANAGER_ID };
      }),
      ...employees.map((e) => ({ id: e.id, name: e.name, role: e.role, color: e.color, gender: e.gender })),
    ].map((p) => {
      // تعديلات صاحب العمل على الاسم والمسمى والصوت والقسم
      const edit = office.profiles[p.id];
      if (p.id === MANAGER_ID) return p;
      return {
        ...p,
        name: edit?.name || p.name,
        gender: edit?.gender || p.gender,
        photo: edit?.photo,
        role: edit?.role || p.role,
        voice: edit?.voice,
        department: departmentLabel(office, p.id) || undefined,
      };
    }),
    [employees, office]
  );
  const byId = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);
  const ids = useMemo(() => people.map((p) => p.id), [people]);
  const seats = useMemo(() => seatsFor(ids, mode), [ids, mode]);
  const homeDesk = useMemo(() => Object.fromEntries(ids.slice(1).map((id, i) => [id, i])), [ids]);
  const staff = people.slice(1);
  useAutoLearning(useMemo(() => staff.map((p) => p.id), [staff]));
  const learningNow = useLearningNow();
  const deskFull = employees.length >= MAX_EMPLOYEES - WORKER_IDS.length;

  const goTo = (v: CameraView) => {
    setView(v);
    setViewNonce((n) => n + 1);
    setSelected(v.startsWith("agent:") ? v.slice(6) : null);
  };
  const setAll = (s: Status, only?: string[]) =>
    setStatuses(Object.fromEntries((only ?? ids).map((id) => [id, s])));

  const setOne = (id: string, st: Status) => setStatuses((prev) => ({ ...prev, [id]: st }));

  async function dispatchTask() {
    if (!goal.trim()) return;
    setBusy("task");
    setError(null);
    setResult(null);
    setMode({ kind: "desks" });
    setAll("working");
    try {
      const data = await postJSON<TaskResult & { teamsNotified: boolean }>("/api/dispatch-task", {
        goal,
        employees: teamPayload(),
      });
      setResult(data);
      // تُسجَّل كل مهمة في ملف الموظف
      addTasks(
        data.deliverables.map((d) => ({
          employeeId: d.agentId,
          title: d.subtask,
          goal: data.goal,
          source: "manager" as const,
          status: "done" as const,
          result: d.deliverable,
          doneAt: new Date().toISOString(),
        }))
      );
      const next: Record<string, Status> = { [MANAGER_ID]: "done" };
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
      const data = await postJSON<MeetingResult>("/api/team-meeting", { topic, employees: teamPayload() });
      setMeeting(data);
      addMeeting({
        kind: "team",
        topic: data.topic,
        participants: attendees.map((id) => byId[id]?.name ?? id),
        minutes: data.minutes,
        teamsUrl: data.meetingUrl,
      });
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
    setMode({ kind: "private", guestId: guest }); // المدير والموظف يذهبان للغرفة الخاصة
    goTo("private");
    setAll("working", [MANAGER_ID, guest]);
    try {
      const data = await postJSON<PrivateResult>("/api/private-meeting", {
        employeeId: guest,
        topic: privateTopic,
        employees: teamPayload(),
      });
      setPrivateResult(data);
      addMeeting({
        kind: "private",
        topic: data.topic,
        participants: ["مصعب", data.name],
        minutes: data.reply,
      });
      setAll("done", [MANAGER_ID, guest]);
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
  const panelPerson = panelFor ? byId[panelFor] : null;
  const callPerson = call ? byId[call.id] : null;

  // الضغط على موظف: تقريب الكاميرا وفتح ملفه
  function openPerson(id: string) {
    goTo(`agent:${id}`);
    if (id !== MANAGER_ID) setPanelFor(id);
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">🏢 المكتب الافتراضي</h1>
          <p className="text-sm opacity-70">فريق وكلاء إدارة الاتصال والتسويق: مساعد يوزّع، الإدارات تنفّذ، لطيفة تدقق، والخطة تصلك وإلى Microsoft Teams</p>
        </div>
        <span className="rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-xs" title="مكان حفظ بيانات المكتب">
          {storage === "cloud"
            ? "☁️ محفوظ في قاعدة البيانات"
            : storage === "error"
              ? "⚠️ تعذّر الحفظ في قاعدة البيانات (محفوظ محلياً)"
              : storage === "local"
                ? "💾 محفوظ في هذا المتصفح"
                : "…"}
        </span>
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
            onClick={() => openPerson(p.id)}
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
          onSelect={openPerson}
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
              <button className="tb tb-primary" onClick={() => setPanelFor(sel.id)}>
                📂 ملف الموظف
              </button>
            )}
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/40 px-2 py-1 text-[11px] text-white">
          اسحب للتدوير • عجلة الفأرة للتكبير • اضغط على موظف أو مكتب شاغر
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${card} space-y-3`}>
          <h2 className="font-bold">📋 توجيه جديد لمساعد</h2>
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((p) => {
            const perf = performance(office.tasks.filter((t) => t.employeeId === p.id), office.learning[p.id]?.length ?? 0);
            return (
              <button
                key={p.id}
                onClick={() => openPerson(p.id)}
                className="flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 px-3 py-2 text-start text-sm hover:bg-black/[.03] dark:hover:bg-white/5"
                style={{ borderInlineStartWidth: 4, borderInlineStartColor: p.color }}
              >
                <Avatar person={p} size={42} />
                <div className="flex-1">
                  <div className="font-semibold">
                    {p.name} <span className="text-xs font-normal opacity-60">• {perf.level}</span>
                  </div>
                  <div className="text-xs opacity-60">
                    {p.role}
                    {p.department ? ` • ${p.department}` : ""}
                  </div>
                  <div className="mt-0.5 text-xs">
                    ✅ {perf.done} منجزة • 🕒 {perf.pending} لم تُنجز
                    {perf.avg ? ` • ⭐ ${perf.avg.toFixed(1)}` : ""}
                    {(office.learning[p.id]?.length ?? 0) > 0 && ` • 📚 ${office.learning[p.id].length}`}
                  </div>
                </div>
                {learningNow === p.id && <span title="يتعلم مهارة جديدة الآن">📚</span>}
                {statuses[p.id] === "working" && <span>⏳</span>}
              </button>
            );
          })}
        </div>
        <p className="text-xs opacity-60">
          اضغط على أي موظف لفتح ملفه: مهامه المنجزة والمعلّقة، المحادثة، الاتصال، والتطوير. المكاتب الشاغرة: {MAX_EMPLOYEES - staff.length}
        </p>
      </section>

      <OrgStructure staff={staff} onOpen={openPerson} />

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
          {meeting.meetingError && (
            <p className="text-sm text-amber-600">⚠️ لم يُنشأ رابط Teams: {meeting.meetingError}</p>
          )}
          <p className="text-xs opacity-60">
            {meeting.teamsLinkEnabled === false && "تم الاجتماع داخل المكتب الافتراضي (رابط Teams اختياري). "}
            {meeting.teamsNotified ? "✅ أُرسل المحضر إلى قناة Teams" : ""}
            {" "}حُفظ المحضر في أرشيف الاجتماعات.
          </p>
          <pre className="whitespace-pre-wrap text-sm leading-7 font-sans">{meeting.minutes}</pre>
        </section>
      )}

      {result && (
        <section className="space-y-3">
          <div className="rounded-2xl border border-blue-300 dark:border-blue-800 bg-white dark:bg-zinc-900 p-4">
            <h2 className="font-bold mb-2">
              🧭 خطة مساعد الجاهزة للتنفيذ
              {result.flow && <span className="ms-2 rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-xs font-normal">المسار: {result.flow}</span>}
            </h2>
            <pre className="whitespace-pre-wrap text-sm leading-7 font-sans">{result.managerSummary}</pre>
            <p className="mt-2 text-xs opacity-60">
              {result.teamsNotified ? "✅ أُرسل التقرير إلى Teams. " : ""}سُجّلت المهام في ملف كل موظف.
            </p>
          </div>
          {result.deliverables.map((d) => (
            <details key={`${d.agentId}-${d.stage ?? ""}`} className={card} open={d.stage !== "execute"}>
              <summary className="cursor-pointer font-semibold">
                <span className="tb-dot" style={{ ["--c" as string]: byId[d.agentId]?.color }} />{" "}
                {d.stage === "review" ? "✅ تدقيق: " : d.stage === "department" ? "🏢 خلاصة الإدارة: " : d.stage === "research" ? "🔎 بحث في الخلفية: " : ""}
                {d.web ? "🌐 " : ""}
                {d.agentName} ({d.role}) — {d.subtask}
              </summary>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 font-sans">{d.deliverable}</pre>
            </details>
          ))}
        </section>
      )}

      <MeetingsArchive />

      {showAdd && <AddEmployeeDialog onClose={() => setShowAdd(false)} />}
      {panelPerson && !callPerson && (
        <EmployeePanel
          person={panelPerson}
          onClose={() => setPanelFor(null)}
          onBusy={setOne}
          onCall={(video) => setCall({ id: panelPerson.id, video })}
          onPrivateMeeting={() => {
            setPrivateGuest(panelPerson.id);
            setPanelFor(null);
            setTimeout(() => privateRef.current?.focus(), 50);
          }}
        />
      )}
      {callPerson && call && (
        <CallDialog person={callPerson} withVideo={call.video} onClose={() => setCall(null)} />
      )}
    </main>
  );
}
