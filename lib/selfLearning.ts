"use client";

import { useEffect, useSyncExternalStore } from "react";
import { addLearning, getOffice, teamPayload, useStorageMode } from "@/lib/officeStore";
import { postJSON } from "@/app/components/ui";

// التطوير الذاتي: كل موظف يتعلم مهارة جديدة في مجاله مرة يومياً،
// وتُضاف خلاصتها إلى تعليماته فتنعكس على مهامه ومحادثاته ومكالماته.
export const LEARN_EVERY_MS = 24 * 60 * 60 * 1000;

let current: string | null = null;
const listeners = new Set<() => void>();
const setCurrent = (id: string | null) => {
  current = id;
  listeners.forEach((l) => l());
};

/** الموظف الذي يتعلم الآن (إن وجد) */
export function useLearningNow() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null
  );
}

export function lastLearnedAt(employeeId: string) {
  const list = getOffice().learning[employeeId] ?? [];
  return list.length ? new Date(list[list.length - 1].at).getTime() : 0;
}

export async function runLearning(employeeId: string) {
  if (current) throw new Error("هناك موظف يتعلم الآن، انتظر قليلاً");
  setCurrent(employeeId);
  try {
    const s = getOffice();
    const r = await postJSON<{ topic: string; summary: string; takeaways: string[] }>("/api/employee", {
      action: "learn",
      employeeId,
      employees: teamPayload(),
      previousTopics: (s.learning[employeeId] ?? []).map((l) => l.topic),
      tasks: s.tasks
        .filter((t) => t.employeeId === employeeId)
        .map((t) => ({ title: t.title, rating: t.rating, feedback: t.feedback })),
    });
    return addLearning(employeeId, r);
  } finally {
    setCurrent(null);
  }
}

/** جدولة تلقائية: يتعلم موظف واحد كل مرة، لمن مضى على آخر تعلّمه يوم كامل */
export function useAutoLearning(ids: string[]) {
  const storage = useStorageMode();
  const key = ids.join(",");
  useEffect(() => {
    if (storage === "loading") return;
    const list = key.split(",").filter(Boolean);
    let stopped = false;
    const failed = new Set<string>();
    async function tick() {
      if (stopped || current || document.hidden) return;
      const due = list
        .filter((id) => !failed.has(id) && Date.now() - lastLearnedAt(id) > LEARN_EVERY_MS)
        .sort((a, b) => lastLearnedAt(a) - lastLearnedAt(b))[0];
      if (!due) return;
      try {
        await runLearning(due);
      } catch {
        failed.add(due); // نتجاوزه حتى إعادة تحميل الصفحة
      }
    }
    const first = setTimeout(tick, 8000);
    const t = setInterval(tick, 45000);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(t);
    };
  }, [storage, key]);
}
