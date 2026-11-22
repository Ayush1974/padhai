import type { ExamPlan, Subject } from "../types";
import { indiaDate } from "./study";

export const examPresets: Record<string, string[]> = {
  "JEE Main / Advanced": ["Physics", "Chemistry", "Mathematics"],
  "NEET UG": ["Physics", "Chemistry", "Botany", "Zoology"],
  "UPSC CSE": [
    "History & Culture",
    "Geography",
    "Indian Polity",
    "Economy",
    "Environment",
    "Science & Technology",
    "Current Affairs",
    "CSAT",
    "Ethics",
    "Essay",
    "Optional Subject",
  ],
  "SSC CGL / CHSL": [
    "Quantitative Aptitude",
    "General Intelligence & Reasoning",
    "English",
    "General Awareness",
  ],
  "Banking / IBPS / SBI": [
    "Quantitative Aptitude",
    "Reasoning",
    "English",
    "General & Banking Awareness",
    "Computer Knowledge",
  ],
  CAT: [
    "Quantitative Aptitude",
    "Verbal Ability & Reading Comprehension",
    "Data Interpretation & Logical Reasoning",
  ],
  GATE: ["General Aptitude", "Engineering Mathematics", "Core Subject"],
  "GATE CS": [
    "General Aptitude",
    "Engineering Mathematics",
    "Digital Logic",
    "Computer Organization and Architecture",
    "Programming and Data Structures",
    "Algorithms",
    "Theory of Computation",
    "Compiler Design",
    "Operating System",
    "Databases",
    "Computer Networks",
  ],
  CUET: ["Language", "Domain Subjects", "General Test"],
  "State PSC": [
    "General Studies",
    "State General Knowledge",
    "Aptitude",
    "Language",
  ],
  "UGC NET": ["Paper I — Teaching & Research Aptitude", "Paper II — Subject"],
  "School / College": ["My first subject"],
  "Custom exam": [],
};

export function makeSubject(name: string): Subject {
  return { id: crypto.randomUUID(), name, weeklyMinutes: 300, topics: [] };
}
export function makePlan(examName = "GATE CS"): ExamPlan {
  return {
    examName,
    targets: { daily: 240, weekly: 1440, monthly: 6000, yearly: 72000 },
    subjects: (examPresets[examName] || []).map(makeSubject),
  };
}

export function periodStart(
  period: "daily" | "weekly" | "monthly" | "yearly",
  now = Date.now(),
): number {
  const date = indiaDate(now);
  if (period === "yearly")
    return Date.parse(`${date.slice(0, 4)}-01-01T00:00:00+05:30`);
  if (period === "monthly")
    return Date.parse(`${date.slice(0, 7)}-01T00:00:00+05:30`);
  const midnight = Date.parse(`${date}T00:00:00+05:30`);
  if (period === "daily") return midnight;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return midnight - ((weekday + 6) % 7) * 86_400_000;
}
