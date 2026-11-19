import { NextResponse } from "next/server";
import { runTask } from "@/lib/orchestrator";
import { notifyTeamsOnCompletion } from "@/lib/teamsNotifier";

export const maxDuration = 300;

export async function POST(req: Request) {
  let goal: string | undefined;
  try {
    ({ goal } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  goal = goal?.trim();
  if (!goal) return NextResponse.json({ error: "الهدف مطلوب" }, { status: 400 });
  if (goal.length > 2000) return NextResponse.json({ error: "الهدف طويل جداً" }, { status: 400 });

  try {
    const result = await runTask(goal);
    const teamsNotified = await notifyTeamsOnCompletion(
      result.goal,
      result.managerSummary,
      result.deliverables
    ).catch(() => false);

    return NextResponse.json({ status: "completed", teamsNotified, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
