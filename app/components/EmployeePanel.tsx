"use client";

import { useEffect, useRef, useState } from "react";
import {
  addTasks,
  appendChat,
  clearChat,
  removeEmployee,
  removeTask,
  setDevelopment,
  teamPayload,
  updateTask,
  useOffice,
} from "@/lib/officeStore";
import type { OfficeTask } from "@/lib/officeState";
import Avatar from "./Avatar";
import type { Person } from "./office/Character";
import { fmtDate, input, postJSON } from "./ui";

type Tab = "tasks" | "chat" | "growth";
type Busy = (id: string, s: "idle" | "working" | "done") => void;

const SOURCE: Record<OfficeTask["source"], string> = {
  manager: "من توزيع مصعب",
  direct: "مسندة مباشرة",
  teams: "من Teams",
};

export function performance(tasks: OfficeTask[]) {
  const done = tasks.filter((t) => t.status === "done");
  const rated = done.filter((t) => typeof t.rating === "number");
  const avg = rated.length ? rated.reduce((a, t) => a + (t.rating ?? 0), 0) / rated.length : null;
  const score = done.length + (avg ? (avg - 3) * 3 : 0);
  const level = score >= 15 ? "خبير" : score >= 6 ? "متمكّن" : "مبتدئ";
  return { done: done.length, pending: tasks.length - done.length, avg, level };
}

function Stars({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="px-0.5 text-lg leading-none" title={`${n}/5`}>
          {value && n <= value ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}

function TaskItem({ t, person, onBusy }: { t: OfficeTask; person: Person; onBusy: Busy }) {
  const [open, setOpen] = useState(t.status !== "done");
  const [feedback, setFeedback] = useState(t.feedback ?? "");
  const [err, setErr] = useState<string | null>(null);
  const office = useOffice();

  async function run() {
    setErr(null);
    updateTask(t.id, { status: "in_progress" });
    onBusy(person.id, "working");
    try {
      const { result } = await postJSON<{ result: string }>("/api/employee", {
        action: "task",
        employeeId: person.id,
        employees: teamPayload(),
        task: t.title,
      });
      updateTask(t.id, { status: "done", result, doneAt: new Date().toISOString() });
      onBusy(person.id, "done");
      setOpen(true);
    } catch (e) {
      updateTask(t.id, { status: "pending" });
      onBusy(person.id, "idle");
      setErr((e as Error).message);
    }
  }

  const badge =
    t.status === "done" ? "✅ منجزة" : t.status === "in_progress" ? "⏳ جاري التنفيذ" : "🕒 لم تُنجز بعد";

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-3 text-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <button className="text-start font-semibold" onClick={() => setOpen((o) => !o)}>
          {t.title}
        </button>
        <span className="shrink-0 text-xs">{badge}</span>
      </div>
      <div className="text-xs opacity-60">
        {SOURCE[t.source]} • {fmtDate(t.createdAt)}
        {t.goal && <> • الهدف: {t.goal}</>}
      </div>
      {t.status === "pending" && (
        <div className="flex gap-2">
          <button className="tb tb-primary" onClick={run}>▶️ نفّذ الآن</button>
          <button className="tb" onClick={() => removeTask(t.id)}>🗑️ حذف</button>
        </div>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
      {open && t.result && (
        <>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/[.03] dark:bg-white/5 p-2 font-sans leading-7">
            {t.result}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs opacity-70">قيّم العمل:</span>
            <Stars value={t.rating} onChange={(v) => updateTask(t.id, { rating: v })} />
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onBlur={() => feedback !== (t.feedback ?? "") && updateTask(t.id, { feedback })}
              placeholder="ملاحظتك على هذا العمل (اختياري)"
              className="min-w-40 flex-1 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-2 py-1 text-xs"
            />
            {feedback.trim() && (
              <button
                className="tb text-xs"
                title="تُضاف لتعليماته ويلتزم بها في كل عمل قادم"
                onClick={() => {
                  updateTask(t.id, { feedback });
                  const notes = office.development[person.id] ?? [];
                  if (!notes.includes(feedback.trim())) setDevelopment(person.id, [...notes, feedback.trim()]);
                }}
              >
                📈 أضفها لتطويره
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TasksTab({ person, onBusy }: { person: Person; onBusy: Busy }) {
  const office = useOffice();
  const [title, setTitle] = useState("");
  const tasks = office.tasks.filter((t) => t.employeeId === person.id).slice().reverse();
  const pending = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          addTasks([{ employeeId: person.id, title: title.trim(), source: "direct", status: "pending" }]);
          setTitle("");
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`أسند مهمة إلى ${person.name}…`} className={input} />
        <button className="tb tb-primary shrink-0" disabled={!title.trim()}>➕ إسناد</button>
      </form>
      <section className="space-y-2">
        <h3 className="font-bold">🕒 مهام لم تُنجز بعد ({pending.length})</h3>
        {pending.length === 0 && <p className="text-sm opacity-60">لا توجد مهام معلّقة.</p>}
        {pending.map((t) => (
          <TaskItem key={t.id} t={t} person={person} onBusy={onBusy} />
        ))}
      </section>
      <section className="space-y-2">
        <h3 className="font-bold">✅ مهام منجزة ({done.length})</h3>
        {done.length === 0 && <p className="text-sm opacity-60">لم يُنجز مهاماً بعد.</p>}
        {done.map((t) => (
          <TaskItem key={t.id} t={t} person={person} onBusy={onBusy} />
        ))}
      </section>
    </div>
  );
}

function ChatTab({ person }: { person: Person }) {
  const office = useOffice();
  const msgs = office.chats[person.id] ?? [];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [msgs.length, busy]);

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    setText("");
    setErr(null);
    setBusy(true);
    appendChat(person.id, [{ role: "user", content, via: "chat" }]);
    try {
      const history = [...msgs, { role: "user" as const, content }].slice(-20).map((m) => ({ role: m.role, content: m.content }));
      const { reply } = await postJSON<{ reply: string }>("/api/employee", {
        action: "chat",
        employeeId: person.id,
        employees: teamPayload(),
        messages: history,
      });
      appendChat(person.id, [{ role: "assistant", content: reply, via: "chat" }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[55vh] flex-col gap-2">
      <div className="flex-1 space-y-2 overflow-auto rounded-xl bg-black/[.03] dark:bg-white/5 p-3">
        {msgs.length === 0 && <p className="text-center text-sm opacity-60">ابدأ المحادثة مع {person.name}</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-7 ${
                m.role === "user" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-800 shadow-sm"
              }`}
            >
              {m.via === "call" && <span className="me-1 opacity-60">📞</span>}
              {m.content}
            </div>
          </div>
        ))}
        {busy && <p className="text-end text-sm opacity-60">{person.name} يكتب…</p>}
        <div ref={end} />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالتك…" className={input} />
        <button className="tb tb-primary shrink-0" disabled={busy || !text.trim()}>إرسال</button>
      </form>
      {msgs.length > 0 && (
        <button className="self-start text-xs opacity-60 hover:opacity-100" onClick={() => clearChat(person.id)}>
          مسح المحادثة
        </button>
      )}
    </div>
  );
}

interface Review {
  summary: string;
  strengths: string[];
  improvements: string[];
  suggestedNotes: string[];
}

function GrowthTab({ person }: { person: Person }) {
  const office = useOffice();
  const notes = office.development[person.id] ?? [];
  const tasks = office.tasks.filter((t) => t.employeeId === person.id);
  const perf = performance(tasks);
  const [note, setNote] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addNote = (n: string) => {
    const v = n.trim();
    if (v && !notes.includes(v)) setDevelopment(person.id, [...notes, v]);
  };

  async function getReview() {
    setBusy(true);
    setErr(null);
    try {
      setReview(
        await postJSON<Review>("/api/employee", {
          action: "review",
          employeeId: person.id,
          employees: teamPayload(),
          tasks: tasks.map((t) => ({ title: t.title, status: t.status, rating: t.rating, feedback: t.feedback })),
        })
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["المستوى", perf.level],
          ["مهام منجزة", perf.done],
          ["لم تُنجز", perf.pending],
          ["متوسط التقييم", perf.avg ? `${perf.avg.toFixed(1)} / 5` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-black/[.03] dark:bg-white/5 p-3 text-center">
            <div className="text-xs opacity-60">{k}</div>
            <div className="text-lg font-bold">{v}</div>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h3 className="font-bold">📈 توجيهات التطوير</h3>
        <p className="text-xs opacity-60">كل توجيه هنا يُضاف لتعليمات {person.name} ويلتزم به في المهام والمحادثات القادمة.</p>
        {notes.length === 0 && <p className="opacity-60">لا توجد توجيهات بعد.</p>}
        <ul className="space-y-1">
          {notes.map((n, i) => (
            <li key={i} className="flex items-start justify-between gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
              <span>{n}</span>
              <button className="text-xs opacity-50 hover:opacity-100" onClick={() => setDevelopment(person.id, notes.filter((_, j) => j !== i))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addNote(note);
            setNote("");
          }}
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: ابدأ دائماً بملخص تنفيذي من 3 نقاط" className={input} />
          <button className="tb tb-green shrink-0" disabled={!note.trim()}>إضافة</button>
        </form>
      </section>

      <section className="space-y-2">
        <button className="tb tb-violet" onClick={getReview} disabled={busy}>
          {busy ? "مصعب يراجع الأداء…" : "🧭 خطة تطوير من مصعب"}
        </button>
        {err && <p className="text-xs text-red-600">{err}</p>}
        {review && (
          <div className="space-y-2 rounded-xl border border-violet-300 dark:border-violet-800 p-3">
            <p>{review.summary}</p>
            {review.strengths.length > 0 && (
              <div>
                <b>نقاط القوة:</b>
                <ul className="list-disc ps-5">{review.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {review.improvements.length > 0 && (
              <div>
                <b>فرص التحسين:</b>
                <ul className="list-disc ps-5">{review.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {review.suggestedNotes.length > 0 && (
              <div className="space-y-1">
                <b>توجيهات مقترحة:</b>
                {review.suggestedNotes.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span>• {s}</span>
                    <button className="tb text-xs" disabled={notes.includes(s)} onClick={() => addNote(s)}>
                      {notes.includes(s) ? "✓ مضاف" : "➕ اعتمد"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default function EmployeePanel({
  person,
  onClose,
  onBusy,
  onCall,
  onPrivateMeeting,
}: {
  person: Person;
  onClose: () => void;
  onBusy: Busy;
  onCall: (video: boolean) => void;
  onPrivateMeeting: () => void;
}) {
  const [tab, setTab] = useState<Tab>("tasks");
  const isCustom = person.id.startsWith("emp_");

  return (
    <div className="fixed inset-0 z-[1900] flex justify-start bg-black/30" onClick={onClose}>
      <aside
        className="h-full w-full max-w-xl space-y-4 overflow-auto bg-white dark:bg-zinc-900 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Avatar person={person} size={64} />
          <div className="flex-1">
            <div className="text-xl font-bold">{person.name}</div>
            <div className="text-sm opacity-70">{person.role}</div>
          </div>
          <button className="tb" onClick={onClose}>✕</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="tb tb-green" onClick={() => onCall(false)}>📞 اتصال صوتي</button>
          <button className="tb tb-green" onClick={() => onCall(true)}>📹 اتصال فيديو</button>
          <button className="tb tb-teal" onClick={onPrivateMeeting}>🔒 اجتماع خاص</button>
          {isCustom && (
            <button
              className="tb"
              onClick={() => {
                removeEmployee(person.id);
                onClose();
              }}
            >
              🗑️ حذف الموظف
            </button>
          )}
        </div>
        <div className="flex gap-1 border-b border-black/10 dark:border-white/10">
          {(
            [
              ["tasks", "📋 المهام"],
              ["chat", "💬 المحادثة"],
              ["growth", "📈 التطوير والأداء"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? "border-blue-600 text-blue-600" : "border-transparent opacity-60"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "tasks" && <TasksTab person={person} onBusy={onBusy} />}
        {tab === "chat" && <ChatTab person={person} />}
        {tab === "growth" && <GrowthTab person={person} />}
      </aside>
    </div>
  );
}
