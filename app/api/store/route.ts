import { NextResponse } from "next/server";
import { isDbConfigured, loadState, saveState } from "@/lib/db";
import { normalizeState } from "@/lib/officeState";


const MAX_BYTES = 3_000_000;

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ enabled: false });
  try {
    return NextResponse.json({ enabled: true, state: await loadState() });
  } catch (e) {
    return NextResponse.json({ enabled: true, error: (e as Error).message }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ enabled: false }, { status: 501 });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "البيانات كبيرة جداً" }, { status: 413 });
  try {
    await saveState(normalizeState(JSON.parse(raw)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
