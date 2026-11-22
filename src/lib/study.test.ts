import test from "node:test";
import assert from "node:assert/strict";
import {
  clock,
  createTimer,
  indiaDate,
  pauseTimer,
  remainingSeconds,
  studiedSeconds,
  studyStreak,
  studySecondsByDate,
  validateBackup,
} from "./study.ts";
import { defaultProfile } from "../data.ts";
import { makePlan, periodStart } from "./plans.ts";

test("countdown uses a deadline even after the browser sleeps", () => {
  const timer = { ...createTimer(), endAt: 1_500_000, runStartedAt: 0 };
  assert.equal(remainingSeconds(timer, 1_200_001), 300);
  assert.equal(remainingSeconds(timer, 2_000_000), 0);
  assert.equal(studiedSeconds(timer, 2_000_000), 1500);
});
test("daily aggregation keeps the IST midnight boundary and adds sessions once", () => {
  const first = Date.parse("2026-11-22T18:29:00Z");
  const second = Date.parse("2026-11-22T18:31:00Z");
  assert.deepEqual(
    studySecondsByDate([
      { id: "a", subject: "", seconds: 60, endedAt: first },
      { id: "b", subject: "", seconds: 120, endedAt: second },
      { id: "c", subject: "", seconds: 30, endedAt: second },
    ]),
    { "2026-11-22": 60, "2026-11-23": 150 },
  );
});

test("pausing and resuming never credits break time or a full session to a late joiner", () => {
  const timer = { ...createTimer(), endAt: 1_500_000, runStartedAt: 0 };
  const paused = pauseTimer(timer, 60_000);
  assert.equal(paused.studiedSeconds, 60);
  assert.equal(studiedSeconds(paused, 3_000_000), 60);
  const resumed = {
    ...paused,
    endAt: 3_000_000 + paused.remaining * 1000,
    runStartedAt: 3_000_000,
  };
  assert.equal(studiedSeconds(resumed, 3_060_000), 120);
  assert.equal(
    studiedSeconds({ ...timer, runStartedAt: 1_400_000 }, 1_500_000),
    100,
  );
  assert.equal(studiedSeconds({ ...timer, mode: "short" }, 1_500_000), 0);
});

test("dates and streaks follow Indian midnight", () => {
  const now = Date.parse("2026-11-22T18:31:00Z");
  assert.equal(indiaDate(now), "2026-11-23");
  assert.equal(
    studyStreak(
      [{ id: "a", seconds: 60, endedAt: now - 86_400_000, subject: "" }],
      now,
    ),
    1,
  );
  assert.equal(studyStreak([], now), 0);
  assert.equal(clock(0), "00:00");
  assert.equal(clock(3600), "60:00");
});

test("backup import rejects malformed and oversized data before replacing anything", () => {
  const backup = {
    version: 1,
    profile: defaultProfile,
    tasks: [],
    notes: [],
    sessions: [],
  };
  assert.deepEqual(validateBackup(backup), backup);
  assert.throws(() =>
    validateBackup({
      ...backup,
      profile: { ...defaultProfile, dailyGoal: -1 },
    }),
  );
  assert.throws(() =>
    validateBackup({ ...backup, sessions: [{ seconds: Infinity }] }),
  );
  assert.throws(() => validateBackup({ ...backup, tasks: [null] }));
});

test("weekly, monthly, and yearly targets use IST calendar boundaries", () => {
  const monday = Date.parse("2026-11-22T18:31:00Z");
  assert.equal(indiaDate(periodStart("weekly", monday)), "2026-11-23");
  assert.equal(indiaDate(periodStart("monthly", monday)), "2026-11-01");
  assert.equal(indiaDate(periodStart("yearly", monday)), "2026-01-01");
});

test("extended backup preserves editable subjects and rejects malformed topics", () => {
  const backup = {
    version: 1,
    profile: defaultProfile,
    tasks: [],
    notes: [],
    sessions: [],
    plan: makePlan(),
    habits: [],
    events: [],
    journal: { identity: "", entries: {} },
  };
  assert.equal(validateBackup(backup).plan?.subjects.length, 11);
  assert.throws(() =>
    validateBackup({
      ...backup,
      plan: {
        ...backup.plan,
        subjects: [
          { id: "bad", name: "Bad", weeklyMinutes: 1, topics: [null] },
        ],
      },
    }),
  );
});

test("backup validates notebook attachments, journal goals, encrypted keys and real dates", () => {
  const file = {
    id: crypto.randomUUID(),
    name: "syllabus.pdf",
    mime: "application/pdf",
    size: 100,
    createdAt: Date.now(),
  };
  const backup = {
    version: 1,
    profile: defaultProfile,
    tasks: [],
    notes: [
      {
        id: "note",
        title: "",
        body: "",
        updatedAt: Date.now(),
        attachments: [file],
      },
    ],
    sessions: [],
    notebooks: [{ id: "book", name: "GATE" }],
    journal: {
      identity: "",
      entries: {
        "2026-11-22": {
          win: "",
          blocker: "",
          next: "",
          goals: [{ id: "goal", title: "Revise graphs", done: true }],
          attachments: [file],
        },
      },
    },
  };
  assert.equal(validateBackup(backup).notes[0].attachments?.length, 1);
  assert.throws(() =>
    validateBackup({
      ...backup,
      notes: [{ ...backup.notes[0], attachments: [{ ...file, size: -1 }] }],
    }),
  );
  assert.throws(() =>
    validateBackup({
      ...backup,
      events: [
        {
          id: "bad",
          title: "",
          date: "2026-02-30",
          time: "29:00",
          minutes: 25,
          subjectId: "",
          done: false,
        },
      ],
    }),
  );
  assert.throws(() =>
    validateBackup({
      ...backup,
      aiSettings: { encryptedKey: { encrypted: "plaintext-key", iv: "" } },
    }),
  );
});
