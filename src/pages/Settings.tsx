import { t } from "../i18n";
import { languages } from "../i18n";
import {
  useEffect,
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
  studyStreak,
  validateBackup,
  type Backup,
} from "../lib/study";
import { downloadFile } from "../lib/storage";
import type { Note, Profile, Session, Task } from "../types";
import { Modal } from "../components/Modal";
interface SettingsProps {
  profile: Profile;
  setProfile: Dispatch<SetStateAction<Profile>>;
  backup: Backup;
  onImport: (data: Backup) => void;
  notify: (message: string) => void;
  onInstall: () => void;
}
export function Settings({
  profile,
  setProfile,
  backup,
  onImport,
  notify,
  onInstall,
}: SettingsProps) {
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);
  const [pending, setPending] = useState<Backup | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">{t("MAKE YOURSELF AT HOME")}</div>
          <h1>{t("Your space. Your way.")}</h1>
          <p>{t("A few little things to make Padhai feel like you.")}</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel settings-panel">
          <h2>
            <GraduationCap size={20} />
            {t(" A little about you")}
          </h2>
          <p className="muted">
            {t("A profile on this device. No email or password needed.")}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.name.trim()) return;
              setProfile({ ...draft, name: draft.name.trim() });
              notify("Your space is a little more you. Profile saved.");
            }}
          >
            <label className="field">
              {t("What should we call you?")}
              <input
                required
                maxLength={40}
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label className="field">
              {t("What are you working towards?")}
              <select
                value={draft.exam}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    exam: event.target.value as Profile["exam"],
                  })
                }
              >
                {t(
                  [
                    "JEE",
                    "NEET",
                    "UPSC",
                    "GATE",
                    "School",
                    "College",
                    "Other",
                  ].map((exam) => <option key={exam}>{t(exam)}</option>),
                )}
              </select>
            </label>
            <div className="form-columns">
              <label className="field">
                {t("Daily focus goal (minutes)")}
                <input
                  type="number"
                  required
                  min={15}
                  max={1440}
                  step={15}
                  value={draft.dailyGoal}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      dailyGoal: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="field">
                {t("Your target date (optional)")}
                <input
                  type="date"
                  value={draft.examDate}
                  onChange={(event) =>
                    setDraft({ ...draft, examDate: event.target.value })
                  }
                />
              </label>
            </div>
            <label className="field">
              {t("App language")}
              <select
                value={draft.language}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    language: event.target.value as "en" | "hi",
                  })
                }
              >
                {t(
                  languages.map((language) => (
                    <option
                      key={language.code}
                      value={language.code}
                      translate="no"
                    >
                      {language.name}
                    </option>
                  )),
                )}
              </select>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={draft.lowData}
                onChange={(event) =>
                  setDraft({ ...draft, lowData: event.target.checked })
                }
              />
              <span>
                {t("Low-data study mode")}
                <small>
                  {t(
                    "Hide photos and disable outgoing calls. Timers, chat, notes, and goals keep working.",
                  )}
                </small>
              </span>
            </label>
            <button
              className="primary"
              type="submit"
              disabled={!draft.name.trim()}
            >
              {t("Save my preferences ")}
              <Check size={16} />
            </button>
          </form>
        </section>
        <div className="settings-side">
          <section className="panel settings-panel">
            <h2>
              <Download size={20} />
              {t(" Padhai, on your home screen.")}
            </h2>
            <p className="muted">
              {t(
                "Install the app for a quieter, full-screen space. While you stay signed in with the app open, personal study tools continue during a connection drop. New sign-ins need internet.",
              )}
            </p>
            <button className="secondary" onClick={onInstall}>
              <Plus size={16} />
              {t(" Install Padhai")}
            </button>
          </section>
          <section className="panel settings-panel">
            <h2>
              <Bell size={20} />
              {t(" A gentle nudge")}
            </h2>
            <p className="muted">
              {t(
                "Get a browser notification when your timer ends. Your browser must be open.",
              )}
            </p>
            <button
              className="secondary"
              onClick={async () => {
                if (!("Notification" in window)) {
                  notify(
                    "This browser does not support notifications. On iPhone, try installing Padhai first.",
                  );
                  return;
                }
                try {
                  const result = await Notification.requestPermission();
                  notify(
                    result === "granted"
                      ? "All set. We’ll let you know when your session ends."
                      : "Notifications are off. You can enable them in browser settings.",
                  );
                } catch {
                  notify("Notifications aren’t available in this browser.");
                }
              }}
            >
              {t("Enable timer notifications ")}
              <Bell size={15} />
            </button>
          </section>
          <section className="panel settings-panel">
            <h2>
              <ShieldCheck size={20} />
              {t(" Your progress belongs to you.")}
            </h2>
            <p className="muted">
              {t(
                "Your workspace saves here and syncs as an encrypted cloud backup. Keep your private study key or download a backup before clearing browser data.",
              )}
            </p>
            <div className="backup-actions">
              <button
                className="secondary"
                onClick={() =>
                  downloadFile(
                    `padhai-backup-${indiaDate()}.json`,
                    JSON.stringify(backup, null, 2),
                  )
                }
              >
                <ArrowDownToLine size={16} />
                {t(" Export backup")}
              </button>
              <button
                className="secondary"
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={16} />
                {t(" Restore")}
              </button>
            </div>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="application/json,.json"
              aria-label={t("Import Padhai backup")}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 20000000)
                    throw new Error("Choose a backup smaller than 20 MB.");
                  setPending(validateBackup(JSON.parse(await file.text())));
                } catch (error) {
                  notify(
                    error instanceof Error
                      ? error.message
                      : "Could not read this backup.",
                  );
                }
                event.target.value = "";
              }}
            />
          </section>
          <div className="free-promise">
            <span>{t("\u2733")}</span>
            <div>
              <strong>{t("No subscriptions. No upgrades.")}</strong>
              <p>{t("Every feature is for every student.")}</p>
            </div>
          </div>
        </div>
      </div>
      {t(
        pending && (
          <Modal
            title={t("Bring your study space back?")}
            onClose={() => setPending(null)}
          >
            <p className="muted">
              {t("This backup contains ")}
              {t(pending.tasks.length)}
              {t(" tasks, ")}
              {t(pending.notes.length)}
              {t(" notes, and ")}
              {t(pending.sessions.length)}
              {t(
                " study sessions. Restoring will replace the data on this device. Export your current backup first if you need it.",
              )}
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setPending(null)}>
                {t("Keep current data")}
              </button>
              <button
                className="primary"
                onClick={() => {
                  onImport(pending);
                  setDraft(pending.profile);
                  setPending(null);
                  notify("Your study space is restored. Welcome back.");
                }}
              >
                {t("Restore backup")}
              </button>
            </div>
          </Modal>
        ),
      )}
    </>
  );
}
