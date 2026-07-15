/**
 * Store minimaliste (pas de dépendance externe) pour les notifications toast.
 * Même pattern que raceStore.ts / programmeStore.ts : état module-level +
 * CustomEvent pour notifier les abonnés React, sans Context API.
 */
import { useEffect, useState } from "react";

const EVENT = "pmu:toasts-changed";

export type ToastTone = "success" | "error";

export interface ToastAction {
  label: string;
  onClick?: () => void | Promise<void>;
  to?: string;
}

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  durationMs: number;
  actions?: ToastAction[];
  createdAt: number;
  remainingMs: number;
  paused: boolean;
}

let nextId = 0;
let toasts: ToastItem[] = [];
const timers = new Map<number, { timeoutId: ReturnType<typeof setTimeout>; startedAt: number }>();

function notify(): void {
  globalThis.dispatchEvent(new CustomEvent(EVENT));
}

function armTimer(id: number, ms: number): void {
  const timeoutId = setTimeout(() => dismissToast(id), ms);
  timers.set(id, { timeoutId, startedAt: Date.now() });
}

function clearTimer(id: number): void {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t.timeoutId);
    timers.delete(id);
  }
}

export function pushToast(opts: {
  tone: ToastTone;
  message: string;
  durationMs?: number;
  actions?: ToastAction[];
}): number {
  const id = nextId++;
  const durationMs = opts.durationMs ?? 6000;
  const toast: ToastItem = {
    id,
    tone: opts.tone,
    message: opts.message,
    durationMs,
    actions: opts.actions,
    createdAt: Date.now(),
    remainingMs: durationMs,
    paused: false,
  };
  toasts = [...toasts, toast];
  armTimer(id, durationMs);
  notify();
  return id;
}

export function dismissToast(id: number): void {
  clearTimer(id);
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function pauseToast(id: number): void {
  const t = toasts.find((x) => x.id === id);
  const timer = timers.get(id);
  if (!t || !timer || t.paused) return;
  const elapsed = Date.now() - timer.startedAt;
  clearTimer(id);
  t.paused = true;
  t.remainingMs = Math.max(0, t.remainingMs - elapsed);
  toasts = [...toasts];
  notify();
}

export function resumeToast(id: number): void {
  const t = toasts.find((x) => x.id === id);
  if (!t || !t.paused) return;
  t.paused = false;
  armTimer(id, t.remainingMs);
  toasts = [...toasts];
  notify();
}

export function useToastStore(): ToastItem[] {
  const [list, setList] = useState<ToastItem[]>(toasts);
  useEffect(() => {
    const handler = () => setList(toasts);
    globalThis.addEventListener(EVENT, handler);
    return () => globalThis.removeEventListener(EVENT, handler);
  }, []);
  return list;
}
