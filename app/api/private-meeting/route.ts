import { NextResponse } from "next/server";
import { MANAGER_ID, findMember, parseTeamInput } from "@/lib/agents";
import { chat } from "@/lib/llm";

export const maxDuration = 120;

// اجتماع خاص (1:1) بين الأستاذ مصعب وأحد الوكلاء في الغرفة الخاصة
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    employeeId?: unknown;
    topic?: unknown;
    employees?: unknown;
  };
  const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 2000) : "";
  if (!topic) return NextResponse.json({ error: "اكتب موضوع الاجتماع الخاص" }, { status: 400 });

  const member = employeeId === MANAGER_ID ? undefined : findMember(parseTeamInput(body.employees), employeeId);
  if (!member) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });

  try {
    const reply = await chat(
      [
        { role: "system", content: member.systemPrompt },
        {
          role: "user",
          content: `أنت الآن في اجتماع خاص على انفراد مع الأستاذ مصعب (مدير إدارة الاتصال والتسويق).
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
