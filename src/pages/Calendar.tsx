import { t } from "../i18n";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import type { CalendarEvent, Session, Subject, Task } from "../types";
import { durationLabel, indiaDate, studySecondsByDate } from "../lib/study";
import { calendarFile, googleCalendarUrl } from "../lib/calendar";
import { downloadFile } from "../lib/storage";
import { Modal } from "../components/Modal";
export function Calendar({
  events,
  setEvents,
  sessions,
  subjects,
  tasks,
  onStart,
}: {
  events: CalendarEvent[];
  setEvents: Dispatch<SetStateAction<CalendarEvent[]>>;
  sessions: Session[];
  subjects: Subject[];
  tasks: Task[];
  onStart: (event: CalendarEvent) => void;
}) {
  const today = indiaDate();
  const dailySeconds = useMemo(() => studySecondsByDate(sessions), [sessions]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("09:00");
  const [minutes, setMinutes] = useState(50);
  const [subjectId, setSubjectId] = useState("");
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const value = new Date(first);
    value.setUTCDate(1 + index - offset);
    return value.toISOString().slice(0, 10);
  });
  const dayEvents = events
    .filter((event) => event.date === selected)
    .sort((a, b) => a.time.localeCompare(b.time));
  const daySessions = sessions.filter(
    (session) => indiaDate(session.endedAt) === selected,
  );
  const dayTasks = tasks.filter((task) => task.date === selected);
  function moveMonth(amount: number) {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth() + amount);
    setMonth(next.toISOString().slice(0, 7));
  }
  function open(event?: CalendarEvent) {
    setEditing(event || null);
    setTitle(event?.title || "");
    setDate(event?.date || selected);
    setTime(event?.time || "09:00");
    setMinutes(event?.minutes || 50);
    setSubjectId(event?.subjectId || "");
    setForm(true);
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">{t("GIVE YOUR DREAMS A LITTLE TIME")}</div>
          <h1>{t("Make a date with progress.")}</h1>
          <p>
            {t(
              "Your planned sessions, actual study, and deadlines in one calendar. All times in IST.",
            )}
          </p>
        </div>
        <div className="inline-actions">
          <button
            className="secondary"
            disabled={!events.length}
            onClick={() =>
              downloadFile(
                "padhai-study-calendar.ics",
                calendarFile(events),
                "text/calendar;charset=utf-8",
              )
            }
          >
            {t("Export calendar (.ics)")}
          </button>
          <button className="primary" onClick={() => open()}>
            <Plus size={16} />
            {t(" Plan a session")}
          </button>
        </div>
      </div>
      <p className="calendar-reminder-note">
        {t(
          "For reminders when Padhai is closed, add a session to Google Calendar or export the .ics file to your calendar app. The file includes a 10-minute reminder; review notification settings in your calendar. Changes here do not automatically update exported events.",
        )}
      </p>
      <div className="calendar-layout">
        <section className="panel calendar-panel">
          <div className="calendar-toolbar">
            <h2>
              {t(
                first.toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }),
              )}
            </h2>
            <div>
              <button
                className="text-button"
                onClick={() => {
                  setMonth(today.slice(0, 7));
                  setSelected(today);
                }}
              >
                {t("Today")}
              </button>
              <button
                className="icon-button"
                aria-label={t("Previous month")}
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className="icon-button"
                aria-label={t("Next month")}
                onClick={() => moveMonth(1)}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
          <div className="calendar-weekdays">
            {t(
              ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <span key={day}>{t(day)}</span>
              )),
            )}
          </div>
          <div
            className="calendar-grid"
            role="grid"
            aria-label={t("Monthly study calendar")}
          >
            {t(
              cells.map((cell) => {
                const planned = events.filter((event) => event.date === cell);
                const studied = dailySeconds[cell] || 0;
                const due = tasks.filter(
                  (task) => task.date === cell && !task.done,
                ).length;
                return (
                  <button
                    key={cell}
                    role="gridcell"
                    aria-selected={selected === cell}
                    aria-label={`${cell}, ${planned.length} planned sessions, ${Math.floor(studied / 60)} minutes studied, ${due} tasks due`}
                    className={`calendar-cell ${cell.slice(0, 7) !== month ? "outside-month" : ""} ${cell === today ? "is-today" : ""} ${cell === selected ? "selected" : ""}`}
                    onClick={() => setSelected(cell)}
                  >
                    <span>{t(Number(cell.slice(8)))}</span>
                    <div className="calendar-indicators">
                      {t(planned.length > 0 && <i className="planned-dot" />)}
                      {t(studied > 0 && <i className="studied-dot" />)}
                      {t(due > 0 && <i className="due-dot" />)}
                    </div>
                    {t(
                      studied > 0 && <small>{t(durationLabel(studied))}</small>,
                    )}
                    {t(
                      planned.length > 0 && (
                        <em>
                          {t(planned.length)}
                          {t(" planned")}
                        </em>
                      ),
                    )}
                  </button>
                );
              }),
            )}
          </div>
          <div className="calendar-legend">
            <span>
              <i className="planned-dot" />
              {t(" Planned")}
            </span>
            <span>
              <i className="studied-dot" />
              {t(" Studied")}
            </span>
            <span>
              <i className="due-dot" />
              {t(" Tasks due")}
            </span>
          </div>
        </section>
        <aside className="panel day-agenda">
          <div className="section-heading">
            <div>
              <h2>
                {t(
                  new Date(`${selected}T12:00:00Z`).toLocaleDateString(
                    "en-IN",
                    {
                      day: "numeric",
                      month: "long",
                      weekday: "long",
                      timeZone: "UTC",
                    },
                  ),
                )}
              </h2>
              <p>
                {t(
                  durationLabel(
                    daySessions.reduce(
                      (sum, session) => sum + session.seconds,
                      0,
                    ),
                  ),
                )}
                {t(" of actual focus")}
              </p>
            </div>
            <CalendarDays size={21} />
          </div>
          {t(
            !dayEvents.length && !daySessions.length && !dayTasks.length && (
              <div className="empty-state small">
                <CalendarDays size={30} />
                <h3>{t("A little room to begin.")}</h3>
                <p>{t("Plan a study session for this day.")}</p>
              </div>
            ),
          )}
          {t(
            dayEvents.map((event) => (
              <article
                key={event.id}
                className={`agenda-event ${event.done ? "done" : ""}`}
              >
                <span className="agenda-time">
                  <Clock3 size={12} />
                  {t(event.time)}
                  {t(" IST \u00B7 ")}
                  {t(event.minutes)}
                  {t(" min")}
                </span>
                <h3 translate="no">{event.title}</h3>
                <p>
                  {t(
                    subjects.find((subject) => subject.id === event.subjectId)
                      ?.name || "General study",
                  )}
                </p>
                <a
                  className="text-button calendar-link"
                  href={googleCalendarUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("Add to Google Calendar")}
                </a>
                <div>
                  <button
                    className="text-button"
                    onClick={() => onStart(event)}
                  >
                    <Play size={12} />
                    {t(" Start timer")}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Mark ${event.title} ${event.done ? "not done" : "done"}`}
                    onClick={() =>
                      setEvents((current) =>
                        current.map((item) =>
                          item.id === event.id
                            ? { ...item, done: !item.done }
                            : item,
                        ),
                      )
                    }
                  >
                    <Check size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Edit session ${event.title}`}
                    onClick={() => open(event)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="icon-button delete-button"
                    aria-label={`Delete session ${event.title}`}
                    onClick={() =>
                      setEvents((current) =>
                        current.filter((item) => item.id !== event.id),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            )),
          )}
          {t(
            dayTasks.length > 0 && (
              <div className="agenda-tasks">
                <h3>{t("Tasks for the day")}</h3>
                {t(
                  dayTasks.map((task) => (
                    <p key={task.id}>
                      {t(task.done ? "✓" : "○")}{" "}
                      <span translate="no">{task.title}</span>
                    </p>
                  )),
                )}
              </div>
            ),
          )}
          {t(
            daySessions.length > 0 && (
              <div className="agenda-tasks">
                <h3>{t("Time you showed up")}</h3>
                {t(
                  daySessions.map((session) => (
                    <p key={session.id}>
                      <Check size={12} />
                      <span translate="no">
                        {session.subject || "Focused study"}
                      </span>
                      <strong>{t(durationLabel(session.seconds))}</strong>
                    </p>
                  )),
                )}
              </div>
            ),
          )}
          <button className="secondary full-width" onClick={() => open()}>
            <Plus size={15} />
            {t(" Plan for this day")}
          </button>
        </aside>
      </div>
      {t(
        form && (
          <Modal
            title={
              editing
                ? "Make a little change of plan."
                : "A time and a place to begin."
            }
            onClose={() => setForm(false)}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const item: CalendarEvent = {
                  id: editing?.id || crypto.randomUUID(),
                  title: title.trim(),
                  date,
                  time,
                  minutes,
                  subjectId,
                  done: editing?.done || false,
                };
                setEvents((current) =>
                  editing
                    ? current.map((value) =>
                        value.id === item.id ? item : value,
                      )
                    : [...current, item],
                );
                setSelected(date);
                setMonth(date.slice(0, 7));
                setForm(false);
              }}
            >
              <label className="field">
                {t("Session title")}
                <input
                  autoFocus
                  maxLength={120}
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("Morning physics practice")}
                />
              </label>
              <label className="field">
                {t("Subject")}
                <select
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                >
                  <option value="">{t("General study")}</option>
                  {t(
                    subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {t(subject.name)}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <div className="form-columns">
                <label className="field">
                  {t("Date")}
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
                <label className="field">
                  {t("Time (IST)")}
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                {t("Session duration (minutes)")}
                <input
                  required
                  type="number"
                  min={1}
                  max={180}
                  value={minutes}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                />
              </label>
              <button className="primary full-width" disabled={!title.trim()}>
                <Check size={16} />
                {t(" Save session")}
              </button>
            </form>
          </Modal>
        ),
      )}
    </>
  );
}
