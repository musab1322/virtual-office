import type { Deliverable } from "@/lib/orchestrator";

// حد حجم رسالة Teams حوالي 28KB، نترك هامشاً للأمان
const MAX_PAYLOAD_BYTES = 24_000;

type CardElement = Record<string, unknown>;

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function wrapCard(body: CardElement[], actions: CardElement[] = []) {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          msteams: { width: "Full" },
          body,
          actions,
        },
      },
    ],
  };
}

const text = (t: string, extra: CardElement = {}): CardElement => ({
  type: "TextBlock",
  text: t,
  wrap: true,
  ...extra,
});

/** يرسل بطاقة إلى قناة Teams عبر رابط Workflows. يعيد false إذا لم يكن الرابط مضبوطاً. */
export async function postToTeams(payload: unknown): Promise<boolean> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error("Teams webhook failed", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

function buildCompletionCard(
  goal: string,
  managerSummary: string,
  deliverables: Deliverable[],
  perAgentLimit: number
) {
  const agentBlocks: CardElement[] = deliverables.map((d) => ({
    type: "Container",
    separator: true,
    spacing: "Medium",
    items: [
      text(`👤 ${d.agentName} (${d.role})`, { weight: "Bolder", color: "Accent" }),
      text(`المهمة: ${d.subtask}`, { isSubtle: true, size: "Small" }),
      text(
        d.deliverable.length > perAgentLimit
          ? d.deliverable.slice(0, perAgentLimit) + "…"
          : d.deliverable,
        { size: "Small" }
      ),
    ],
  }));

  return wrapCard(
    [
      text("✅ تقرير إنجاز المهام — المكتب الافتراضي", { weight: "Bolder", size: "Large" }),
      text(`**الهدف:** ${goal}`),
      text(`**خطة مساعد (المدير العام للوكلاء) بعد تدقيق لطيفة:**\n\n${managerSummary.slice(0, 2000)}`),
      ...agentBlocks,
    ],
    [{ type: "Action.OpenUrl", title: "فتح المكتب الافتراضي", url: appUrl() }]
  );
}

export async function notifyTeamsOnCompletion(
  goal: string,
  managerSummary: string,
  deliverables: Deliverable[]
): Promise<boolean> {
  // نقلّص النص تدريجياً حتى تدخل البطاقة ضمن حد Teams
  let limit = 1500;
  let card = buildCompletionCard(goal, managerSummary, deliverables, limit);
  while (Buffer.byteLength(JSON.stringify(card)) > MAX_PAYLOAD_BYTES && limit > 200) {
    limit = Math.floor(limit * 0.7);
    card = buildCompletionCard(goal, managerSummary, deliverables, limit);
  }
  return postToTeams(card);
}

export async function notifyTeamsMeeting(
  topic: string,
  joinUrl: string | null,
  minutes: string
): Promise<boolean> {
  const card = wrapCard(
    [
      text(`🎥 اجتماع الفريق: ${topic}`, { weight: "Bolder", size: "Large" }),
      ...(joinUrl ? [] : [text("لم يُنشأ رابط Teams (إعدادات Azure غير مكتملة).", { color: "Warning" })]),
      text("📝 **محضر نقاش الفريق الافتراضي (إعداد لطيفة):**"),
      text(minutes.slice(0, 15_000), { size: "Small" }),
    ],
    joinUrl ? [{ type: "Action.OpenUrl", title: "انضمام لاجتماع Teams", url: joinUrl }] : []
  );
  return postToTeams(card);
}

export async function notifyTeamsText(message: string): Promise<boolean> {
  return postToTeams(wrapCard([text(message)]));
}
