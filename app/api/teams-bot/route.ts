import { after, NextResponse } from "next/server";
import { runTask } from "@/lib/orchestrator";
import { isDbConfigured, loadState, updateState } from "@/lib/db";
import { buildRoster, parseTeamInput } from "@/lib/agents";
import { newId } from "@/lib/officeState";
import { verifyTeamsHmac } from "@/lib/teamsAuth";
import { notifyTeamsOnCompletion, notifyTeamsText } from "@/lib/teamsNotifier";

// المهمة تكمل في الخلفية بعد الرد على Teams، فنعطيها وقتاً كافياً
export const maxDuration = 300;

const reply = (text: string) => NextResponse.json({ type: "message", text });

function cleanText(html: string | undefined): string {
  return (html || "")
    .replace(/<at>.*?<\/at>/gi, "") // اسم البوت المذكور
    .replace(/<[^>]+>/g, " ") // أي وسوم HTML
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  // نقرأ النص الخام أولاً لأن التوقيع محسوب عليه حرفياً
  const raw = await req.text();
  if (!verifyTeamsHmac(raw, req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: string; from?: { name?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const goal = cleanText(body.text);
  if (!goal) return reply("أهلاً بك! اكتب المهمة التي تريد من الفريق تنفيذها بعد @Musab.");

  if (!process.env.TEAMS_WEBHOOK_URL) {
    return reply(
      "⚠️ لا يمكنني إرسال النتيجة لاحقاً لأن TEAMS_WEBHOOK_URL غير مضبوط. أضفه أولاً ثم أعد المحاولة."
    );
  }

  // Teams ينتظر الرد خلال ~5 ثوانٍ فقط، لذا نرد فوراً ونكمل العمل بعد الرد
  after(async () => {
    try {
      // مع قاعدة البيانات: الفريق يشمل الموظفين الجدد وتوجيهات التطوير
      let team;
      if (isDbConfigured()) {
        const st = await loadState().catch(() => null);
        if (st) {
          const ids = ["kareem", "mona", "omar", ...st.employees.map((e) => e.id)];
          const input = ids.map((id) => ({
            ...(st.employees.find((e) => e.id === id) ?? { id }),
            development: st.development[id] ?? [],
          }));
          team = buildRoster(parseTeamInput(input));
        }
      }
      const result = await runTask(goal, team);
      await notifyTeamsOnCompletion(result.goal, result.managerSummary, result.deliverables);
      // نسجل المهام في ملف كل موظف (إذا كانت قاعدة البيانات مفعلة)
      const now = new Date().toISOString();
      await updateState((s) => ({
        ...s,
        tasks: [
          ...s.tasks,
          ...result.deliverables.map((d) => ({
            id: newId("task"),
            employeeId: d.agentId,
            title: d.subtask,
            goal: result.goal,
            source: "teams" as const,
            status: "done" as const,
            result: d.deliverable,
            createdAt: now,
            doneAt: now,
          })),
        ],
      })).catch(() => false);
    } catch (e) {
      await notifyTeamsText(`❌ تعذّر تنفيذ المهمة "${goal}": ${(e as Error).message}`);
    }
  });

  const who = body.from?.name ? ` يا ${body.from.name}` : "";
  return reply(
    `✅ استلمت المهمة${who}: **${goal}**\n\nوزعتها على الفريق، وسيصلك التقرير الكامل في هذه القناة خلال دقيقة تقريباً. — مصعب`
  );
}
