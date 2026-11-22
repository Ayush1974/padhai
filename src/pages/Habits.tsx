import { t } from "../i18n";
import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowRight,
  Check,
  Flame,
  Heart,
  Leaf,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import type { Habit, Journal, Session } from "../types";
import { indiaDate } from "../lib/study";
import { DailyJournal } from "../components/DailyJournal";
import { Modal } from "../components/Modal";
const areas = [
  "Study",
  "Health",
  "Mind",
  "Skills & Career",
  "Relationships",
  "Money habits",
  "Rest",
  "Other",
];
export function Habits({
  habits,
  setHabits,
  journal,
  setJournal,
  sessions,
  dailyTarget,
  onStart,
  notify,
}: {
  habits: Habit[];
  setHabits: Dispatch<SetStateAction<Habit[]>>;
  journal: Journal;
  setJournal: Dispatch<SetStateAction<Journal>>;
  sessions: Session[];
  dailyTarget: number;
  onStart: () => void;
  notify: (message: string) => void;
}) {
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("Study");
  const [cue, setCue] = useState("");
  const [minimum, setMinimum] = useState("");
  const [ambition, setAmbition] = useState("");
  const today = indiaDate();
  const done = habits.filter((habit) =>
    habit.completedDates.includes(today),
  ).length;
  function open(habit?: Habit) {
    setEditing(habit || null);
    setTitle(habit?.title || "");
    setArea(habit?.area || "Study");
    setCue(habit?.cue || "");
    setMinimum(habit?.minimum || "");
    setAmbition(habit?.ambition || "");
    setForm(true);
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            {t("BUILD A LIFE YOU WANT TO SHOW UP FOR")}
          </div>
          <h1>{t("Small promises. A stronger you.")}</h1>
          <p>
            {t(
              "Start smaller than your resistance. Repeat what matters. Grow at your own pace.",
            )}
          </p>
        </div>
        <button className="primary" onClick={() => open()}>
          <Plus size={16} />
          {t(" New habit")}
        </button>
      </div>
      <div className="habit-start-banner">
        <span>{t("\u273D")}</span>
        <div>
          <h2>{t("You don\u2019t need a perfect day to begin.")}</h2>
          <p>
            {t(
              "Put the phone away. Open one page. Give yourself just two minutes.",
            )}
          </p>
        </div>
        <button className="primary" onClick={onStart}>
          <Play size={15} />
          {t(" A 2-minute start")}
        </button>
      </div>
      <section className="panel identity-panel">
        <Sparkles size={21} />
        <label>
          <span className="eyebrow">
            {t("THE PERSON YOU\u2019RE BECOMING")}
          </span>
          <input
            aria-label={t("Your personal identity statement")}
            maxLength={200}
            value={journal.identity}
            onChange={(event) =>
              setJournal({ ...journal, identity: event.target.value })
            }
            placeholder={t(
              "I\u2019m becoming someone who keeps small promises to myself.",
            )}
          />
        </label>
        <span className="tiny muted">{t("SAVED AS YOU WRITE")}</span>
      </section>
      <div className="section-heading">
        <div>
          <h2>{t("Your daily foundations")}</h2>
          <p>
            {t("A minimum action is a success. Anything extra is a bonus.")}
          </p>
        </div>
        <span className="tag">
          {t(done)}
          {t("/")}
          {t(habits.length)}
          {t(" today")}
        </span>
      </div>
      <div className="habit-grid">
        {t(
          habits.map((habit) => {
            const completed = habit.completedDates.includes(today);
            const week = Array.from({ length: 7 }, (_, index) =>
              indiaDate(Date.now() - (6 - index) * 86400000),
            );
            return (
              <article
                className={`panel habit-card ${completed ? "complete" : ""}`}
                key={habit.id}
              >
                <div className="habit-card-top">
                  <span className="tag">{t(habit.area)}</span>
                  <button
                    className="icon-button"
                    aria-label={`Edit habit ${habit.title}`}
                    onClick={() => open(habit)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="icon-button delete-button"
                    aria-label={`Delete habit ${habit.title}`}
                    onClick={() =>
                      setHabits((current) =>
                        current.filter((item) => item.id !== habit.id),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <h2 translate="no">{habit.title}</h2>
                {t(
                  habit.cue && (
                    <p className="habit-cue" translate="no">
                      After {habit.cue}…
                    </p>
                  ),
                )}
                <div className="habit-minimum">
                  <Leaf size={16} />
                  <div>
                    <span>{t("THE SMALLEST WIN")}</span>
                    <strong translate="no">{habit.minimum}</strong>
                  </div>
                </div>
                {t(
                  habit.ambition && (
                    <p className="habit-ambition">
                      <Target size={13} />
                      <span translate="no">
                        Bigger direction: {habit.ambition}
                      </span>
                    </p>
                  ),
                )}
                <div className="habit-week">
                  {t(
                    week.map((day) => (
                      <span
                        key={day}
                        className={
                          habit.completedDates.includes(day) ? "done" : ""
                        }
                        title={day}
                      >
                        {t(
                          habit.completedDates.includes(day) ? (
                            <Check size={11} />
                          ) : (
                            new Date(`${day}T12:00Z`).toLocaleDateString(
                              "en-IN",
                              { weekday: "narrow", timeZone: "UTC" },
                            )
                          ),
                        )}
                      </span>
                    )),
                  )}
                </div>
                <button
                  className={
                    completed
                      ? "secondary full-width habit-done"
                      : "primary full-width"
                  }
                  aria-pressed={completed}
                  onClick={() => {
                    setHabits((current) =>
                      current.map((item) =>
                        item.id === habit.id
                          ? {
                              ...item,
                              completedDates: completed
                                ? item.completedDates.filter(
                                    (day) => day !== today,
                                  )
                                : [...item.completedDates, today],
                            }
                          : item,
                      ),
                    );
                    if (!completed)
                      notify("A small promise kept. That counts.");
                  }}
                >
                  <Check size={15} />
                  {t(completed ? "Done for today · undo" : "I did my minimum")}
                </button>
              </article>
            );
          }),
        )}
      </div>
      {t(
        !habits.length && (
          <div className="panel empty-state">
            <Leaf size={36} />
            <h2>{t("Start with one promise you can keep.")}</h2>
            <p>
              {t("One page. Two minutes of movement. A kind message.")}
              <br />
              {t("Choose what matters to your life.")}
            </p>
            <button className="secondary" onClick={() => open()}>
              <Plus size={16} />
              {t(" Create your first habit")}
            </button>
          </div>
        ),
      )}
      <DailyJournal
        journal={journal}
        setJournal={setJournal}
        sessions={sessions}
        dailyTarget={dailyTarget}
        notify={notify}
      />
      {t(
        form && (
          <Modal
            title={
              editing
                ? "Make your habit work for you."
                : "Make a promise small enough to keep."
            }
            onClose={() => setForm(false)}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const habit: Habit = {
                  id: editing?.id || crypto.randomUUID(),
                  title: title.trim(),
                  area,
                  cue: cue.trim(),
                  minimum: minimum.trim(),
                  ambition: ambition.trim(),
                  completedDates: editing?.completedDates || [],
                };
                setHabits((current) =>
                  editing
                    ? current.map((item) =>
                        item.id === habit.id ? habit : item,
                      )
                    : [...current, habit],
                );
                setForm(false);
              }}
            >
              <label className="field">
                {t("Habit name")}
                <input
                  autoFocus
                  maxLength={100}
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("Read every day")}
                />
              </label>
              <label className="field">
                {t("Life area")}
                <select
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                >
                  {t(
                    areas.map((value) => (
                      <option key={value}>{t(value)}</option>
                    )),
                  )}
                </select>
              </label>
              <label className="field">
                {t("After I\u2026 (attach it to something you already do)")}
                <input
                  maxLength={200}
                  value={cue}
                  onChange={(event) => setCue(event.target.value)}
                  placeholder={t("finish my morning chai")}
                />
              </label>
              <label className="field">
                {t("The smallest action that counts")}
                <input
                  maxLength={200}
                  required
                  value={minimum}
                  onChange={(event) => setMinimum(event.target.value)}
                  placeholder={t("Read one page for two minutes")}
                />
              </label>
              <label className="field">
                {t("My bigger direction (optional)")}
                <input
                  maxLength={200}
                  value={ambition}
                  onChange={(event) => setAmbition(event.target.value)}
                  placeholder={t("Become a thoughtful, consistent learner")}
                />
              </label>
              <button
                className="primary full-width"
                disabled={!title.trim() || !minimum.trim()}
              >
                <Check size={16} />
                {t(" Save my habit")}
              </button>
            </form>
          </Modal>
        ),
      )}
    </>
  );
}
