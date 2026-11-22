import { t } from "../i18n";
import { languages } from "../i18n";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bell,
  BookMarked,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Download,
  FileText,
  Flame,
  Globe2,
  GraduationCap,
  Leaf,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trash2,
  Upload,
  Wifi,
} from "lucide-react";
import { resources } from "../data";
import {
  durationLabel,
  indiaDate,
  studyStreak,
  validateBackup,
  type Backup,
} from "../lib/study";
import { downloadFile } from "../lib/storage";
import type { Note, Profile, Session, Task } from "../types";
import { calendarFile, googleCalendarUrl, taskAsEvent } from "../lib/calendar";
import { Modal } from "../components/Modal";
export function Planner({
  tasks,
  setTasks,
  focusTask,
}: {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  focusTask: (task: Task) => void;
}) {
  const [filter, setFilter] = useState("today");
  const [editing, setEditing] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const today = indiaDate();
  const filtered = tasks
    .filter((task) =>
      filter === "today"
        ? task.date === today
        : filter === "upcoming"
          ? task.date > today && !task.done
          : true,
    )
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        a.date.localeCompare(b.date) ||
        Number(b.priority === "high") - Number(a.priority === "high"),
    );
  const complete = filtered.filter((task) => task.done).length;
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(today);
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  function open(task?: Task) {
    setEditing(task || null);
    setTitle(task?.title || "");
    setSubject(task?.subject || "");
    setDate(task?.date || today);
    setPriority(task?.priority || "normal");
    setShowForm(true);
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">{t("A LITTLE PLAN GOES A LONG WAY")}</div>
          <h1>{t("Make room for progress.")}</h1>
          <p>{t("Put it on paper. Take it one task at a time.")}</p>
        </div>
        <button className="primary" onClick={() => open()}>
          <Plus size={17} />
          {t(" Add a task")}
        </button>
      </div>
      <div className="planner-banner">
        <span className="planner-illustration">
          <CheckCheck size={46} strokeWidth={1.3} />
          <Sparkles size={20} />
        </span>
        <div>
          <span className="eyebrow">{t("YOUR PLAN, YOUR PACE")}</span>
          <h2>
            {t(
              filtered.length
                ? `${complete} of ${filtered.length} little wins, done.`
                : "A fresh start looks good on you.",
            )}
          </h2>
          <p>{t("A realistic plan is better than a perfect one.")}</p>
        </div>
        <div className="planner-progress">
          <span>
            {t(
              filtered.length
                ? Math.round((complete / filtered.length) * 100)
                : 0,
            )}
            {t("%")}
          </span>
          <div>
            <i
              style={{
                width: `${filtered.length ? (complete / filtered.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>
      <p className="calendar-reminder-note">
        {t(
          "Add a task to Google Calendar for a reminder, or export tasks to your calendar app. Tasks export as a 25-minute session at 9 AM IST; adjust the time and notification before saving.",
        )}
      </p>
      <button
        className="secondary planner-export"
        disabled={!tasks.length}
        onClick={() =>
          downloadFile(
            "padhai-tasks.ics",
            calendarFile(tasks.map(taskAsEvent)),
            "text/calendar;charset=utf-8",
          )
        }
      >
        {t("Export tasks to calendar")}
      </button>
      <div className="tools-toolbar">
        <div className="segmented">
          {t(
            [
              ["today", "Today"],
              ["upcoming", "Upcoming"],
              ["all", "All tasks"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={filter === id ? "active" : ""}
                onClick={() => setFilter(id)}
              >
                {t(label)}
              </button>
            )),
          )}
        </div>
        <span className="muted tiny">
          {t(filtered.length)}
          {t(" TASKS \u00B7 NO PRESSURE")}
        </span>
      </div>
      <section className="panel task-list">
        {t(
          filtered.length ? (
            filtered.map((task) => (
              <article
                className={`task-row ${task.done ? "completed" : ""}`}
                key={task.id}
              >
                <button
                  className="task-check"
                  aria-label={`${task.done ? "Mark incomplete" : "Complete"}: ${task.title}`}
                  aria-pressed={task.done}
                  onClick={() =>
                    setTasks((current) =>
                      current.map((item) =>
                        item.id === task.id
                          ? { ...item, done: !item.done }
                          : item,
                      ),
                    )
                  }
                >
                  {t(task.done && <Check size={15} />)}
                </button>
                <div className="task-row-text">
                  <h3>{t(task.title)}</h3>
                  <div>
                    {t(
                      task.subject && (
                        <span className="tag">{t(task.subject)}</span>
                      ),
                    )}
                    <span>
                      <CalendarDays size={12} />
                      {t(task.date === today ? "Today" : task.date)}
                    </span>
                    {t(
                      task.priority === "high" && (
                        <span className="priority-label">
                          {t("High priority")}
                        </span>
                      ),
                    )}
                  </div>
                </div>
                {t(
                  !task.done && (
                    <button
                      className="task-focus text-button"
                      onClick={() => focusTask(task)}
                    >
                      <Timer size={15} />
                      {t(" Focus")}
                    </button>
                  ),
                )}
                <a
                  className="icon-button calendar-link"
                  aria-label={`Add ${task.title} to Google Calendar`}
                  title={t("Add to Google Calendar")}
                  href={googleCalendarUrl(taskAsEvent(task))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CalendarDays size={16} />
                </a>
                <button
                  className="icon-button"
                  onClick={() => open(task)}
                  aria-label={`Edit ${task.title}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button delete-button"
                  onClick={() =>
                    setTasks((current) =>
                      current.filter((item) => item.id !== task.id),
                    )
                  }
                  aria-label={`Delete ${task.title}`}
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <span className="empty-illustration">
                <NotebookPen size={40} strokeWidth={1.3} />
              </span>
              <h2>
                {t(
                  filter === "upcoming"
                    ? "Your future is an open page."
                    : "What’s your first little win?",
                )}
              </h2>
              <p>
                {t("Add a chapter, a practice set, or a revision goal.")}
                <br />
                {t("Small and specific is a lovely place to start.")}
              </p>
              <button className="secondary" onClick={() => open()}>
                <Plus size={16} />
                {t(" Add a task")}
              </button>
            </div>
          ),
        )}
      </section>
      {t(
        showForm && (
          <Modal
            title={
              editing ? "A little change of plan" : "One step towards your goal"
            }
            onClose={() => setShowForm(false)}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const task: Task = {
                  id: editing?.id || crypto.randomUUID(),
                  title: title.trim(),
                  subject: subject.trim(),
                  date,
                  priority,
                  done: editing?.done || false,
                };
                setTasks((current) =>
                  editing
                    ? current.map((item) =>
                        item.id === editing.id ? task : item,
                      )
                    : [...current, task],
                );
                setShowForm(false);
              }}
            >
              <label className="field">
                {t("What would you like to do?")}
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("Revise chemical bonding")}
                />
              </label>
              <label className="field">
                {t("Subject")}
                <input
                  maxLength={60}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={t("Chemistry")}
                />
              </label>
              <div className="form-columns">
                <label className="field">
                  {t("Study date")}
                  <input
                    required
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
                <label className="field">
                  {t("Priority")}
                  <select
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as Task["priority"])
                    }
                  >
                    <option value="normal">{t("Take your time")}</option>
                    <option value="high">{t("Make it a priority")}</option>
                  </select>
                </label>
              </div>
              <button
                className="primary full-width"
                type="submit"
                disabled={!title.trim()}
              >
                {t(editing ? "Save changes" : "Add to my plan")}
                <Check size={16} />
              </button>
            </form>
          </Modal>
        ),
      )}
    </>
  );
}
