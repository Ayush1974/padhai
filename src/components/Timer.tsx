import { t } from "../i18n";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Coffee,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
} from "lucide-react";
import type { FocusTimer } from "../hooks/useTimer";
import { clock } from "../lib/study";
import type { TimerMode } from "../types";
import { Modal } from "./Modal";
export function Timer({
  focus,
  onExpand,
  compact = false,
}: {
  focus: FocusTimer;
  onExpand: () => void;
  compact?: boolean;
}) {
  const [settings, setSettings] = useState(false);
  const [minutes, setMinutes] = useState(focus.timer.duration / 60);
  const [preset, setPreset] = useState(25);
  const modes: {
    id: TimerMode;
    label: string;
    minutes: number;
  }[] = [
    { id: "focus", label: "Focus", minutes: preset },
    { id: "short", label: "Short break", minutes: 5 },
    { id: "long", label: "Long break", minutes: 15 },
  ];
  const progress = 1 - focus.remaining / focus.timer.duration;
  return (
    <section
      className={`panel timer-panel ${compact ? "compact" : ""}`}
      aria-label={t("Focus timer")}
    >
      <div className="panel-heading">
        <h2>
          <span className="orange-dot" />
          {t(" Your focus space")}
        </h2>
        <button
          className="icon-button"
          onClick={onExpand}
          aria-label={t("Expand focus timer")}
        >
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="timer-tabs" role="tablist" aria-label={t("Timer mode")}>
        {t(
          modes.map((mode) => (
            <button
              key={mode.id}
              role="tab"
              aria-selected={focus.timer.mode === mode.id}
              className={focus.timer.mode === mode.id ? "active" : ""}
              onClick={() => focus.changeMode(mode.id, mode.minutes)}
            >
              {t(mode.label)}
            </button>
          )),
        )}
      </div>
      <div className="timer-dial">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <circle className="dial-track" cx="120" cy="120" r="106" />
          <circle
            className="dial-progress"
            cx="120"
            cy="120"
            r="106"
            style={{
              strokeDasharray: "666.02",
              strokeDashoffset: 666.02 * (1 - progress),
            }}
          />
        </svg>
        <div className="timer-readout">
          <span className="timer-caption">
            {t(
              focus.timer.mode === "focus"
                ? "ONE THING AT A TIME"
                : "TAKE A LITTLE BREATHER",
            )}
          </span>
          <span
            className="timer-digits"
            role="timer"
            aria-label={`${Math.floor(focus.remaining / 60)} minutes ${focus.remaining % 60} seconds remaining`}
          >
            {t(clock(focus.remaining))}
          </span>
          <span className="timer-bottom">
            {t(
              focus.timer.endAt ? (
                <>
                  <span className="pulse-dot" />{" "}
                  {t(
                    focus.timer.mode === "focus"
                      ? "You’re doing great"
                      : "Rest is productive, too",
                  )}
                </>
              ) : focus.remaining === 0 ? (
                <>
                  <Check size={13} />
                  {t(" Session complete")}
                </>
              ) : (
                <>
                  {t(
                    focus.timer.mode === "focus" ? (
                      <Sparkles size={13} />
                    ) : (
                      <Coffee size={13} />
                    ),
                  )}
                  {t(" Find your flow")}
                </>
              ),
            )}
          </span>
        </div>
      </div>
      <label className="subject-label">
        <span className="sr-only">{t("What are you studying?")}</span>
        <input
          list={compact ? "focus-subjects-compact" : "focus-subjects"}
          maxLength={100}
          disabled={!!focus.timer.endAt || focus.timer.studiedSeconds > 0}
          title={t(
            "Reset and save the current session before changing its subject.",
          )}
          value={focus.timer.subject}
          placeholder={t("Choose or type a subject")}
          onChange={(event) => focus.setSubject(event.target.value)}
        />
        <datalist id={compact ? "focus-subjects-compact" : "focus-subjects"}>
          {t(
            focus.subjects.map((subject) => (
              <option key={subject.id} value={subject.name} />
            )),
          )}
        </datalist>
      </label>
      <div className="timer-controls">
        <button
          className="icon-button bordered"
          aria-label={t("Reset timer and save progress")}
          onClick={focus.reset}
        >
          <RotateCcw size={17} />
        </button>
        <button className="primary timer-start" onClick={focus.toggle}>
          {t(
            focus.timer.endAt ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            ),
          )}
          {t(
            focus.timer.endAt
              ? "Pause focus"
              : focus.remaining === 0
                ? "Start again"
                : focus.remaining < focus.timer.duration
                  ? "Resume session"
                  : "Start session",
          )}
        </button>
        <button
          className="icon-button bordered"
          aria-label={t("Timer settings")}
          onClick={() => {
            setMinutes(focus.timer.duration / 60);
            setSettings(true);
          }}
        >
          <Settings2 size={17} />
        </button>
      </div>
      <div className="timer-footnote">
        {t("Small sessions. Meaningful progress. ")}
        <ArrowUpRight size={13} />
      </div>
      {t(
        settings && (
          <Modal
            title={t("Make time for your focus")}
            onClose={() => setSettings(false)}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setPreset(minutes);
                focus.changeMode("focus", minutes);
                setSettings(false);
              }}
            >
              <p className="muted">
                {t("Your current focus time will be saved when you switch.")}
              </p>
              <div className="preset-options">
                {t(
                  [25, 50, 90].map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={minutes === value ? "active" : ""}
                      onClick={() => setMinutes(value)}
                    >
                      {t(value)}
                      {t(" min")}
                    </button>
                  )),
                )}
              </div>
              <label className="field">
                {t("Custom focus duration (minutes)")}
                <input
                  type="number"
                  min={1}
                  max={180}
                  required
                  value={minutes}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                />
              </label>
              <button className="primary full-width" type="submit">
                {t("Save timer")}
              </button>
            </form>
          </Modal>
        ),
      )}
    </section>
  );
}
