import { NextResponse } from "next/server";
import { runTask } from "@/lib/orchestrator";
import { parseTeamInput, buildRoster } from "@/lib/agents";
import { notifyTeamsOnCompletion } from "@/lib/teamsNotifier";

export const maxDuration = 300;

export async function POST(req: Request) {
  let goal: string | undefined;
  let employees: unknown;
  try {
    ({ goal, employees } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  goal = goal?.trim();
  if (!goal) return NextResponse.json({ error: "الهدف مطلوب" }, { status: 400 });
  if (goal.length > 2000) return NextResponse.json({ error: "الهدف طويل جداً" }, { status: 400 });

  try {
    const roster = buildRoster(parseTeamInput(employees));
    const result = await runTask(goal, roster);
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
