import { OFFICE_AGENTS, WORKER_IDS, type AgentId } from "@/lib/agents";
import { chat } from "@/lib/llm";

export interface Deliverable {
  agentId: AgentId;
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
  assignments: { agentId: AgentId; subtask: string }[];
}

async function makePlan(goal: string): Promise<Plan> {
  const raw = await chat(
    [
      { role: "system", content: OFFICE_AGENTS.musab.systemPrompt },
      {
        role: "user",
        content: `الهدف: "${goal}"

وزّع العمل على الفريق المناسب فقط (لا يلزم إشراك الجميع). أعد JSON فقط بهذا الشكل:
{"planSummary": "خطة مختصرة في سطرين", "assignments": [{"agentId": "kareem" | "mona" | "omar", "subtask": "وصف المهمة الفرعية"}]}`,
      },
    ],
    { json: true, temperature: 0.3 }
  );

  const parsed = JSON.parse(raw) as Partial<Plan>;
  const assignments = (parsed.assignments || []).filter(
    (a) => a && WORKER_IDS.includes(a.agentId) && typeof a.subtask === "string"
  );
  if (assignments.length === 0) {
    // خطة احتياطية إذا لم يرجع النموذج توزيعاً صالحاً
    assignments.push({ agentId: "omar", subtask: `جهّز خطة تنفيذ للهدف: ${goal}` });
  }
  return { planSummary: parsed.planSummary || "", assignments };
}

async function runAgent(agentId: AgentId, goal: string, subtask: string): Promise<Deliverable> {
  const agent = OFFICE_AGENTS[agentId];
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
  return { agentId, agentName: agent.name, role: agent.role, subtask, deliverable };
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

export async function runTask(goal: string): Promise<TaskResult> {
  const plan = await makePlan(goal);
  const deliverables = await Promise.all(
    plan.assignments.map((a) => runAgent(a.agentId, goal, a.subtask))
  );
  const managerSummary = await summarize(goal, deliverables).catch(() => plan.planSummary);
  return { goal, planSummary: plan.planSummary, managerSummary, deliverables };
}
