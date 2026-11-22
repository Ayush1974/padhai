import type {
  AISettings,
  Attachment,
  CalendarEvent,
  ExamPlan,
  Habit,
  Journal,
  Notebook,
  Note,
  Profile,
  Session,
  StudyRoom,
  Task,
  TimerMode,
  TimerState,
} from "../types";

const indiaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function indiaDate(time = Date.now()): string {
  return indiaDateFormatter.format(time);
}

export function studySecondsByDate(sessions: Session[]) {
  const totals: Record<string, number> = {};
  for (const session of sessions) {
    const date = indiaDate(session.endedAt);
    totals[date] = (totals[date] || 0) + session.seconds;
  }
  return totals;
}

export function createTimer(
  minutes = 25,
  mode: TimerMode = "focus",
  subject = "",
): TimerState {
  return {
    id: crypto.randomUUID(),
    mode,
    duration: minutes * 60,
    remaining: minutes * 60,
    endAt: null,
    runStartedAt: null,
    studiedSeconds: 0,
    subject,
  };
}

export function remainingSeconds(timer: TimerState, now = Date.now()): number {
  return timer.endAt === null
    ? timer.remaining
    : Math.max(0, Math.ceil((timer.endAt - now) / 1000));
}

export function studiedSeconds(timer: TimerState, now = Date.now()): number {
  if (timer.mode !== "focus") return 0;
  const currentRun =
    timer.runStartedAt !== null && timer.endAt !== null
      ? Math.max(0, (Math.min(now, timer.endAt) - timer.runStartedAt) / 1000)
      : 0;
  return Math.min(
    timer.duration,
    Math.floor(timer.studiedSeconds + currentRun),
  );
}

export function pauseTimer(timer: TimerState, now = Date.now()): TimerState {
  return {
    ...timer,
    remaining: remainingSeconds(timer, now),
    studiedSeconds: studiedSeconds(timer, now),
    endAt: null,
    runStartedAt: null,
  };
}

export function clock(seconds: number): string {
  const rounded = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(rounded / 60)
    .toString()
    .padStart(2, "0")}:${(rounded % 60).toString().padStart(2, "0")}`;
}

export function durationLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m`;
}

export function studyStreak(sessions: Session[], now = Date.now()): number {
  const days = new Set(
    sessions
      .filter((session) => session.seconds >= 60)
      .map((session) => indiaDate(session.endedAt)),
  );
  let cursor = now;
  if (!days.has(indiaDate(cursor))) cursor -= 86_400_000;
  let count = 0;
  while (days.has(indiaDate(cursor))) {
    count++;
    cursor -= 86_400_000;
  }
  return count;
}

export interface Backup {
  version: 1;
  profile: Profile;
  tasks: Task[];
  notes: Note[];
  sessions: Session[];
  plan?: ExamPlan;
  habits?: Habit[];
  events?: CalendarEvent[];
  journal?: Journal;
  timer?: TimerState;
  notebooks?: Notebook[];
  aiSettings?: AISettings;
  myRooms?: StudyRoom[];
}

function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}
function isNumber(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= max
  );
}
export const isDate = (value: unknown): value is string =>
  isText(value, 10) &&
  (value === "" ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
      new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value));
const targetLimits = {
  daily: 1440,
  weekly: 10080,
  monthly: 44640,
  yearly: 527040,
};
function validAttachment(file: Attachment) {
  return (
    file &&
    /^[a-f0-9-]{36}$/.test(file.id) &&
    isText(file.name, 200) &&
    isText(file.mime, 150) &&
    isNumber(file.size, 20_971_520) &&
    file.size > 0 &&
    isNumber(file.createdAt, 10 ** 14) &&
    (!file.parts ||
      (Array.isArray(file.parts) &&
        file.parts.length <= 14 &&
        file.parts.every(
          (part) =>
            part &&
            /^[a-f0-9-]{36}$/.test(part.id) &&
            isNumber(part.size, 2_097_152) &&
            part.size > 0,
        ) &&
        file.parts.reduce((sum, part) => sum + part.size, 0) === file.size))
  );
}
function validFiles(files: Attachment[] | undefined) {
  return (
    files === undefined ||
    (Array.isArray(files) &&
      files.length <= 100 &&
      files.every(validAttachment))
  );
}

export function validateBackup(value: unknown): Backup {
  if (!value || typeof value !== "object")
    throw new Error("Choose a Padhai backup JSON file.");
  const data = value as Backup;
  const profile = data.profile;
  if (
    data.version !== 1 ||
    !profile ||
    !isText(profile.name, 40) ||
    !profile.name.trim() ||
    !["JEE", "NEET", "UPSC", "GATE", "School", "College", "Other"].includes(
      profile.exam,
    ) ||
    !isNumber(profile.dailyGoal, 1440) ||
    profile.dailyGoal < 1 ||
    !isText(profile.language, 12) ||
    typeof profile.lowData !== "boolean" ||
    !isDate(profile.examDate)
  )
    throw new Error("The backup profile is not valid.");
  if (
    !Array.isArray(data.tasks) ||
    data.tasks.length > 5000 ||
    !data.tasks.every(
      (task) =>
        task &&
        isText(task.id, 100) &&
        isText(task.title, 200) &&
        isText(task.subject, 60) &&
        isDate(task.date) &&
        task.date !== "" &&
        typeof task.done === "boolean" &&
        ["normal", "high"].includes(task.priority),
    )
  )
    throw new Error("The backup task list is not valid.");
  if (
    !Array.isArray(data.notes) ||
    data.notes.length > 1000 ||
    !data.notes.every(
      (note) =>
        note &&
        isText(note.id, 100) &&
        isText(note.title, 100) &&
        isText(note.body, 100000) &&
        isNumber(note.updatedAt, 10 ** 14) &&
        (note.notebookId === undefined || isText(note.notebookId, 100)) &&
        validFiles(note.attachments),
    )
  )
    throw new Error("The backup notes are not valid.");
  if (
    data.notebooks &&
    (!Array.isArray(data.notebooks) ||
      data.notebooks.length > 500 ||
      !data.notebooks.every(
        (book) =>
          book &&
          isText(book.id, 100) &&
          isText(book.name, 100) &&
          book.name.trim(),
      ))
  )
    throw new Error("The notebooks are not valid.");
  if (
    data.myRooms &&
    (!Array.isArray(data.myRooms) ||
      data.myRooms.length > 100 ||
      !data.myRooms.every(
        (room) =>
          room &&
          /^room-[a-f0-9-]{36}$/.test(room.id) &&
          isText(room.name, 60) &&
          room.name.trim() &&
          [
            "JEE",
            "NEET",
            "UPSC",
            "GATE",
            "School",
            "College",
            "Other",
          ].includes(room.exam) &&
          [25, 50, 90].includes(room.minutes) &&
          room.private === true &&
          room.image === "/library.jpg" &&
          isText(room.description, 200) &&
          isText(room.tag, 60) &&
          room.color === "orange",
      ))
  )
    throw new Error("The saved room list is not valid.");
  if (
    data.aiSettings &&
    (typeof data.aiSettings !== "object" ||
      (data.aiSettings.encryptedKey &&
        (!isText(data.aiSettings.encryptedKey.encrypted, 1000) ||
          !/^[A-Za-z0-9+/=]+$/.test(data.aiSettings.encryptedKey.encrypted) ||
          !/^[A-Za-z0-9+/=]{16}$/.test(data.aiSettings.encryptedKey.iv))))
  )
    throw new Error("The encrypted AI settings are not valid.");
  if (
    !Array.isArray(data.sessions) ||
    data.sessions.length > 100000 ||
    !data.sessions.every(
      (session) =>
        session &&
        isText(session.id, 100) &&
        isText(session.subject, 100) &&
        isNumber(session.seconds, 86400) &&
        isNumber(session.endedAt, 10 ** 14),
    )
  )
    throw new Error("The backup study history is not valid.");
  if (data.plan) {
    const plan = data.plan;
    if (
      !isText(plan.examName, 100) ||
      !plan.targets ||
      !["daily", "weekly", "monthly", "yearly"].every(
        (period) =>
          isNumber(
            plan.targets[period as keyof typeof plan.targets],
            targetLimits[period as keyof typeof targetLimits],
          ) && plan.targets[period as keyof typeof plan.targets] > 0,
      ) ||
      !Array.isArray(plan.subjects) ||
      plan.subjects.length > 300 ||
      !plan.subjects.every(
        (subject) =>
          subject &&
          isText(subject.id, 100) &&
          isText(subject.name, 100) &&
          isNumber(subject.weeklyMinutes, 10080) &&
          subject.weeklyMinutes >= 1 &&
          Array.isArray(subject.topics) &&
          subject.topics.length <= 2000 &&
          subject.topics.every(
            (topic) =>
              topic &&
              isText(topic.id, 100) &&
              isText(topic.title, 200) &&
              isText(topic.notes, 5000) &&
              typeof topic.done === "boolean",
          ),
      )
    )
      throw new Error("The exam plan is not valid.");
    if (
      plan.source &&
      (!isText(plan.source.url, 2000) ||
        (plan.source.url !== "" && !/^https:\/\//.test(plan.source.url)) ||
        !isText(plan.source.title, 200) ||
        !isText(plan.source.text, 180000) ||
        !isText(plan.source.fetchedAt, 40) ||
        !Number.isFinite(Date.parse(plan.source.fetchedAt)) ||
        (plan.source.attachment && !validAttachment(plan.source.attachment)))
    )
      throw new Error("The syllabus source is not valid.");
  }
  if (
    data.habits &&
    (!Array.isArray(data.habits) ||
      data.habits.length > 500 ||
      !data.habits.every(
        (habit) =>
          habit &&
          isText(habit.id, 100) &&
          isText(habit.title, 100) &&
          isText(habit.area, 60) &&
          isText(habit.cue, 200) &&
          isText(habit.minimum, 200) &&
          isText(habit.ambition, 200) &&
          Array.isArray(habit.completedDates) &&
          habit.completedDates.every((date) => isDate(date) && date !== ""),
      ))
  )
    throw new Error("The habit list is not valid.");
  if (
    data.events &&
    (!Array.isArray(data.events) ||
      data.events.length > 20000 ||
      !data.events.every(
        (event) =>
          event &&
          isText(event.id, 100) &&
          isText(event.title, 120) &&
          isDate(event.date) &&
          event.date !== "" &&
          isText(event.time, 5) &&
          /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.time) &&
          isNumber(event.minutes, 180) &&
          event.minutes >= 1 &&
          isText(event.subjectId, 100) &&
          typeof event.done === "boolean",
      ))
  )
    throw new Error("The calendar is not valid.");
  if (
    data.journal &&
    (!isText(data.journal.identity, 200) ||
      !data.journal.entries ||
      typeof data.journal.entries !== "object" ||
      Array.isArray(data.journal.entries) ||
      !Object.entries(data.journal.entries).every(
        ([date, entry]) =>
          isDate(date) &&
          date !== "" &&
          entry &&
          isText(entry.win, 3000) &&
          isText(entry.blocker, 3000) &&
          isText(entry.next, 3000) &&
          (entry.goal === undefined || isText(entry.goal, 3000)) &&
          (!entry.goals ||
            (Array.isArray(entry.goals) &&
              entry.goals.length <= 100 &&
              entry.goals.every(
                (goal) =>
                  goal &&
                  isText(goal.id, 100) &&
                  isText(goal.title, 200) &&
                  typeof goal.done === "boolean",
              ))) &&
          validFiles(entry.attachments),
      ))
  )
    throw new Error("The reflection journal is not valid.");
  if (
    data.timer &&
    (!["focus", "short", "long"].includes(data.timer.mode) ||
      !isText(data.timer.id, 150) ||
      !isNumber(data.timer.duration, 10800) ||
      data.timer.duration < 60 ||
      !isNumber(data.timer.remaining, 10800) ||
      !isText(data.timer.subject, 100) ||
      !isNumber(data.timer.studiedSeconds, 10800) ||
      (data.timer.endAt !== null && !isNumber(data.timer.endAt, 10 ** 14)) ||
      (data.timer.runStartedAt !== null &&
        !isNumber(data.timer.runStartedAt, 10 ** 14)))
  )
    throw new Error("The timer is not valid.");
  return data;
}
