import { DEPUTY_ID, MANAGER_ID, OFFICE_AGENTS, buildRoster, type TeamMember } from "@/lib/agents";
import { chat, research } from "@/lib/llm";

// ─── آلية العمل (Workflow) ───────────────────────────────────────────
// 0) بالتوازي مع التخطيط: منيرة ونواف يبحثان في الإنترنت في الخلفية (أفضل التجارب + أحدث الأدوات والمهارات).
// 1) مساعد يحلل التوجيه ويحدد المسار (حملة / شراكة / مشروع خارجي / عام) ويوزع المهام.
// 2) الوكلاء المختصون ينفذون (المرحلة الأولى بالتوازي).
// 3) من يعتمد على مخرجات غيره ينفذ بعدهم (مثل ماجد: يأخذ الفيديو والتصاميم ويكتب النشر).
// 4) مدير كل إدارة يدمج مخرجات فريقه في خلاصة إدارته.
// 5) لطيفة تدقق كل المخرجات لغوياً وشرعياً ومؤسسياً.
// 6) مساعد يجمع كل شيء في خطة عمل جاهزة للتنفيذ ويعرضها على الأستاذ مصعب.

export interface Deliverable {
  agentId: string;
  agentName: string;
  role: string;
  subtask: string;
  deliverable: string;
  stage?: "research" | "execute" | "department" | "review";
  web?: boolean; // اعتمد على بحث فعلي في الإنترنت
}

export interface TaskResult {
  goal: string;
  flow: string;
  planSummary: string;
  managerSummary: string;
  deliverables: Deliverable[];
}

interface Assignment {
  agentId: string;
  subtask: string;
}

/** المسارات الجاهزة: يفعّل مساعد الوكلاء المعنيين تلقائياً */
const FLOWS: { key: string; label: string; match: RegExp; required: Record<string, string> }[] = [
  {
    key: "campaign",
    label: "إطلاق حملة",
    match: /حمل[ةه]|حملات|إطلاق|اطلاق|تبرع|كفال|وقف|إهداء|اهداء|رمضان/,
    required: {
      faisal: "حلل الجمهور المستهدف والمانحين المحتملين لهذه الحملة، وتوجهات التبرع المرتبطة بها، واقترح أفضل مشروع/فئات تبرع.",
      haya: "صمّم الحملة: الاسم، الفكرة المحورية، الرسائل والعبارات المؤثرة، دعوات التبرع، ومراحل الحملة.",
      khalid: "اقترح 3 أفكار مقاطع قصيرة للحملة، واكتب سيناريو كاملاً لأقواها (المشهد البصري | النص الصوتي | المونتاج والمؤثرات بلا موسيقى).",
      reem: "اكتب موجزات وأوامر تصميم لبوستر الحملة الرئيسي وتصميمين للسوشيال وإنفوجرافيك، مع الألوان والنصوص داخل كل تصميم.",
      majed: "اكتب نصوص النشر لكل منصة (X، إنستغرام، سناب شات، تيك توك، لينكدإن) مع أوقات النشر والهاشتاقات وخطة الترويج الممول.",
    },
  },
  {
    key: "partnership",
    label: "تجهيز ملف شراكة",
    match: /شراك|شريك|رعا[يئ]|راع[يٍ]|مانح|خطاب|عرض شراكة|proposal/i,
    required: {
      muneera: "ارصد نماذج شراكات ناجحة لجمعيات تحفيظ وجمعيات خيرية متميزة، وكيف نحاكيها لجمعيتنا.",
      faisal: "حدد فئات الجهات المانحة والشركات المناسبة لهذه الشراكة ومعايير اختيارها وأولوياتها.",
      abdulrahman: "أعد ملف عرض الشراكة (Proposal) كاملاً بباقات الرعاية ومزايا الشريك، وخطاب التقديم الرسمي المرافق.",
      reem: "اكتب موجز تصميم ملف الشراكة (الغلاف والصفحات الداخلية) مع الألوان والنصوص.",
    },
  },
];

/** وكلاء البحث في الخلفية مع كل مبادرة */
const BACKGROUND: Record<string, string> = {
  muneera:
    "ابحث في الإنترنت عن أفضل التجارب والمبادرات المشابهة لهذا التوجيه لدى جمعيات تحفيظ القرآن والجمعيات الخيرية المتميزة (أو لدى مشاريع مشابهة إن كان التوجيه لمشروع خارج الجمعية)، واستخلص 5 أفكار ناجحة قابلة للتطبيق لدينا، مع ذكر المصدر لكل فكرة.",
  nawaf:
    "ابحث في الإنترنت عن أحدث الأدوات والمهارات والأساليب (بما فيها أدوات الذكاء الاصطناعي) المناسبة لتنفيذ هذا التوجيه بجودة أعلى، واقترح لكل وكيل معني ما يستخدمه وكيف، مع ذكر المصدر.",
};

/** وكلاء ينفذون مهامهم ببحث فعلي في الإنترنت */
const WEB_AGENTS = new Set(["faisal", "muneera", "nawaf"]);

/** وكلاء يعتمدون على مخرجات غيرهم فيعملون في المرحلة الثانية */
const SECOND_STAGE = new Set(["majed"]);

function detectFlows(goal: string) {
  return FLOWS.filter((f) => f.match.test(goal));
}

const digestOf = (items: Deliverable[], per = 1800) =>
  items.map((d) => `### ${d.agentName} (${d.role})\nالمهمة: ${d.subtask}\n${d.deliverable.slice(0, per)}`).join("\n\n");

async function makePlan(goal: string, roster: TeamMember[], flows: typeof FLOWS) {
  const assignable = roster.filter((m) => m.id !== DEPUTY_ID && !(m.id in BACKGROUND));
  const team = assignable
    .map((m) => `- ${m.id}: ${m.name} (${m.role}${m.department ? ` — ${m.department}` : ""})`)
    .join("\n");
  const required = flows.flatMap((f) => Object.keys(f.required)).filter((id) => assignable.some((m) => m.id === id));
  let planSummary = "";
  let assignments: Assignment[] = [];
  try {
    const raw = await chat(
      [
        { role: "system", content: OFFICE_AGENTS[MANAGER_ID].systemPrompt },
        {
          role: "user",
          content: `توجيه الأستاذ مصعب: "${goal}"
${flows.length ? `المسار المفعّل تلقائياً: ${flows.map((f) => f.label).join(" + ")}. يجب إشراك: ${[...new Set(required)].join("، ")}.` : ""}

فريقك (المعرّف: الاسم والدور):
${team}

حدّد أولاً: هل التوجيه لإدارة الاتصال والتسويق بالجمعية أم لمشروع خارجي؟ والتزم بهوية الجهة المعنية.
ثم وزّع المهام على الوكلاء المناسبين فقط، بمهمة واضحة ومحددة لكل وكيل وبلا تكرار. (لطيفة تدقق المخرجات تلقائياً، ومنيرة ونواف يبحثان في الخلفية تلقائياً، فلا توزع عليهم). أعد JSON فقط:
{"planSummary": "تحليلك للتوجيه وخطتك في 3 أسطر", "assignments": [{"agentId": "المعرّف", "subtask": "المهمة"}]}`,
        },
      ],
      { json: true, temperature: 0.3, maxTokens: 1200 }
    );
    const parsed = JSON.parse(raw) as { planSummary?: string; assignments?: Assignment[] };
    planSummary = typeof parsed.planSummary === "string" ? parsed.planSummary : "";
    assignments = (parsed.assignments || []).filter(
      (a) => a && assignable.some((m) => m.id === a.agentId) && typeof a.subtask === "string" && a.subtask.trim()
    );
  } catch {
    /* نكمل بالخطة الاحتياطية */
  }
  // نضمن تفعيل وكلاء المسار الجاهز
  for (const f of flows) {
    for (const [id, subtask] of Object.entries(f.required)) {
      if (assignable.some((m) => m.id === id) && !assignments.some((a) => a.agentId === id)) {
        assignments.push({ agentId: id, subtask });
      }
    }
  }
  // دمج المهام المكررة لنفس الوكيل
  const merged = new Map<string, string>();
  for (const a of assignments) merged.set(a.agentId, merged.has(a.agentId) ? `${merged.get(a.agentId)}\n- ${a.subtask}` : a.subtask);
  assignments = [...merged].map(([agentId, subtask]) => ({ agentId, subtask }));
  if (!assignments.length) {
    const fallback = assignable.find((m) => m.id === "othman") ?? assignable[0];
    assignments.push({ agentId: fallback.id, subtask: `جهّز خطة تنفيذ عملية للتوجيه: ${goal}` });
  }
  return { planSummary, assignments };
}

async function runAgent(
  agent: TeamMember,
  goal: string,
  subtask: string,
  context = "",
  stage: Deliverable["stage"] = "execute"
): Promise<Deliverable> {
  let deliverable: string;
  let web = false;
  const messages = [
    { role: "system" as const, content: agent.systemPrompt },
    {
      role: "user" as const,
      content: `توجيه الأستاذ مصعب: "${goal}"
مهمتك من المدير العام مساعد: ${subtask}
${context ? `\nما تبني عليه (بحث الخلفية ومخرجات الزملاء):\n${context}\n` : ""}
سلّم مخرجاً عملياً جاهزاً للاستخدام، منظماً بعناوين.`,
    },
  ];
  try {
    if (WEB_AGENTS.has(agent.id)) {
      const r = await research(messages, { maxTokens: 1400 });
      deliverable = r.text;
      web = r.web;
    } else {
      deliverable = await chat(messages, { maxTokens: 1400 });
    }
  } catch (e) {
    deliverable = `⚠️ تعذّر إنجاز المهمة: ${(e as Error).message}`;
  }
  return { agentId: agent.id, agentName: agent.name, role: agent.role, subtask, deliverable, stage, web };
}

/** مدير الإدارة يدمج مخرجات فريقه */
async function departmentBrief(head: TeamMember, goal: string, team: Deliverable[], bg = ""): Promise<Deliverable> {
  const subtask = `دمج مخرجات فريق الإدارة (${team.map((d) => d.agentName).join("، ")})`;
  let deliverable: string;
  try {
    deliverable = await chat(
      [
        { role: "system", content: head.systemPrompt },
        {
          role: "user",
          content: `توجيه الأستاذ مصعب: "${goal}"
هذه مخرجات فريق إدارتك:
${digestOf(team, 1500)}
${bg ? `\nبحث الخلفية (تجارب الجمعيات وأحدث الأدوات):\n${bg}` : ""}

بصفتك مدير الإدارة: اكتب خلاصة إدارتك في 6 نقاط كحد أقصى: أهم ما نعتمده، ما نعدّله، وما نطوّره مستفيدين من أحدث الأساليب وتجارب الجمعيات الأخرى في مجالك (من بحث الخلفية)، ثم الأولويات والخطوة التالية لإدارتك. لا تكرر المخرجات كاملة.`,
        },
      ],
      { maxTokens: 800 }
    );
  } catch (e) {
    deliverable = `⚠️ تعذّر الدمج: ${(e as Error).message}`;
  }
  return { agentId: head.id, agentName: head.name, role: head.role, subtask, deliverable, stage: "department" };
}

/** لطيفة: التدقيق اللغوي والشرعي والمؤسسي قبل الاعتماد */
async function qualityReview(deputy: TeamMember, goal: string, items: Deliverable[]): Promise<Deliverable> {
  let deliverable: string;
  try {
    deliverable = await chat(
      [
        { role: "system", content: deputy.systemPrompt },
        {
          role: "user",
          content: `توجيه الأستاذ مصعب: "${goal}"
راجعي هذه المخرجات قبل اعتمادها:
${digestOf(items, 1600)}

اكتبي تقرير التدقيق:
1. جدول: المخرج | الحكم (معتمد / معتمد بملاحظات / يحتاج تعديل) | الملاحظة.
2. التعديلات الإلزامية نصاً (لغوية، شرعية — خصوصاً أي ذكر لموسيقى أو معازف —، ومؤسسية).
3. أي تكرار أو تعارض بين الإدارات، وما ينقص لإكمال العمل.`,
        },
      ],
      { maxTokens: 1300, temperature: 0.2 }
    );
  } catch (e) {
    deliverable = `⚠️ تعذّر التدقيق: ${(e as Error).message}`;
  }
  return {
    agentId: deputy.id,
    agentName: deputy.name,
    role: deputy.role,
    subtask: "التدقيق اللغوي والشرعي والمؤسسي قبل الاعتماد",
    deliverable,
    stage: "review",
  };
}

async function finalPlan(goal: string, flow: string, items: Deliverable[], review: Deliverable) {
  return chat(
    [
      { role: "system", content: OFFICE_AGENTS[MANAGER_ID].systemPrompt },
      {
        role: "user",
        content: `توجيه الأستاذ مصعب: "${goal}"${flow ? ` (المسار: ${flow})` : ""}
مخرجات الفريق:
${digestOf(items, 1200)}

تقرير تدقيق لطيفة:
${review.deliverable.slice(0, 2500)}

اكتب للأستاذ مصعب خطة عمل متكاملة جاهزة للتنفيذ، بعد تطبيق ملاحظات لطيفة:
1. الخلاصة في 3 أسطر.
2. المخرجات المعتمدة (من أعدها وأين يجدها).
3. جدول التنفيذ: المهمة | المسؤول | الموعد المقترح.
4. ما يحتاج قراراً أو بيانات من الأستاذ مصعب.`,
      },
    ],
    { maxTokens: 1300 }
  );
}

/** team: الفريق كاملاً كما بُني من الواجهة (اختياري؛ الافتراضي الفريق الأساسي) */
export async function runTask(goal: string, team?: TeamMember[]): Promise<TaskResult> {
  const roster = team?.length ? team : buildRoster();
  const byId = new Map(roster.map((m) => [m.id, m]));
  const flows = detectFlows(goal);
  const flow = flows.map((f) => f.label).join(" + ");
  // البحث في الخلفية (منيرة ونواف) يعمل بالتوازي مع تخطيط مساعد
  const bgTasks = Object.entries(BACKGROUND)
    .filter(([id]) => byId.has(id))
    .map(([id, task]) => {
      const flowTask = flows.map((f) => f.required[id]).find(Boolean);
      return { id, task: flowTask ? `${flowTask}\n${task}` : task };
    });
  const [plan, background] = await Promise.all([
    makePlan(goal, roster, flows),
    Promise.all(bgTasks.map((t) => runAgent(byId.get(t.id)!, goal, t.task, "", "research"))),
  ]);
  const bgDigest = digestOf(background, 1100);

  // المرحلة الأولى بالتوازي (مع نتائج البحث)، ثم من يعتمد على مخرجاتهم
  const first = plan.assignments.filter((a) => !SECOND_STAGE.has(a.agentId));
  const second = plan.assignments.filter((a) => SECOND_STAGE.has(a.agentId));
  const stage1 = await Promise.all(first.map((a) => runAgent(byId.get(a.agentId)!, goal, a.subtask, bgDigest)));
  const stage2 = await Promise.all(
    second.map((a) => runAgent(byId.get(a.agentId)!, goal, a.subtask, digestOf(stage1, 1100)))
  );
  const executed = [...background, ...stage1, ...stage2];

  // مديرو الإدارات يدمجون مخرجات فرقهم ويطورونها بتجارب الجمعيات الأخرى (إذا لم يكلَّفوا مباشرة)
  const heads = roster.filter((m) => OFFICE_AGENTS[m.id as keyof typeof OFFICE_AGENTS]?.head);
  const work = [...stage1, ...stage2];
  const briefs = await Promise.all(
    heads
      .filter((h) => !work.some((d) => d.agentId === h.id))
      .map((h) => ({ h, team: work.filter((d) => OFFICE_AGENTS[d.agentId as keyof typeof OFFICE_AGENTS]?.reportsTo === h.id) }))
      .filter((x) => x.team.length > 0)
      .map((x) => departmentBrief(x.h, goal, x.team, bgDigest))
  );

  const all = [...executed, ...briefs];
  const deputy = byId.get(DEPUTY_ID);
  const review = deputy
    ? await qualityReview(deputy, goal, all)
    : { agentId: DEPUTY_ID, agentName: "لطيفة", role: "", subtask: "", deliverable: "", stage: "review" as const };
  const managerSummary = await finalPlan(goal, flow, all, review).catch(() => plan.planSummary);
  return {
    goal,
    flow,
    planSummary: plan.planSummary,
    managerSummary,
    deliverables: deputy ? [...all, review] : all,
  };
}
