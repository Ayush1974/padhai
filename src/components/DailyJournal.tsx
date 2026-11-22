import { useState, type Dispatch, type SetStateAction } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { Journal, Session } from "../types";
import { durationLabel, indiaDate } from "../lib/study";
import { FileAttachments } from "./FileAttachments";
import { t } from "../i18n";

export function DailyJournal({
  journal,
  setJournal,
  sessions,
  dailyTarget,
  notify,
}: {
  journal: Journal;
  setJournal: Dispatch<SetStateAction<Journal>>;
  sessions: Session[];
  dailyTarget: number;
  notify: (message: string) => void;
}) {
  const today = indiaDate();
  const [date, setDate] = useState(today);
  const [newGoal, setNewGoal] = useState("");
  const entry = journal.entries[date] || { win: "", blocker: "", next: "" };
  const goals = entry.goals || [];
  const seconds = sessions
    .filter((session) => indiaDate(session.endedAt) === date)
    .reduce((sum, session) => sum + session.seconds, 0);
  function update(change: (current: typeof entry) => typeof entry) {
    setJournal((current) => ({
      ...current,
      entries: {
        ...current.entries,
        [date]: change(
          current.entries[date] || { win: "", blocker: "", next: "" },
        ),
      },
    }));
  }
  function move(amount: number) {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + amount);
    setDate(next.toISOString().slice(0, 10));
  }
  return (
    <section className="panel daily-journal">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{t("MY DAY, ONE PAGE AT A TIME")}</div>
          <h2>{t("My daily journal")}</h2>
          <p>
            {t(
              "Set an intention, keep your wins, and see what changed. Saved as you write.",
            )}
          </p>
        </div>
      </div>
      <div className="journal-date-nav">
        <button
          className="icon-button bordered"
          aria-label={t("Previous journal day")}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={19} />
        </button>
        <label>
          <span className="sr-only">{t("Journal date")}</span>
          <input
            type="date"
            required
            aria-label={t("Journal date")}
            value={date}
            onChange={(event) => {
              if (event.target.value) setDate(event.target.value);
            }}
          />
        </label>
        <button
          className="icon-button bordered"
          aria-label={t("Next journal day")}
          onClick={() => move(1)}
        >
          <ChevronRight size={19} />
        </button>
        <button className="text-button" onClick={() => setDate(today)}>
          {t("Today")}
        </button>
      </div>
      <div className="journal-progress">
        <div>
          <strong>{durationLabel(seconds)}</strong>
          <span>
            {t("actual focus")} / {durationLabel(dailyTarget * 60)}{" "}
            {t("daily target")}
          </span>
        </div>
        <div>
          <strong>
            {goals.filter((goal) => goal.done).length}/{goals.length}
          </strong>
          <span>{t("daily goals completed")}</span>
        </div>
      </div>
      <label className="field">
        {t("My intention for this day")}
        <textarea
          rows={2}
          maxLength={3000}
          value={entry.goal || ""}
          onChange={(event) =>
            update((current) => ({ ...current, goal: event.target.value }))
          }
          placeholder={t("What would make today meaningful?")}
        />
      </label>
      <form
        className="journal-goal-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!newGoal.trim()) return;
          update((current) => ({
            ...current,
            goals: [
              ...(current.goals || []),
              { id: crypto.randomUUID(), title: newGoal.trim(), done: false },
            ],
          }));
          setNewGoal("");
        }}
      >
        <input
          maxLength={200}
          aria-label={t("New daily goal")}
          placeholder={t("One clear goal for this day…")}
          value={newGoal}
          onChange={(event) => setNewGoal(event.target.value)}
        />
        <button
          className="secondary"
          disabled={!newGoal.trim() || goals.length >= 100}
        >
          <Plus size={16} />
          {t("Add goal")}
        </button>
      </form>
      <div className="journal-goals">
        {goals.map((goal) => (
          <div key={goal.id}>
            <button
              className="task-check"
              aria-pressed={goal.done}
              aria-label={`${goal.done ? "Undo" : "Complete"} goal ${goal.title}`}
              onClick={() =>
                update((current) => ({
                  ...current,
                  goals: current.goals?.map((item) =>
                    item.id === goal.id ? { ...item, done: !item.done } : item,
                  ),
                }))
              }
            >
              {goal.done && <Check size={14} />}
            </button>
            <input
              aria-label={t("Edit daily goal")}
              maxLength={200}
              value={goal.title}
              className={goal.done ? "completed-goal" : ""}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  goals: current.goals?.map((item) =>
                    item.id === goal.id
                      ? { ...item, title: event.target.value }
                      : item,
                  ),
                }))
              }
            />
            <button
              className="icon-button delete-button"
              aria-label={`Delete goal ${goal.title}`}
              onClick={() =>
                update((current) => ({
                  ...current,
                  goals: current.goals?.filter((item) => item.id !== goal.id),
                }))
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="review-grid">
        {(
          [
            ["win", "One thing I showed up for"],
            ["blocker", "What got in the way?"],
            ["next", "One change for tomorrow"],
          ] as const
        ).map(([key, label]) => (
          <label className="field" key={key}>
            {t(label)}
            <textarea
              rows={3}
              maxLength={3000}
              value={entry[key]}
              onChange={(event) =>
                update((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          </label>
        ))}
      </div>
      <FileAttachments
        key={date}
        files={entry.attachments || []}
        onChange={(change) =>
          update((current) => ({
            ...current,
            attachments:
              typeof change === "function"
                ? change(current.attachments || [])
                : change,
          }))
        }
        notify={notify}
      />
      <label className="field journal-history-select">
        {t("Revisit a saved day")}
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) setDate(event.target.value);
          }}
        >
          <option value="">{t("Choose a journal entry")}</option>
          {Object.keys(journal.entries)
            .sort()
            .reverse()
            .map((day) => (
              <option key={day}>{day}</option>
            ))}
        </select>
      </label>
    </section>
  );
}
