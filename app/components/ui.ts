// أنماط مشتركة للواجهة
export const card = "rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4";
export const input = "w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent p-3";

export function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-SA-u-nu-latn", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "حدث خطأ غير متوقع");
  return data as T;
}
