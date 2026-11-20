"use client";

import { useSyncExternalStore } from "react";
import { WORKER_IDS, type CustomEmployee } from "@/lib/agents";
import {
  emptyState,
  newId,
  normalizeState,
  trimState,
  type ChatMsg,
  type LearningEntry,
  type MeetingRecord,
  type OfficeState,
  type OfficeTask,
} from "@/lib/officeState";

// مخزن حالة المكتب في المتصفح: يُحفظ محلياً دائماً، ويُزامَن مع قاعدة البيانات إن كانت مفعّلة
const KEY = "vo.state.v2";
const LEGACY_EMPLOYEES_KEY = "vo.employees.v1";
const SERVER_SNAPSHOT = emptyState();

export type StorageMode = "loading" | "cloud" | "local" | "error";

let state: OfficeState = SERVER_SNAPSHOT;
let mode: StorageMode = "loading";
let started = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readLocal(): OfficeState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeState(JSON.parse(raw));
    // ترحيل الموظفين من النسخة السابقة
    const legacy = localStorage.getItem(LEGACY_EMPLOYEES_KEY);
    if (legacy) return { ...emptyState(), employees: JSON.parse(legacy), updatedAt: new Date().toISOString() };
  } catch {
    /* تخزين غير متاح */
  }
  return emptyState();
}

function writeLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* تخزين غير متاح */
  }
}

async function push() {
  if (mode !== "cloud" && mode !== "error") return;
  try {
    const res = await fetch("/api/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    mode = res.ok ? "cloud" : "error";
  } catch {
    mode = "error";
  }
  emit();
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 700);
}

const hasContent = (s: OfficeState) =>
  s.employees.length + s.tasks.length + s.meetings.length + Object.keys(s.chats).length + Object.keys(s.learning).length > 0;

async function start() {
  state = readLocal();
  emit();
  try {
    const res = await fetch("/api/store", { cache: "no-store" });
    const data = await res.json();
    if (!data.enabled) {
      mode = "local";
    } else if (!res.ok) {
      mode = "error";
    } else {
      mode = "cloud";
      const remote = data.state ? normalizeState(data.state) : null;
      if (remote && remote.updatedAt >= state.updatedAt) {
        state = remote;
        writeLocal();
      } else if (hasContent(state)) {
        void push();
      }
    }
  } catch {
    mode = "local";
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    void start();
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) {
        state = readLocal();
        emit();
      }
    });
  }
  return () => listeners.delete(cb);
}

export function useOffice(): OfficeState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
}

export function useStorageMode(): StorageMode {
  return useSyncExternalStore(subscribe, () => mode, () => "loading" as StorageMode);
}

export function getOffice() {
  return state;
}

export function update(fn: (s: OfficeState) => OfficeState) {
  state = trimState({ ...fn(state), updatedAt: new Date().toISOString() });
  writeLocal();
  schedulePush();
  emit();
}

// ─── إجراءات ────────────────────────────────────────────────────────
export const EMPLOYEE_COLORS = [
  "#7c3aed", "#0891b2", "#ca8a04", "#dc2626", "#16a34a", "#9333ea",
  "#0d9488", "#c2410c", "#4f46e5", "#be185d", "#65a30d", "#0284c7",
];

export function addEmployee(e: Omit<CustomEmployee, "id" | "color">) {
  update((s) => ({
    ...s,
    employees: [
      ...s.employees,
      { ...e, id: newId("emp"), color: EMPLOYEE_COLORS[s.employees.length % EMPLOYEE_COLORS.length] },
    ],
  }));
}

export function removeEmployee(id: string) {
  update((s) => ({ ...s, employees: s.employees.filter((e) => e.id !== id) }));
}

export function addTasks(tasks: Omit<OfficeTask, "id" | "createdAt">[]) {
  const now = new Date().toISOString();
  const created = tasks.map((t) => ({ ...t, id: newId("task"), createdAt: now }));
  update((s) => ({ ...s, tasks: [...s.tasks, ...created] }));
  return created;
}

export function updateTask(id: string, patch: Partial<OfficeTask>) {
  update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
}

export function removeTask(id: string) {
  update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
}

export function addMeeting(m: Omit<MeetingRecord, "id" | "at">) {
  update((s) => ({ ...s, meetings: [...s.meetings, { ...m, id: newId("mtg"), at: new Date().toISOString() }] }));
}

export function appendChat(employeeId: string, msgs: Omit<ChatMsg, "at">[]) {
  const at = new Date().toISOString();
  update((s) => ({
    ...s,
    chats: { ...s.chats, [employeeId]: [...(s.chats[employeeId] ?? []), ...msgs.map((m) => ({ ...m, at }))] },
  }));
}

export function clearChat(employeeId: string) {
  update((s) => ({ ...s, chats: { ...s.chats, [employeeId]: [] } }));
}

export function setDevelopment(employeeId: string, notes: string[]) {
  update((s) => ({ ...s, development: { ...s.development, [employeeId]: notes } }));
}

export function addLearning(employeeId: string, entry: Omit<LearningEntry, "id" | "at">) {
  const e: LearningEntry = { ...entry, id: newId("learn"), at: new Date().toISOString() };
  update((s) => ({ ...s, learning: { ...s.learning, [employeeId]: [...(s.learning[employeeId] ?? []), e] } }));
  return e;
}

/** أحدث الخبرات المكتسبة من التطوير الذاتي (تُرسل مع تعليمات الموظف) */
export function learnedSkills(employeeId: string, s: OfficeState = state) {
  return (s.learning[employeeId] ?? []).flatMap((l) => l.takeaways).slice(-12);
}

/** بيانات الفريق التي تُرسل للخادم مع كل طلب (الموظفون الجدد + توجيهات التطوير + الخبرات المكتسبة) */
export function teamPayload(s: OfficeState = state) {
  return [
    ...WORKER_IDS.map((id) => ({ id, development: s.development[id] ?? [], learned: learnedSkills(id, s) })),
    ...s.employees.map((e) => ({ ...e, development: s.development[e.id] ?? [], learned: learnedSkills(e.id, s) })),
  ];
}
