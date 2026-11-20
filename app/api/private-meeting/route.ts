import { NextResponse } from "next/server";
import { OFFICE_AGENTS, WORKER_IDS, parseCustomEmployees, type AgentId, type TeamMember } from "@/lib/agents";
import { chat } from "@/lib/llm";

export const maxDuration = 120;

// اجتماع خاص (1:1) بين المدير مصعب وأحد الموظفين في الغرفة الخاصة
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    employeeId?: unknown;
    topic?: unknown;
    employees?: unknown;
  };
  const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 2000) : "";
  if (!topic) return NextResponse.json({ error: "اكتب موضوع الاجتماع الخاص" }, { status: 400 });

  let member: TeamMember | undefined;
  if ((WORKER_IDS as string[]).includes(employeeId)) {
    const a = OFFICE_AGENTS[employeeId as AgentId];
    member = { id: a.id, name: a.name, role: a.role, systemPrompt: a.systemPrompt };
  } else {
    member = parseCustomEmployees(body.employees).find((m) => m.id === employeeId);
  }
  if (!member) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });

  try {
    const reply = await chat(
      [
        { role: "system", content: member.systemPrompt },
        {
          role: "user",
          content: `أنت الآن في اجتماع خاص على انفراد مع المدير العام مصعب.
موضوع الاجتماع: "${topic}"

تحدّث مباشرة مع مصعب بصيغة المتكلم: قدّم رأيك وما تحتاجه منه، ثم اختم بـ "الالتزامات" (ما ستنفذه أنت ومتى) و"المطلوب من مصعب".`,
        },
      ],
      { maxTokens: 1000 }
    );
    return NextResponse.json({ employeeId: member.id, name: member.name, role: member.role, topic, reply });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
