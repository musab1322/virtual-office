import { NextResponse } from "next/server";
import { OFFICE_AGENTS, buildRoster, parseTeamInput, type TeamMember } from "@/lib/agents";
import { createTeamsOnlineMeeting, isGraphConfigured } from "@/lib/graph";
import { chat } from "@/lib/llm";
import { notifyTeamsMeeting } from "@/lib/teamsNotifier";

export const maxDuration = 120;

// نقاش محاكى بين الوكلاء ومحضر يصوغه عبدالعزيز (المساعد التنفيذي).
// ملاحظة: هذا محضر لنقاش الفريق الافتراضي، وليس تفريغاً للاجتماع الحقيقي على Teams.
async function generateMeetingMinutes(topic: string, roster: TeamMember[]) {
  const secretary = roster.find((m) => m.id === "omar") ?? roster[0];
  const participants = [
    `- ${OFFICE_AGENTS.musab.name} (${OFFICE_AGENTS.musab.role}): يدير الاجتماع ويحدد الأولويات والجدول الزمني.`,
    ...roster.map((m) => `- ${m.name} (${m.role}): يشارك من زاوية تخصصه${m.id === secretary.id ? " ويكتب المحضر الرسمي" : ""}.`),
  ].join("\n");
  return chat(
    [
      { role: "system", content: secretary.systemPrompt },
      {
        role: "user",
        content: `أنت تكتب محضر اجتماع لفريق المكتب الافتراضي حول: "${topic}".
المشاركون:
${participants}

اكتب بالعربية:
1. خلاصة مداخلة كل عضو (سطران لكل واحد).
2. محضر الاجتماع الرسمي:
   - القرارات المعتمدة
   - المهام الموزعة (المهمة، المسؤول، الموعد)
   - نقاط للمتابعة في الاجتماع القادم`,
      },
    ],
    { maxTokens: 2000 }
  );
}

export async function POST(req: Request) {
  const { topic: rawTopic, employees } = await req.json().catch(() => ({}));
  const roster = buildRoster(parseTeamInput(employees));
  const topic = (typeof rawTopic === "string" && rawTopic.trim()) || "اجتماع الفريق الأسبوعي ومراجعة المهام";

  // ننشئ الاجتماع ونولّد المحضر بالتوازي
  const [meetingResult, minutesResult] = await Promise.allSettled([
    isGraphConfigured() ? createTeamsOnlineMeeting(topic) : Promise.resolve(null),
    generateMeetingMinutes(topic, roster),
  ]);

  const meeting = meetingResult.status === "fulfilled" ? meetingResult.value : null;
  // بدون إعدادات Azure يعمل الاجتماع داخل المكتب الافتراضي، ورابط Teams اختياري
  const teamsLinkEnabled = isGraphConfigured();
  const meetingError =
    meetingResult.status === "rejected" ? (meetingResult.reason as Error).message : null;
  const minutes = minutesResult.status === "fulfilled" ? minutesResult.value : "";

  if (!meeting && !minutes) {
    return NextResponse.json(
      {
        error:
          minutesResult.status === "rejected"
            ? `تعذّر كتابة المحضر: ${(minutesResult.reason as Error).message}`
            : meetingError || "تعذّر بدء الاجتماع",
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
    teamsLinkEnabled,
    minutes,
    teamsNotified,
  });
}
