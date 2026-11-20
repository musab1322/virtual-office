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
    systemPrompt: `أنت مصعب، المدير العام لمكتب افتراضي من وكلاء الذكاء الاصطناعي. تستلم هدفاً من صاحب العمل، فتقسمه إلى مهام فرعية وتوزعها على فريقك من الموظفين (تصلك أسماؤهم وأدوارهم وأقسامهم مع كل مهمة). تحدد الأولويات والجدول الزمني ثم تلخص النتائج. ${STYLE}`,
  },
  kareem: {
    id: "kareem",
    gender: "m",
    name: "سلطان",
    role: "مشتري الإعلانات",
    emoji: "📣",
    color: "#ea580c",
    systemPrompt: `أنت سلطان، مشتري الإعلانات (Media Buyer). تخصصك: اختيار القنوات الإعلانية، الجمهور المستهدف، أفكار الإعلانات والنصوص، توزيع الميزانية، ومؤشرات الأداء. ${STYLE}`,
  },
  mona: {
    id: "mona",
    gender: "f",
    name: "نورة",
    role: "أخصائية مسارات التحويل",
    emoji: "🎯",
    color: "#db2777",
    systemPrompt: `أنتِ نورة، أخصائية مسارات التحويل (Funnel Specialist). تخصصك: رحلة العميل، صفحات الهبوط، العروض، رسائل المتابعة، وتحسين معدل التحويل. ${STYLE}`,
  },
  omar: {
    id: "omar",
    gender: "m",
    name: "عبدالعزيز",
    role: "المساعد التنفيذي",
    emoji: "📝",
    color: "#059669",
    systemPrompt: `أنت عبدالعزيز، المساعد التنفيذي. تخصصك: تحويل الخطط إلى جداول زمنية ومهام بمسؤولين ومواعيد، كتابة محاضر الاجتماعات الرسمية، وقوائم المتابعة. ${STYLE}`,
  },
};

export const WORKER_IDS: AgentId[] = ["kareem", "mona", "omar"];

/** تخصص الموظفين الأساسيين (يُستخدم عند تعديل أسمائهم أو مسمياتهم) */
export const CORE_SPECIALTY: Record<string, string> = {
  kareem: "اختيار القنوات الإعلانية، الجمهور المستهدف، أفكار الإعلانات والنصوص، توزيع الميزانية، ومؤشرات الأداء",
  mona: "رحلة العميل، صفحات الهبوط، العروض، رسائل المتابعة، وتحسين معدل التحويل",
  omar: "تحويل الخطط إلى جداول زمنية ومهام بمسؤولين ومواعيد، كتابة محاضر الاجتماعات الرسمية، وقوائم المتابعة",
};

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
  style?: string; // أسلوب كلام حدده صاحب العمل
  department?: string;
}

export function customSystemPrompt(e: Pick<CustomEmployee, "name" | "role" | "specialty">) {
  return `أنت ${e.name}، تعمل بمسمى "${e.role}" في مكتب افتراضي يديره المدير العام مصعب. تخصصك: ${e.specialty || e.role}. ${STYLE}`;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export interface TeamInput {
  id: string;
  name?: string;
  role?: string;
  specialty?: string;
  development?: string[];
  learned?: string[];
  style?: string;
  department?: string;
}

/** توجيهات المدير لتطوير الموظف تُضاف إلى تعليماته */
function withDevelopment(prompt: string, notes: string[], learned: string[] = []) {
  let out = prompt;
  if (notes.length) out += `\n\nتوجيهات المدير لتطوير أدائك (التزم بها دائماً):\n${notes.map((n) => `- ${n}`).join("\n")}`;
  if (learned.length)
    out += `\n\nخبرات اكتسبتها من تطويرك الذاتي في مجالك (طبّقها في عملك):\n${learned.map((n) => `- ${n}`).join("\n")}`;
  return out;
}

/**
 * يتحقق من بيانات الفريق القادمة من المتصفح (موظفون جدد + توجيهات التطوير لأي موظف)
 * ويعيد خريطة بالمعرّف. الأساسيون لا يمكن تغيير أسمائهم أو أدوارهم من هنا.
 */
export function parseTeamInput(raw: unknown): Map<string, TeamMember> {
  const out = new Map<string, TeamMember>();
  if (!Array.isArray(raw)) return out;
  for (const item of raw.slice(0, 30)) {
    const r = (item ?? {}) as Record<string, unknown>;
    const id = clean(r.id, 40);
    const dev = Array.isArray(r.development)
      ? r.development.map((d) => clean(d, 300)).filter(Boolean).slice(0, 15)
      : [];
    const learned = Array.isArray(r.learned)
      ? r.learned.map((d) => clean(d, 300)).filter(Boolean).slice(-12)
      : [];
    const style = clean(r.style, 400);
    const department = clean(r.department, 120);
    const where = (p: string) => (department ? `${p}\nتعمل في ${department}.` : p);
    if (id in OFFICE_AGENTS) {
      const a = OFFICE_AGENTS[id as AgentId];
      const name = clean(r.name, 40) || a.name;
      const role = clean(r.role, 60) || a.role;
      const specialty = clean(r.specialty, 400);
      // إذا عدّل صاحب العمل الاسم أو المسمى أو التخصص نبني التعليمات من جديد
      const base =
        name !== a.name || role !== a.role || specialty
          ? customSystemPrompt({ name, role, specialty: specialty || CORE_SPECIALTY[id] || role })
          : a.systemPrompt;
      out.set(id, { id, name, role, style: style || undefined, department: department || undefined, systemPrompt: withDevelopment(where(base), dev, learned) });
      continue;
    }
    const name = clean(r.name, 40);
    const role = clean(r.role, 60);
    const specialty = clean(r.specialty, 400);
    if (!/^emp_[a-z0-9]+$/i.test(id) || !name || !role || out.has(id)) continue;
    out.set(id, {
      id,
      name,
      role,
      style: style || undefined,
      department: department || undefined,
      systemPrompt: withDevelopment(where(customSystemPrompt({ name, role, specialty })), dev, learned),
    });
  }
  return out;
}

/** للتوافق: الموظفون الجدد فقط من قائمة الفريق */
export function parseCustomEmployees(raw: unknown): TeamMember[] {
  return [...parseTeamInput(raw).values()].filter((m) => m.id.startsWith("emp_"));
}

function coreMember(id: AgentId): TeamMember {
  const a = OFFICE_AGENTS[id];
  return { id: a.id, name: a.name, role: a.role, systemPrompt: a.systemPrompt };
}

/** الفريق الذي يوزّع عليه مصعب: الأساسيون (مع توجيهاتهم) + الموظفون الجدد */
export function buildRoster(team: Map<string, TeamMember> | TeamMember[] = []): TeamMember[] {
  const map = Array.isArray(team) ? new Map(team.map((m) => [m.id, m])) : team;
  const core = WORKER_IDS.map((id) => map.get(id) ?? coreMember(id));
  const extra = [...map.values()].filter((m) => m.id.startsWith("emp_"));
  return [...core, ...extra];
}

/** موظف واحد بالمعرّف (أساسي أو جديد) */
export function findMember(team: Map<string, TeamMember>, id: string): TeamMember | undefined {
  if (team.has(id)) return team.get(id);
  if (id in OFFICE_AGENTS) return coreMember(id as AgentId);
  return undefined;
}

// ─── أسلوب كلام ثابت لكل موظف (في المكالمات والمحادثات) ───────────────
const CORE_STYLES: Record<string, string> = {
  kareem:
    "أسلوبك ثابت دائماً: متحمس وواثق، تتكلم بجمل قصيرة سريعة، تبدأ غالباً بـ«أبشر» أو «تم يا طويل العمر»، وتربط كلامك بالأرقام والنتائج.",
  mona: "أسلوبك ثابت دائماً: هادئة ولطيفة ودقيقة، تستخدمين «أكيد» و«خلني أوضح لك»، وتركزين على تجربة العميل.",
  omar: "أسلوبك ثابت دائماً: رسمي ومهذب ومنظم، تبدأ بـ«حاضر» أو «تحت أمرك»، وتلخص بالخطوات والمواعيد.",
};
const EXTRA_STYLES = [
  "أسلوبك ثابت دائماً: ودود وعملي، تتكلم ببساطة ووضوح، وتختم باقتراح الخطوة التالية.",
  "أسلوبك ثابت دائماً: هادئ وتحليلي، توضح السبب قبل النتيجة بجملة قصيرة.",
  "أسلوبك ثابت دائماً: نشيط ومبادر، تقترح حلولاً سريعة وتسأل سؤالاً واحداً للتوضيح عند الحاجة.",
];

export function speakingStyle(id: string, custom?: string) {
  if (custom?.trim()) return `أسلوبك ثابت دائماً: ${custom.trim()}`;
  if (CORE_STYLES[id]) return CORE_STYLES[id];
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return EXTRA_STYLES[Math.abs(h) % EXTRA_STYLES.length];
}
