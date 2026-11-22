import { t } from "../i18n";
import { languages } from "../i18n";
import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
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
  studySecondsByDate,
  studyStreak,
  validateBackup,
  type Backup,
} from "../lib/study";
import { downloadFile } from "../lib/storage";
import type { Note, Profile, Session, Task } from "../types";
import { Modal } from "../components/Modal";
export function Progress({
  sessions,
  tasks,
  profile,
  onSettings,
}: {
  sessions: Session[];
  tasks: Task[];
  profile: Profile;
  onSettings: () => void;
}) {
  const today = indiaDate();
  const dailySeconds = useMemo(() => studySecondsByDate(sessions), [sessions]);
  const todaySeconds = dailySeconds[today] || 0;
  const total = sessions.reduce((sum, session) => sum + session.seconds, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const time = Date.now() - (6 - index) * 86400000;
    const date = indiaDate(time);
    return {
      date,
      label: new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        timeZone: "Asia/Kolkata",
      }).format(time),
      seconds: dailySeconds[date] || 0,
    };
  });
  const largest = Math.max(
    profile.dailyGoal * 60,
    ...days.map((day) => day.seconds),
  );
  const weekTotal = days.reduce((sum, day) => sum + day.seconds, 0);
  const subjects: Record<string, number> = {};
  sessions.forEach((session) => {
    subjects[session.subject || "General study"] =
      (subjects[session.subject || "General study"] || 0) + session.seconds;
  });
  const daysToExam = profile.examDate
    ? Math.ceil(
        (Date.parse(`${profile.examDate}T00:00:00+05:30`) - Date.now()) /
          86400000,
      )
    : null;
  const heatmap = Array.from({ length: 70 }, (_, index) => {
    const date = indiaDate(Date.now() - (69 - index) * 86400000);
    return { date, minutes: Math.floor((dailySeconds[date] || 0) / 60) };
  });
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">{t("EVERY SESSION COUNTS")}</div>
          <h1>{t("Look how far you\u2019re going.")}</h1>
          <p>
            {t(
              "Progress isn\u2019t always loud. Sometimes, it\u2019s just showing up again.",
            )}
          </p>
        </div>
        <span className="live-pill">
          <ShieldCheck size={13} />
          {t(" Your real study data")}
        </span>
      </div>
      <div className="progress-stats">
        <div className="panel">
          <span className="stat-icon peach">
            <Timer size={21} />
          </span>
          <strong>{t(durationLabel(total))}</strong>
          <span>{t("Total focus time")}</span>
        </div>
        <div className="panel">
          <span className="stat-icon sage">
            <Target size={21} />
          </span>
          <strong>{t(sessions.length)}</strong>
          <span>{t("Focus sessions saved")}</span>
        </div>
        <div className="panel">
          <span className="stat-icon butter">
            <Flame size={21} />
          </span>
          <strong>
            {t(studyStreak(sessions))} <small>{t("days")}</small>
          </strong>
          <span>{t("Current study streak")}</span>
        </div>
        <div className="panel">
          <span className="stat-icon lavender">
            <CheckCheck size={21} />
          </span>
          <strong>{t(tasks.filter((task) => task.done).length)}</strong>
          <span>{t("Little wins completed")}</span>
        </div>
      </div>
      <div className="progress-columns">
        <section className="panel weekly-chart">
          <div className="section-heading">
            <div>
              <h2>{t("Your week in focus")}</h2>
              <p>{t("Little by little, it adds up.")}</p>
            </div>
            <span className="tag">
              {t(durationLabel(weekTotal))}
              {t(" this week")}
            </span>
          </div>
          <div
            className="chart"
            role="img"
            aria-label={`Study time this week: ${days.map((day) => `${day.label}: ${durationLabel(day.seconds)}`).join(", ")}`}
          >
            <div className="chart-grid">
              <span>{t(durationLabel(largest))}</span>
              <span>{t(durationLabel(largest / 2))}</span>
              <span>{t("0m")}</span>
            </div>
            <div className="chart-bars">
              {t(
                days.map((day) => (
                  <div
                    key={day.date}
                    className={`chart-column ${day.date === today ? "today" : ""}`}
                  >
                    <span>{t(durationLabel(day.seconds))}</span>
                    <div className="bar-track">
                      <i
                        style={{
                          height: `${Math.max(day.seconds ? 3 : 0, (day.seconds / largest) * 100)}%`,
                        }}
                      />
                    </div>
                    <span>{t(day.label)}</span>
                  </div>
                )),
              )}
            </div>
          </div>
        </section>
        <section className="panel goal-panel">
          <Target size={27} />
          <h2>{t("A promise to yourself.")}</h2>
          <p>{t("Your daily focus goal")}</p>
          <strong>
            {t(Math.floor(todaySeconds / 60))}
            <small>
              {t(" / ")}
              {t(profile.dailyGoal)}
              {t(" min")}
            </small>
          </strong>
          <div className="goal-track">
            <i
              style={{
                width: `${Math.min(100, (todaySeconds / (profile.dailyGoal * 60)) * 100)}%`,
              }}
            />
          </div>
          <p>
            {t(
              todaySeconds >= profile.dailyGoal * 60
                ? "You did it. Take a moment to be proud."
                : `${Math.max(0, profile.dailyGoal - Math.floor(todaySeconds / 60))} more minutes. One session at a time.`,
            )}
          </p>
          <button className="text-button" onClick={onSettings}>
            {t("Adjust your goal ")}
            <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <div className="progress-columns">
        <section className="panel consistency">
          <div className="section-heading">
            <div>
              <h2>{t("Your garden of consistency")}</h2>
              <p>{t("Every little square is a chance to grow.")}</p>
            </div>
            <Leaf size={24} />
          </div>
          <div className="heatmap">
            {t(
              heatmap.map((day) => (
                <div
                  key={day.date}
                  className={`heat-cell level-${day.minutes === 0 ? 0 : day.minutes < 30 ? 1 : day.minutes < 90 ? 2 : day.minutes < 180 ? 3 : 4}`}
                  title={`${day.date}: ${day.minutes} minutes`}
                  aria-label={`${day.date}: ${day.minutes} minutes`}
                />
              )),
            )}
          </div>
          <div className="heatmap-legend">
            <span>{t("Last 10 weeks \u00B7 IST")}</span>
            <span>
              {t("Less ")}
              <i />
              <i />
              <i />
              <i />
              <i />
              {t(" More")}
            </span>
          </div>
        </section>
        <section className="panel exam-countdown">
          <CalendarDays size={25} />
          <span className="eyebrow">{t("YOUR NEXT CHAPTER")}</span>
          <h2>
            {t(
              daysToExam === null
                ? "Something to work towards."
                : daysToExam >= 0
                  ? `${daysToExam} days. Countless possibilities.`
                  : "Ready for your next chapter?",
            )}
          </h2>
          <p>
            {t(
              profile.examDate
                ? `Your target: ${profile.examDate} · ${profile.exam}`
                : "Set your own target date and keep your dream in sight.",
            )}
          </p>
          <button className="text-button" onClick={onSettings}>
            {t(profile.examDate ? "Update target date" : "Set a target date")}{" "}
            <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <section className="panel history">
        <div className="section-heading">
          <div>
            <h2>{t("Your recent sessions")}</h2>
            <p>{t("A record of showing up for yourself.")}</p>
          </div>
          <BookMarked size={21} />
        </div>
        {t(
          sessions.length ? (
            <div className="history-list">
              {t(
                [...sessions]
                  .sort((a, b) => b.endedAt - a.endedAt)
                  .slice(0, 15)
                  .map((session) => (
                    <div key={session.id}>
                      <span className="history-check">
                        <Check size={15} />
                      </span>
                      <div>
                        <strong>
                          {t(session.subject || "A little focused study")}
                        </strong>
                        <span>
                          {t(
                            new Intl.DateTimeFormat("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Asia/Kolkata",
                            }).format(session.endedAt),
                          )}
                          {t(" IST")}
                        </span>
                      </div>
                      <b>{t(durationLabel(session.seconds))}</b>
                    </div>
                  )),
              )}
            </div>
          ) : (
            <div className="empty-state small">
              <Timer size={30} />
              <h3>{t("Your story starts with one session.")}</h3>
              <p>
                {t(
                  "Start your timer. Focus time is saved when you finish or reset.",
                )}
              </p>
            </div>
          ),
        )}
      </section>
    </>
  );
}
