import { useState } from "react";
import { ArrowRight, BookOpenCheck, UserRound } from "lucide-react";
import { Modal } from "./Modal";
import { examPresets } from "../lib/plans";
import { t } from "../i18n";

export function Onboarding({
  name,
  examName,
  onContinue,
}: {
  name: string;
  examName: string;
  onContinue: (name: string, exam: string) => void;
}) {
  const [displayName, setDisplayName] = useState(
    name === "Student" ? "" : name,
  );
  const [exam, setExam] = useState(
    examName === "JEE Main / Advanced" && name === "Student"
      ? "GATE CS"
      : examName,
  );
  return (
    <Modal title={t("Welcome to Padhai")} onClose={() => {}} closable={false}>
      <img className="onboarding-logo" src="/padhai-logo.webp" alt="Padhai" />
      <p className="muted">
        {t(
          "Let’s set up your study space. Enter your name and choose the exam you are preparing for.",
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (displayName.trim()) onContinue(displayName.trim(), exam);
        }}
      >
        <label className="field">
          <span>
            <UserRound size={16} /> {t("What should we call you?")}
          </span>
          <input
            autoFocus
            required
            maxLength={40}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t("Enter your name or nickname")}
            autoComplete="given-name"
          />
        </label>
        <label className="field">
          <span>
            <BookOpenCheck size={16} /> {t("I am preparing for")}
          </span>
          <select
            value={exam}
            onChange={(event) => setExam(event.target.value)}
          >
            {Object.keys(examPresets).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="language-notice">
          {t(
            "Your name is shown to people in your study room. Your notes and study history remain private.",
          )}
        </p>
        <button
          className="primary full-width"
          type="submit"
          disabled={!displayName.trim()}
        >
          {t("Open my study space")}
          <ArrowRight size={18} />
        </button>
      </form>
    </Modal>
  );
}
