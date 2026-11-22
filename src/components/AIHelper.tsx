import { useState } from "react";
import {
  CalendarPlus,
  Check,
  CheckCheck,
  FilePlus2,
  Send,
  Sparkles,
} from "lucide-react";
import type {
  CalendarEvent,
  ExamPlan,
  Note,
  Page,
  Session,
  Task,
} from "../types";
import { askAI } from "../lib/ai";
import { indiaDate, isDate } from "../lib/study";
import { Modal } from "./Modal";
import { t } from "../i18n";

interface Answer {
  answer: string;
  tasks?: { title: string; subject?: string; date?: string }[];
  schedule?: {
    title: string;
    subject?: string;
    date?: string;
    time?: string;
    minutes?: number;
  }[];
}

export function AIHelper({
  page,
  plan,
  sessions,
  language,
  initialPrompt = "",
  onClose,
  addTasks,
  addEvents,
  saveNote,
}: {
  page: Page;
  plan: ExamPlan;
  sessions: Session[];
  language: string;
  initialPrompt?: string;
  onClose: () => void;
  addTasks: (tasks: Task[]) => void;
  addEvents: (events: CalendarEvent[]) => void;
  saveNote: (note: Note) => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt.slice(0, 18000));
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const suggestions: Record<string, string> = {
    rooms: "Help me plan one focused study session.",
    exam: "Help me prioritize my subjects and choose a realistic weekly study plan.",
    calendar: "Suggest a realistic study schedule for tomorrow with breaks.",
    planner:
      "Break a difficult chapter into small, actionable tasks for today.",
    progress: "Review my study time and suggest one practical improvement.",
    notes: "Help me understand or summarize the study text I paste below.",
    habits:
      "Help me turn a goal into a small daily action and a useful journal prompt.",
    wisdom: "Help me apply a lesson about steady effort to my study day.",
    resources:
      "How should I evaluate whether a free study resource is trustworthy?",
    settings: "Help me set a realistic daily focus target.",
  };
  async function generate() {
    setBusy(true);
    setError("");
    setAnswer(null);
    setApplied([]);
    try {
      const studyTotals: Record<string, number> = {};
      for (const session of sessions.filter(
        (item) => item.endedAt > Date.now() - 7 * 86400000,
      ))
        studyTotals[session.subject || "General study"] =
          (studyTotals[session.subject || "General study"] || 0) +
          session.seconds;
      const result = await askAI<Answer>({
        kind: "assistant",
        module: page,
        language,
        prompt: prompt.trim() || suggestions[page],
        context: {
          exam: plan.examName,
          subjects: plan.subjects.map((subject) => subject.name),
          targets: plan.targets,
          lastSevenDaysSecondsBySubject: studyTotals,
        },
      });
      if (typeof result.answer !== "string")
        throw new Error("The AI reply was incomplete. Please try again.");
      setAnswer({
        answer: result.answer,
        tasks: Array.isArray(result.tasks)
          ? result.tasks
              .filter(
                (item) =>
                  item && typeof item.title === "string" && item.title.trim(),
              )
              .slice(0, 10)
          : [],
        schedule: Array.isArray(result.schedule)
          ? result.schedule
              .filter((item) => item && typeof item.title === "string")
              .slice(0, 7)
          : [],
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "AI is unavailable. Please try again later.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={t("Your AI study companion")} onClose={onClose} wide>
      <div className="ai-helper">
        <div className="ai-module-label">
          <Sparkles size={18} />
          <span>
            {t(
              page === "exam"
                ? "Exam planning"
                : page.charAt(0).toUpperCase() + page.slice(1),
            )}{" "}
            · {plan.examName}
          </span>
        </div>
        <p className="muted">
          {t(
            "Ask for a clear explanation, a practical plan, or a small next step. Review every suggestion before adding it to your workspace.",
          )}
        </p>
        <label className="field">
          {t("How can I help?")}
          <textarea
            rows={4}
            maxLength={18000}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={t(suggestions[page])}
          />
        </label>
        <p className="language-notice">
          {t(
            "This sends your request, exam subjects, time targets, and the last 7 days of study totals to Gemini. Your other notes, files, and journal entries are not included. Paste only content you want AI to read.",
          )}
        </p>
        <button
          className="primary"
          onClick={() => void generate()}
          disabled={busy}
        >
          <Send size={16} />
          {t(busy ? "Thinking through your request…" : "Ask my AI companion")}
        </button>
        {error && (
          <p className="inline-error" role="alert">
            {t(error)}
          </p>
        )}
        {answer && (
          <section className="ai-answer">
            <span className="tag">
              {t("AI-generated · check important details")}
            </span>
            <p className="ai-answer-text">{answer.answer}</p>
            {!!answer.tasks?.length && (
              <div className="ai-suggestions">
                <h3>{t("Suggested tasks")}</h3>
                {answer.tasks.map((task, index) => (
                  <p key={index}>
                    <CheckCheck size={14} />
                    {task.title}
                  </p>
                ))}
                <button
                  className="secondary"
                  disabled={applied.includes("tasks")}
                  onClick={() => {
                    addTasks(
                      answer.tasks!.map((task) => ({
                        id: crypto.randomUUID(),
                        title: task.title.slice(0, 200),
                        subject:
                          typeof task.subject === "string"
                            ? task.subject.slice(0, 60)
                            : "",
                        date:
                          isDate(task.date) && task.date !== ""
                            ? task.date
                            : indiaDate(),
                        done: false,
                        priority: "normal",
                      })),
                    );
                    setApplied((current) => [...current, "tasks"]);
                  }}
                >
                  <Check size={16} />
                  {t(
                    applied.includes("tasks")
                      ? "Added to my planner"
                      : "Add these tasks to my planner",
                  )}
                </button>
              </div>
            )}
            {!!answer.schedule?.length && (
              <div className="ai-suggestions">
                <h3>{t("Suggested study sessions")}</h3>
                {answer.schedule.map((event, index) => (
                  <p key={index}>
                    <CalendarPlus size={14} />
                    {event.title} · {event.date} · {event.time} IST
                  </p>
                ))}
                <button
                  className="secondary"
                  disabled={applied.includes("schedule")}
                  onClick={() => {
                    addEvents(
                      answer.schedule!.map((event) => ({
                        id: crypto.randomUUID(),
                        title: event.title.slice(0, 120),
                        date:
                          isDate(event.date) && event.date !== ""
                            ? event.date
                            : indiaDate(),
                        time:
                          typeof event.time === "string" &&
                          /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.time)
                            ? event.time
                            : "09:00",
                        minutes: Number.isFinite(event.minutes)
                          ? Math.max(
                              5,
                              Math.min(180, Math.round(event.minutes!)),
                            )
                          : 25,
                        subjectId:
                          plan.subjects.find(
                            (subject) => subject.name === event.subject,
                          )?.id || "",
                        done: false,
                      })),
                    );
                    setApplied((current) => [...current, "schedule"]);
                  }}
                >
                  <CalendarPlus size={16} />
                  {t(
                    applied.includes("schedule")
                      ? "Added to my calendar"
                      : "Add these sessions to my calendar",
                  )}
                </button>
              </div>
            )}
            <button
              className="text-button"
              disabled={applied.includes("note")}
              onClick={() => {
                saveNote({
                  id: crypto.randomUUID(),
                  title: `${plan.examName} · AI study guidance`.slice(0, 100),
                  body: answer.answer,
                  updatedAt: Date.now(),
                  notebookId: "inbox",
                });
                setApplied((current) => [...current, "note"]);
              }}
            >
              <FilePlus2 size={16} />
              {t(
                applied.includes("note")
                  ? "Saved to notes"
                  : "Save this answer to my notes",
              )}
            </button>
          </section>
        )}
      </div>
    </Modal>
  );
}
