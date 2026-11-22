import { useEffect, useRef, useState } from "react";
import {
  createTimer,
  pauseTimer,
  remainingSeconds,
  studiedSeconds,
} from "../lib/study";
import { useStoredState } from "../lib/storage";
import type { Session, Subject, TimerMode, TimerState } from "../types";

export function useTimer(
  onSession: (session: Session) => void,
  notify: (message: string) => void,
  subjects: Subject[] = [],
) {
  const [timer, setTimer] = useStoredState<TimerState>("timer", createTimer);
  const [now, setNow] = useState(Date.now());
  const onSessionRef = useRef(onSession);
  const notifyRef = useRef(notify);
  onSessionRef.current = onSession;
  notifyRef.current = notify;

  function saveSession(state: TimerState) {
    const seconds = studiedSeconds(state);
    if (seconds > 0)
      onSessionRef.current({
        id: state.id,
        seconds,
        subject: state.subject,
        subjectId: state.subjectId,
        endedAt:
          state.endAt && state.endAt < Date.now() ? state.endAt : Date.now(),
      });
  }

  useEffect(() => {
    if (timer.endAt === null) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time >= timer.endAt!) {
        const seconds = studiedSeconds(timer, time);
        if (seconds > 0)
          onSessionRef.current({
            id: timer.id,
            seconds,
            subject: timer.subject,
            subjectId: timer.subjectId,
            endedAt: timer.endAt!,
          });
        setTimer({ ...pauseTimer(timer, time), remaining: 0 });
        const message =
          timer.mode === "focus"
            ? "Beautiful work. Your focus session is saved. Time for a break!"
            : "Break’s over. Ready for another small win?";
        notifyRef.current(message);
        if ("Notification" in window && Notification.permission === "granted")
          new Notification("Padhai", { body: message, icon: "/icon-192.png" });
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [timer, setTimer]);

  useEffect(() => {
    if (!timer.endAt || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let cancelled = false;
    async function keepAwake() {
      if (document.visibilityState !== "visible") return;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (cancelled) await acquired.release();
        else lock = acquired;
      } catch {
        /* Devices can decline a wake lock in battery saver mode. */
      }
    }
    void keepAwake();
    document.addEventListener("visibilitychange", keepAwake);
    return () => {
      cancelled = true;
      void lock?.release();
      document.removeEventListener("visibilitychange", keepAwake);
    };
  }, [timer.endAt]);

  function toggle() {
    if (timer.endAt) setTimer(pauseTimer(timer));
    else {
      const state =
        timer.remaining > 0
          ? timer
          : {
              ...createTimer(timer.duration / 60, timer.mode, timer.subject),
              subjectId: timer.subjectId,
            };
      const time = Date.now();
      setTimer({
        ...state,
        endAt: time + state.remaining * 1000,
        runStartedAt: time,
      });
      setNow(time);
    }
  }

  function reset() {
    saveSession(timer);
    setTimer({
      ...createTimer(timer.duration / 60, timer.mode, timer.subject),
      subjectId: timer.subjectId,
    });
  }

  function changeMode(
    mode: TimerMode,
    minutes: number,
    subject = timer.subject,
    subjectId?: string,
  ) {
    saveSession(timer);
    setTimer({
      ...createTimer(minutes, mode, subject),
      subjectId:
        subjectId || subjects.find((item) => item.name === subject)?.id,
    });
  }

  function syncTimer(shared: TimerState) {
    const time = Date.now();
    const ownSeconds = timer.id === shared.id ? studiedSeconds(timer, time) : 0;
    if (timer.id !== shared.id) saveSession(timer);
    // Count only time this student studies, including when joining an ongoing session.
    setTimer({
      ...shared,
      studiedSeconds: ownSeconds,
      runStartedAt: shared.endAt ? time : null,
    });
    setNow(time);
  }

  return {
    timer,
    remaining: remainingSeconds(timer, now),
    toggle,
    reset,
    changeMode,
    syncTimer,
    subjects,
    restoreTimer: setTimer,
    setSubject: (subject: string) =>
      setTimer({
        ...timer,
        subject,
        subjectId: subjects.find((item) => item.name === subject)?.id,
      }),
  };
}

export type FocusTimer = ReturnType<typeof useTimer>;
