export type Page =
  | "rooms"
  | "progress"
  | "planner"
  | "notes"
  | "resources"
  | "settings"
  | "exam"
  | "calendar"
  | "habits"
  | "wisdom";
export type Exam =
  "JEE" | "NEET" | "UPSC" | "GATE" | "School" | "College" | "Other";

export interface Profile {
  name: string;
  exam: Exam;
  dailyGoal: number;
  language: string;
  lowData: boolean;
  examDate: string;
}

export interface Task {
  id: string;
  title: string;
  subject: string;
  date: string;
  done: boolean;
  priority: "normal" | "high";
}

export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  notebookId?: string;
  attachments?: Attachment[];
}
export interface Notebook {
  id: string;
  name: string;
}
export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  parts?: { id: string; size: number }[];
}
export interface AISettings {
  encryptedKey?: { encrypted: string; iv: string };
}

export interface Session {
  id: string;
  seconds: number;
  endedAt: number;
  subject: string;
  subjectId?: string;
  manual?: boolean;
}

export type TimerMode = "focus" | "short" | "long";

export interface TimerState {
  id: string;
  mode: TimerMode;
  duration: number;
  remaining: number;
  endAt: number | null;
  runStartedAt: number | null;
  studiedSeconds: number;
  subject: string;
  subjectId?: string;
}

export interface StudyRoom {
  id: string;
  name: string;
  description: string;
  exam: Exam;
  image: string;
  minutes: number;
  tag: string;
  color: string;
  private?: boolean;
}

export interface PeerProfile {
  name: string;
  exam: string;
  goal: string;
  roomId: string | null;
}

export interface Message {
  id: string;
  name: string;
  text: string;
  sentAt: number;
  peerId: string;
}

export interface Topic {
  id: string;
  title: string;
  done: boolean;
  notes: string;
}
export interface Subject {
  id: string;
  name: string;
  weeklyMinutes: number;
  topics: Topic[];
}
export interface ExamPlan {
  examName: string;
  targets: { daily: number; weekly: number; monthly: number; yearly: number };
  subjects: Subject[];
  source?: {
    url: string;
    title: string;
    fetchedAt: string;
    text: string;
    attachment?: Attachment;
  };
}
export interface Habit {
  id: string;
  title: string;
  area: string;
  cue: string;
  minimum: string;
  ambition: string;
  completedDates: string[];
}
export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  minutes: number;
  subjectId: string;
  done: boolean;
}
export interface Journal {
  identity: string;
  entries: Record<
    string,
    {
      win: string;
      blocker: string;
      next: string;
      goal?: string;
      goals?: { id: string; title: string; done: boolean }[];
      attachments?: Attachment[];
    }
  >;
}
