import type { CustomEmployee } from "@/lib/agents";

// حالة المكتب الكاملة: تُحفظ في المتصفح، وفي قاعدة البيانات عند توفرها
export type TaskStatus = "pending" | "in_progress" | "done";

export interface OfficeTask {
  id: string;
  employeeId: string;
  title: string;
  goal?: string; // الهدف العام إذا جاءت المهمة من توزيع مصعب
  source: "manager" | "direct" | "teams";
  status: TaskStatus;
  result?: string;
  rating?: number; // 1..5
  feedback?: string;
  createdAt: string;
  doneAt?: string;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  at: string;
  via?: "chat" | "call";
}

export interface MeetingRecord {
  id: string;
  kind: "team" | "private";
  topic: string;
  participants: string[]; // أسماء
  minutes: string;
  teamsUrl?: string | null;
  at: string;
}

export interface OfficeState {
  version: 2;
  updatedAt: string;
  employees: CustomEmployee[];
  tasks: OfficeTask[];
  meetings: MeetingRecord[];
  chats: Record<string, ChatMsg[]>;
  development: Record<string, string[]>; // توجيهات تطوير لكل موظف
}

export const emptyState = (): OfficeState => ({
  version: 2,
  updatedAt: new Date(0).toISOString(),
  employees: [],
  tasks: [],
  meetings: [],
  chats: {},
  development: {},
});

export const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const cut = (s: string | undefined, n: number) => (s && s.length > n ? s.slice(0, n) + "…" : s);

/** يحد من حجم الحالة حتى تبقى خفيفة في التخزين */
export function trimState(s: OfficeState): OfficeState {
  return {
    ...s,
    employees: s.employees.slice(0, 40),
    tasks: s.tasks.slice(-400).map((t) => ({ ...t, result: cut(t.result, 8000) })),
    meetings: s.meetings.slice(-100).map((m) => ({ ...m, minutes: cut(m.minutes, 12000) ?? "" })),
    chats: Object.fromEntries(
      Object.entries(s.chats).map(([k, v]) => [k, v.slice(-60).map((m) => ({ ...m, content: cut(m.content, 3000) ?? "" }))])
    ),
    development: Object.fromEntries(Object.entries(s.development).map(([k, v]) => [k, v.slice(0, 15)])),
  };
}

/** يتحقق بشكل مرن من شكل الحالة القادمة من التخزين */
export function normalizeState(raw: unknown): OfficeState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<OfficeState>;
  return {
    version: 2,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : base.updatedAt,
    employees: Array.isArray(r.employees) ? r.employees : [],
    tasks: Array.isArray(r.tasks) ? r.tasks : [],
    meetings: Array.isArray(r.meetings) ? r.meetings : [],
    chats: r.chats && typeof r.chats === "object" ? r.chats : {},
    development: r.development && typeof r.development === "object" ? r.development : {},
  };
}
