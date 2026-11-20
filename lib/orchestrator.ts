import { OFFICE_AGENTS, buildRoster, type TeamMember } from "@/lib/agents";
import { chat } from "@/lib/llm";

export interface Deliverable {
  agentId: string;
  agentName: string;
  role: string;
  subtask: string;
  deliverable: string;
}

export interface TaskResult {
  goal: string;
  planSummary: string;
  managerSummary: string;
  deliverables: Deliverable[];
}

interface Plan {
  planSummary: string;
  assignments: { agentId: string; subtask: string }[];
}

async function makePlan(goal: string, roster: TeamMember[]): Promise<Plan> {
  const team = roster.map((m) => `- ${m.id}: ${m.name} (${m.role})`).join("\n");
  const ids = roster.map((m) => `"${m.id}"`).join(" | ");
  const raw = await chat(
    [
      { role: "system", content: OFFICE_AGENTS.musab.systemPrompt },
      {
        role: "user",
        content: `الهدف: "${goal}"

فريقك الحالي (المعرّف: الاسم والدور):
${team}

وزّع العمل على الفريق المناسب فقط (لا يلزم إشراك الجميع). أعد JSON فقط بهذا الشكل:
{"planSummary": "خطة مختصرة في سطرين", "assignments": [{"agentId": ${ids}, "subtask": "وصف المهمة الفرعية"}]}`,
      },
    ],
    { json: true, temperature: 0.3 }
  );

  const parsed = JSON.parse(raw) as Partial<Plan>;
  const assignments = (parsed.assignments || []).filter(
    (a) => a && roster.some((m) => m.id === a.agentId) && typeof a.subtask === "string"
  );
  if (assignments.length === 0) {
    // خطة احتياطية إذا لم يرجع النموذج توزيعاً صالحاً
    assignments.push({ agentId: "omar", subtask: `جهّز خطة تنفيذ للهدف: ${goal}` });
  }
  return { planSummary: parsed.planSummary || "", assignments };
}

async function runAgent(agent: TeamMember, goal: string, subtask: string): Promise<Deliverable> {
  let deliverable: string;
  try {
    deliverable = await chat([
      { role: "system", content: agent.systemPrompt },
      {
        role: "user",
        content: `الهدف العام من المدير مصعب: "${goal}"\nمهمتك: ${subtask}\n\nسلّم مخرجاً عملياً جاهزاً للاستخدام.`,
      },
    ]);
  } catch (e) {
    deliverable = `⚠️ تعذّر إنجاز المهمة: ${(e as Error).message}`;
  }
  return { agentId: agent.id, agentName: agent.name, role: agent.role, subtask, deliverable };
}

async function summarize(goal: string, deliverables: Deliverable[]): Promise<string> {
  const digest = deliverables
    .map((d) => `### ${d.agentName} (${d.role})\n${d.deliverable.slice(0, 2500)}`)
    .join("\n\n");
  return chat(
    [
      { role: "system", content: OFFICE_AGENTS.musab.systemPrompt },
      {
        role: "user",
        content: `الهدف: "${goal}"\n\nهذه مخرجات الفريق:\n${digest}\n\nاكتب ملخصاً تنفيذياً لصاحب العمل في 5 نقاط كحد أقصى، مع الخطوة التالية المقترحة.`,
      },
    ],
    { maxTokens: 600 }
  );
}

/** extraTeam: موظفون جدد أضافهم صاحب العمل من الواجهة (اختياري) */
export async function runTask(goal: string, extraTeam: TeamMember[] = []): Promise<TaskResult> {
  const roster = buildRoster(extraTeam);
  const plan = await makePlan(goal, roster);
  const deliverables = await Promise.all(
    plan.assignments.map((a) => runAgent(roster.find((m) => m.id === a.agentId)!, goal, a.subtask))
  );
  const managerSummary = await summarize(goal, deliverables).catch(() => plan.planSummary);
  return { goal, planSummary: plan.planSummary, managerSummary, deliverables };
}
