export type AgentId = "musab" | "kareem" | "mona" | "omar";

export type Gender = "m" | "f";

export interface OfficeAgent {
  id: AgentId;
  name: string;
  role: string;
  emoji: string;
  color: string;
  gender: Gender;
  systemPrompt: string;
}

export const STYLE =
  "اكتب دائماً بالعربية الفصحى المبسطة، بنقاط واضحة وقابلة للتنفيذ، ولا تخترع أرقاماً أو حقائق غير مذكورة.";

export const OFFICE_AGENTS: Record<AgentId, OfficeAgent> = {
  musab: {
    id: "musab",
    gender: "m",
    name: "مصعب",
    role: "المدير العام",
    emoji: "🧑‍💼",
    color: "#2563eb",
    systemPrompt: `أنت مصعب، المدير العام لمكتب افتراضي من وكلاء الذكاء الاصطناعي. تستلم هدفاً من صاحب العمل، فتقسمه إلى مهام فرعية وتوزعها على فريقك: كريم (مشتري الإعلانات وجلب الزيارات)، منى (أخصائية مسارات التحويل وصفحات الهبوط)، عمر (المساعد التنفيذي: التنظيم والجداول والمحاضر والمتابعة). تحدد الأولويات والجدول الزمني ثم تلخص النتائج. ${STYLE}`,
  },
  kareem: {
    id: "kareem",
    gender: "m",
    name: "كريم",
    role: "مشتري الإعلانات",
    emoji: "📣",
    color: "#ea580c",
    systemPrompt: `أنت كريم، مشتري الإعلانات (Media Buyer). تخصصك: اختيار القنوات الإعلانية، الجمهور المستهدف، أفكار الإعلانات والنصوص، توزيع الميزانية، ومؤشرات الأداء. ${STYLE}`,
  },
  mona: {
    id: "mona",
    gender: "f",
    name: "منى",
    role: "أخصائية مسارات التحويل",
    emoji: "🎯",
    color: "#db2777",
    systemPrompt: `أنتِ منى، أخصائية مسارات التحويل (Funnel Specialist). تخصصك: رحلة العميل، صفحات الهبوط، العروض، رسائل المتابعة، وتحسين معدل التحويل. ${STYLE}`,
  },
  omar: {
    id: "omar",
    gender: "m",
    name: "عمر",
    role: "المساعد التنفيذي",
    emoji: "📝",
    color: "#059669",
    systemPrompt: `أنت عمر، المساعد التنفيذي. تخصصك: تحويل الخطط إلى جداول زمنية ومهام بمسؤولين ومواعيد، كتابة محاضر الاجتماعات الرسمية، وقوائم المتابعة. ${STYLE}`,
  },
};

export const WORKER_IDS: AgentId[] = ["kareem", "mona", "omar"];

// ─── موظفون جدد يضيفهم صاحب العمل من الواجهة ───────────────────────
export interface CustomEmployee {
  id: string; // يبدأ بـ "emp_"
  name: string;
  role: string;
  specialty: string;
  gender: Gender;
  color: string;
}

/** أي عضو في الفريق (أساسي أو جديد) بالشكل الذي يحتاجه المنسّق */
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
}

export function customSystemPrompt(e: Pick<CustomEmployee, "name" | "role" | "specialty">) {
  return `أنت ${e.name}، تعمل بمسمى "${e.role}" في مكتب افتراضي يديره المدير العام مصعب. تخصصك: ${e.specialty || e.role}. ${STYLE}`;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** يتحقق من قائمة الموظفين القادمة من المتصفح ويحوّلها لأعضاء فريق */
export function parseCustomEmployees(raw: unknown): TeamMember[] {
  if (!Array.isArray(raw)) return [];
  const out: TeamMember[] = [];
  for (const item of raw.slice(0, 20)) {
    const r = (item ?? {}) as Record<string, unknown>;
    const id = clean(r.id, 40);
    const name = clean(r.name, 40);
    const role = clean(r.role, 60);
    const specialty = clean(r.specialty, 400);
    if (!/^emp_[a-z0-9]+$/i.test(id) || !name || !role) continue;
    if (out.some((m) => m.id === id)) continue;
    out.push({ id, name, role, systemPrompt: customSystemPrompt({ name, role, specialty }) });
  }
  return out;
}

/** الفريق الذي يوزّع عليه مصعب: الأساسيون + الموظفون الجدد */
export function buildRoster(extra: TeamMember[] = []): TeamMember[] {
  const core = WORKER_IDS.map((id) => {
    const a = OFFICE_AGENTS[id];
    return { id: a.id, name: a.name, role: a.role, systemPrompt: a.systemPrompt };
  });
  return [...core, ...extra];
}
