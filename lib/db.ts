import { normalizeState, trimState, type OfficeState } from "@/lib/officeState";

// تخزين حالة المكتب في Supabase (جدول vo_state). يعمل فقط إذا ضُبط المتغيران:
// SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY (مفتاح الخادم، لا يُرسل للمتصفح أبداً)
const ROW_ID = "main";

export function isDbConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

const base = () => `${process.env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/vo_state`;

export async function loadState(): Promise<OfficeState | null> {
  const res = await fetch(`${base()}?id=eq.${ROW_ID}&select=data`, {
    headers: headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as { data: unknown }[];
  return rows.length ? normalizeState(rows[0].data) : null;
}

export async function saveState(state: OfficeState): Promise<void> {
  const res = await fetch(base(), {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: ROW_ID, data: trimState(state), updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
}

/** تعديل الحالة على الخادم (مثلاً من بوت Teams) */
export async function updateState(fn: (s: OfficeState) => OfficeState): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const current = (await loadState()) ?? normalizeState(null);
  await saveState({ ...fn(current), updatedAt: new Date().toISOString() });
  return true;
}
