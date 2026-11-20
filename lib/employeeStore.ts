"use client";

import { useSyncExternalStore } from "react";
import type { CustomEmployee } from "@/lib/agents";

// الموظفون الجدد يُحفظون في متصفح صاحب العمل (localStorage)
const KEY = "vo.employees.v1";
const EVENT = "vo-employees-changed";
const EMPTY: CustomEmployee[] = [];

let cacheRaw: string | null = null;
let cacheVal: CustomEmployee[] = EMPTY;

function read(): CustomEmployee[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cacheRaw) return cacheVal;
  cacheRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cacheVal = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cacheVal = EMPTY;
  }
  return cacheVal;
}

function write(list: CustomEmployee[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* التخزين غير متاح */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useEmployees() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const EMPLOYEE_COLORS = [
  "#7c3aed", "#0891b2", "#ca8a04", "#dc2626", "#16a34a", "#9333ea",
  "#0d9488", "#c2410c", "#4f46e5", "#be185d", "#65a30d", "#0284c7",
];

export function addEmployee(e: Omit<CustomEmployee, "id" | "color">) {
  const list = read();
  const id = `emp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const color = EMPLOYEE_COLORS[list.length % EMPLOYEE_COLORS.length];
  write([...list, { ...e, id, color }]);
}

export function removeEmployee(id: string) {
  write(read().filter((e) => e.id !== id));
}
