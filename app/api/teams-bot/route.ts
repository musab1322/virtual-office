import { after, NextResponse } from "next/server";
import { runTask } from "@/lib/orchestrator";
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
  if (!goal) return reply("أهلاً بك! اكتب المهمة التي تريد من الفريق تنفيذها بعد @Rami.");

  if (!process.env.TEAMS_WEBHOOK_URL) {
    return reply(
      "⚠️ لا يمكنني إرسال النتيجة لاحقاً لأن TEAMS_WEBHOOK_URL غير مضبوط. أضفه أولاً ثم أعد المحاولة."
    );
  }

  // Teams ينتظر الرد خلال ~5 ثوانٍ فقط، لذا نرد فوراً ونكمل العمل بعد الرد
  after(async () => {
    try {
      const result = await runTask(goal);
      await notifyTeamsOnCompletion(result.goal, result.managerSummary, result.deliverables);
    } catch (e) {
      await notifyTeamsText(`❌ تعذّر تنفيذ المهمة "${goal}": ${(e as Error).message}`);
    }
  });

  const who = body.from?.name ? ` يا ${body.from.name}` : "";
  return reply(
    `✅ استلمت المهمة${who}: **${goal}**\n\nوزعتها على الفريق، وسيصلك التقرير الكامل في هذه القناة خلال دقيقة تقريباً. — رامي`
  );
}
