import { NextResponse } from "next/server";
import { DEPUTY_ID, buildRoster, managerMember, parseTeamInput, type TeamMember } from "@/lib/agents";
import { createTeamsOnlineMeeting, isGraphConfigured } from "@/lib/graph";
import { chat } from "@/lib/llm";
import { notifyTeamsMeeting } from "@/lib/teamsNotifier";

export const maxDuration = 120;

// نقاش محاكى بين الوكلاء ومحضر تصوغه لطيفة (نائبة المدير للجودة والربط بين الإدارات).
// ملاحظة: هذا محضر لنقاش الفريق الافتراضي، وليس تفريغاً للاجتماع الحقيقي على Teams.
async function generateMeetingMinutes(topic: string, roster: TeamMember[], manager: TeamMember) {
  const secretary = roster.find((m) => m.id === DEPUTY_ID) ?? roster[0];
  const participants = [
    `- ${manager.name} (${manager.role}): يدير الاجتماع نيابة عن الأستاذ مصعب ويحدد الأولويات والجدول الزمني.`,
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
  const team = parseTeamInput(employees);
  const roster = buildRoster(team);
  const manager = managerMember(team);
  const topic = (typeof rawTopic === "string" && rawTopic.trim()) || "اجتماع الفريق الأسبوعي ومراجعة المهام";

  // ننشئ الاجتماع ونولّد المحضر بالتوازي
  const [meetingResult, minutesResult] = await Promise.allSettled([
    isGraphConfigured() ? createTeamsOnlineMeeting(topic) : Promise.resolve(null),
    generateMeetingMinutes(topic, roster, manager),
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
