import { NextResponse } from "next/server";
import { OFFICE_AGENTS } from "@/lib/agents";
import { createTeamsOnlineMeeting, isGraphConfigured } from "@/lib/graph";
import { chat } from "@/lib/llm";
import { notifyTeamsMeeting } from "@/lib/teamsNotifier";

export const maxDuration = 120;

// نقاش محاكى بين الوكلاء ومحضر يصوغه عمر.
// ملاحظة: هذا محضر لنقاش الفريق الافتراضي، وليس تفريغاً للاجتماع الحقيقي على Teams.
async function generateMeetingMinutes(topic: string) {
  return chat(
    [
      { role: "system", content: OFFICE_AGENTS.omar.systemPrompt },
      {
        role: "user",
        content: `أنت تدير اجتماعاً لفريق المكتب الافتراضي حول: "${topic}".
المشاركون:
- رامي (المدير العام): يحدد الأولويات والجدول الزمني.
- كريم (مشتري الإعلانات): يقترح أفكار جلب الزيارات والإعلانات.
- منى (أخصائية مسارات التحويل): تقترح خطوات التحويل وصفحات الهبوط.
- عمر (المساعد التنفيذي): يكتب المحضر الرسمي.

اكتب بالعربية:
1. خلاصة مداخلة كل عضو (سطران لكل واحد).
2. محضر الاجتماع الرسمي:
   - القرارات المعتمدة
   - المهام الموزعة (المهمة، المسؤول، الموعد)
   - نقاط للمتابعة في الاجتماع القادم`,
      },
    ],
    { maxTokens: 1800 }
  );
}

export async function POST(req: Request) {
  const { topic: rawTopic } = await req.json().catch(() => ({}));
  const topic = (typeof rawTopic === "string" && rawTopic.trim()) || "اجتماع الفريق الأسبوعي ومراجعة المهام";

  // ننشئ الاجتماع ونولّد المحضر بالتوازي
  const [meetingResult, minutesResult] = await Promise.allSettled([
    isGraphConfigured() ? createTeamsOnlineMeeting(topic) : Promise.resolve(null),
    generateMeetingMinutes(topic),
  ]);

  const meeting = meetingResult.status === "fulfilled" ? meetingResult.value : null;
  const meetingError =
    meetingResult.status === "rejected"
      ? (meetingResult.reason as Error).message
      : !isGraphConfigured()
        ? "إعدادات Azure غير مكتملة، لذلك لم يُنشأ رابط Teams."
        : null;
  const minutes = minutesResult.status === "fulfilled" ? minutesResult.value : "";

  if (!meeting && !minutes) {
    return NextResponse.json(
      {
        error: meetingError || "تعذّر بدء الاجتماع",
        minutesError: minutesResult.status === "rejected" ? (minutesResult.reason as Error).message : undefined,
      },
      { status: 500 }
    );
  }

  const teamsNotified = await notifyTeamsMeeting(topic, meeting?.joinWebUrl ?? null, minutes).catch(
    () => false
  );

  return NextResponse.json({
    topic,
    meetingUrl: meeting?.joinWebUrl ?? null,
    meetingError,
    minutes,
    teamsNotified,
  });
}
