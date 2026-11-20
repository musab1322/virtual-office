import { CORE_UNIT_OF, CORE_UNITS, WORKER_IDS, type CustomEmployee } from "@/lib/agents";

// حالة المكتب الكاملة: تُحفظ في المتصفح، وفي قاعدة البيانات عند توفرها
export type TaskStatus = "pending" | "in_progress" | "done";

export interface OfficeTask {
  id: string;
  employeeId: string;
  title: string;
  goal?: string; // الهدف العام إذا جاءت المهمة من توزيع مساعد
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

/** جلسة تطوير ذاتي يتعلم فيها الموظف شيئاً جديداً في مجاله */
export interface LearningEntry {
  id: string;
  topic: string;
  summary: string;
  takeaways: string[]; // قواعد عملية تُضاف لخبرته وتنعكس على عمله
  at: string;
}

/** إدارة (parentId = null) أو قسم تابع لإدارة */
export interface Department {
  id: string;
  name: string;
  parentId: string | null;
}

/** تعديلات صاحب العمل على ملف أي موظف (أساسي أو جديد) */
export interface ProfileEdit {
  name?: string;
  role?: string;
  specialty?: string;
  style?: string; // أسلوب الكلام والتعامل
  departmentId?: string | null;
  gender?: "m" | "f"; // الجنس (يغيّر الشكل والصوت)
  photo?: string; // صورة الشخصية (data URL مصغّرة) تُجسَّد على الوجه
  voice?: string; // صوت المكالمات (اختياري، وإلا يبقى الصوت الثابت الحالي)
}

export interface OfficeState {
  version: 2;
  updatedAt: string;
  employees: CustomEmployee[];
  tasks: OfficeTask[];
  meetings: MeetingRecord[];
  chats: Record<string, ChatMsg[]>;
  development: Record<string, string[]>; // توجيهات تطوير لكل موظف
  learning: Record<string, LearningEntry[]>; // سجل التطوير الذاتي لكل موظف
  departments: Department[];
  profiles: Record<string, ProfileEdit>;
  orgVersion?: number; // نسخة الهيكل الأساسي المزروع
}

export const emptyState = (): OfficeState => ({
  version: 2,
  updatedAt: new Date(0).toISOString(),
  employees: [],
  tasks: [],
  meetings: [],
  chats: {},
  development: {},
  learning: {},
  departments: [],
  profiles: {},
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
    learning: Object.fromEntries(Object.entries(s.learning).map(([k, v]) => [k, v.slice(-30)])),
    departments: s.departments.slice(0, 60),
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
    learning: r.learning && typeof r.learning === "object" ? r.learning : {},
    departments: Array.isArray(r.departments) ? r.departments : [],
    profiles: r.profiles && typeof r.profiles === "object" ? r.profiles : {},
    orgVersion: typeof r.orgVersion === "number" ? r.orgVersion : 0,
  };
}

// لا نكرر كلمة "إدارة" إذا كانت جزءاً من الاسم (مثل: إدارة التسويق، وحدة النشر، القيادة التنفيذية)
export const topLabel = (n: string) => (/^(إدارة|ادارة|وحدة|القيادة|قطاع)/.test(n) ? n : `إدارة ${n}`);
export const subLabel = (n: string) => (/^(قسم|وحدة)/.test(n) ? n : `قسم ${n}`);

/** وصف مكان الموظف في الهيكل التنظيمي، مثل: "قسم التصميم في إدارة التسويق" */
export function departmentLabel(s: OfficeState, employeeId: string) {
  const d = s.departments.find((x) => x.id === s.profiles[employeeId]?.departmentId);
  if (!d) return "";
  const parent = d.parentId ? s.departments.find((x) => x.id === d.parentId) : null;
  return parent ? `${subLabel(d.name)} في ${topLabel(parent.name)}` : topLabel(d.name);
}

/** بيانات الفريق التي تُرسل للخادم (الملفات المعدّلة + التوجيهات + الخبرات + القسم) */
export function teamInputFromState(s: OfficeState) {
  const extra = (id: string) => {
    const p = s.profiles[id] ?? {};
    return {
      ...(p.name ? { name: p.name } : {}),
      ...(p.role ? { role: p.role } : {}),
      ...(p.specialty ? { specialty: p.specialty } : {}),
      ...(p.style ? { style: p.style } : {}),
      department: departmentLabel(s, id),
      development: s.development[id] ?? [],
      learned: (s.learning?.[id] ?? []).flatMap((l) => l.takeaways).slice(-12),
    };
  };
  return [...WORKER_IDS.map((id) => ({ id, ...extra(id) })), ...s.employees.map((e) => ({ ...e, ...extra(e.id) }))];
}

/** نسخة هيكل الجمعية (الإدارات والوحدات الأساسية وتوزيع الوكلاء عليها) */
export const ORG_VERSION = 2; // 2: وحدة التطوير والمهارات الذكية
const UNIT_VERSION: Record<string, number> = { rnd: 2 };

/** يزرع الهيكل التنظيمي الأساسي مرة واحدة دون المساس بما أضافه صاحب العمل */
export function withCoreOrg(s: OfficeState): OfficeState {
  if ((s.orgVersion ?? 0) >= ORG_VERSION) return s;
  // نضيف فقط الوحدات الجديدة في كل نسخة (حتى لا نعيد ما حذفه صاحب العمل)
  const since = s.orgVersion ?? 0;
  const added = CORE_UNITS.filter((u) => (UNIT_VERSION[u.key] ?? 1) > since && !s.departments.some((d) => d.id === u.id));
  const departments = [...added.map((u) => ({ id: u.id, name: u.name, parentId: null })), ...s.departments];
  const profiles = { ...s.profiles };
  for (const id of WORKER_IDS) {
    const unit = CORE_UNIT_OF[id];
    const skip = since > 0 && !added.some((u) => u.id === unit);
    if (!profiles[id]?.departmentId && !skip) profiles[id] = { ...profiles[id], departmentId: unit };
  }
  return { ...s, departments, profiles, orgVersion: ORG_VERSION };
}
