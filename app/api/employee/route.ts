import { NextResponse } from "next/server";
import { OFFICE_AGENTS, findMember, parseTeamInput, speakingStyle } from "@/lib/agents";
import { chat, type ChatMessage } from "@/lib/llm";

export const maxDuration = 120;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * التعامل المباشر مع موظف واحد:
 * - chat: محادثة (نصية أو مكالمة صوتية عند mode = "call")
 * - task: تنفيذ مهمة أسندها صاحب العمل لهذا الموظف
 * - review: خطة تطوير لأداء الموظف يكتبها المدير مصعب
 * - learn: جلسة تطوير ذاتي يتعلم فيها الموظف مهارة جديدة في مجاله
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = str(body.action, 20);
  const id = str(body.employeeId, 40);
  const member = id === "musab" ? undefined : findMember(parseTeamInput(body.employees), id);
  if (!member) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });

  try {
    if (action === "chat") {
      const call = body.mode === "call";
      const history: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
        .slice(-20)
        .map((m) => {
          const r = (m ?? {}) as Record<string, unknown>;
          return {
            role: r.role === "assistant" ? "assistant" : "user",
            content: str(r.content, 3000),
          } as ChatMessage;
        })
        .filter((m) => m.content);
      if (!history.length || history[history.length - 1].role !== "user") {
        return NextResponse.json({ error: "اكتب رسالتك" }, { status: 400 });
      }
      const reply = await chat(
        [
          {
            role: "system",
            content: `${member.systemPrompt}\n${speakingStyle(member.id, member.style)}\nأنت تتحدث الآن مباشرة مع صاحب العمل (مديرك). ${
              call
                ? "هذه مكالمة صوتية سريعة مثل النقاش: رد بجملة أو جملتين قصيرتين فقط (أقل من 35 كلمة)، بلهجة سعودية طبيعية، بدون رموز أو قوائم أو أرقام نقاط. إذا كان الكلام غير واضح اطلب التوضيح بجملة واحدة."
                : "أجب بإيجاز ووضوح."
            }`,
          },
          ...history,
        ],
        call ? { maxTokens: 120, temperature: 0.35 } : { maxTokens: 900, temperature: 0.5 }
      );
      return NextResponse.json({ reply });
    }

    if (action === "task") {
      const title = str(body.task, 1500);
      if (!title) return NextResponse.json({ error: "اكتب المهمة" }, { status: 400 });
      const result = await chat([
        { role: "system", content: member.systemPrompt },
        {
          role: "user",
          content: `مهمة أسندها لك صاحب العمل مباشرة: "${title}"\n\nسلّم مخرجاً عملياً جاهزاً للاستخدام.`,
        },
      ]);
      return NextResponse.json({ result });
    }

    if (action === "review") {
      const tasks = (Array.isArray(body.tasks) ? body.tasks : []).slice(-15).map((t) => {
        const r = (t ?? {}) as Record<string, unknown>;
        const rating = typeof r.rating === "number" ? ` — التقييم ${r.rating}/5` : "";
        const fb = str(r.feedback, 300);
        return `- ${str(r.title, 200)} (${str(r.status, 20)})${rating}${fb ? ` — ملاحظة: ${fb}` : ""}`;
      });
      const raw = await chat(
        [
          { role: "system", content: OFFICE_AGENTS.musab.systemPrompt },
          {
            role: "user",
            content: `اكتب خطة تطوير لأداء الموظف ${member.name} (${member.role}).
سجل مهامه:
${tasks.join("\n") || "لا توجد مهام مسجلة بعد."}

أعد JSON فقط بهذا الشكل:
{"summary": "تقييم مختصر في سطرين", "strengths": ["..."], "improvements": ["..."], "suggestedNotes": ["توجيه قصير وعملي يمكن إضافته لتعليمات الموظف", "..."]}`,
          },
        ],
        { json: true, temperature: 0.3, maxTokens: 900 }
      );
      const plan = JSON.parse(raw);
      return NextResponse.json({
        summary: str(plan.summary, 600),
        strengths: (Array.isArray(plan.strengths) ? plan.strengths : []).map((x: unknown) => str(x, 300)).slice(0, 6),
        improvements: (Array.isArray(plan.improvements) ? plan.improvements : []).map((x: unknown) => str(x, 300)).slice(0, 6),
        suggestedNotes: (Array.isArray(plan.suggestedNotes) ? plan.suggestedNotes : []).map((x: unknown) => str(x, 300)).slice(0, 6),
      });
    }

    if (action === "learn") {
      const prev = (Array.isArray(body.previousTopics) ? body.previousTopics : []).map((x) => str(x, 120)).filter(Boolean).slice(-15);
      const tasks = (Array.isArray(body.tasks) ? body.tasks : []).slice(-8).map((t) => {
        const r = (t ?? {}) as Record<string, unknown>;
        const fb = str(r.feedback, 200);
        return `- ${str(r.title, 160)}${typeof r.rating === "number" ? ` (تقييم ${r.rating}/5)` : ""}${fb ? ` — ملاحظة المدير: ${fb}` : ""}`;
      });
      const raw = await chat(
        [
          { role: "system", content: member.systemPrompt },
          {
            role: "user",
            content: `حان وقت جلسة التطوير الذاتي اليومية. اختر مهارة أو أسلوباً عملياً واحداً جديداً في مجال تخصصك (${member.role}) يرفع جودة عملك، وتعلّمه بعمق.
${prev.length ? `مواضيع تعلمتها سابقاً (لا تكررها، وابنِ عليها):\n${prev.map((p) => `- ${p}`).join("\n")}` : ""}
${tasks.length ? `آخر مهامك (استفد منها في اختيار ما ينقصك):\n${tasks.join("\n")}` : ""}

أعد JSON فقط بهذا الشكل:
{"topic": "عنوان المهارة في أقل من 10 كلمات", "summary": "ما تعلمته ولماذا يهم، في 2-3 جمل", "takeaways": ["قاعدة عملية قصيرة ستطبقها في عملك", "...", "..."]}`,
          },
        ],
        { json: true, temperature: 0.7, maxTokens: 700 }
      );
      const r = JSON.parse(raw);
      const takeaways = (Array.isArray(r.takeaways) ? r.takeaways : []).map((x: unknown) => str(x, 250)).filter(Boolean).slice(0, 4);
      const topic = str(r.topic, 120);
      if (!topic || !takeaways.length) throw new Error("لم يكتمل التعلم، حاول مرة أخرى");
      return NextResponse.json({ topic, summary: str(r.summary, 600), takeaways });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
