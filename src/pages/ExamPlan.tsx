import { t } from "../i18n";
import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Save,
  Target,
  Timer,
  Trash2,
} from "lucide-react";
import type { ExamPlan as Plan, Session, Subject, Topic } from "../types";
import { examPresets, makePlan, makeSubject, periodStart } from "../lib/plans";
import { durationLabel, indiaDate } from "../lib/study";
import { api } from "../lib/cloud";
import { Modal } from "../components/Modal";
import { SyllabusUpload } from "../components/SyllabusUpload";
import { downloadAttachment, saveAttachment } from "../lib/attachments";
interface ImportedSyllabus {
  title: string;
  url: string;
  fetchedAt: string;
  text: string;
  outline: {
    name: string;
    topics: string[];
  }[];
  warning: string;
  examName?: string;
}
interface Props {
  plan: Plan;
  setPlan: Dispatch<SetStateAction<Plan>>;
  sessions: Session[];
  setSessions: Dispatch<SetStateAction<Session[]>>;
  startSubject: (subject: Subject) => void;
  notify: (message: string) => void;
  language: string;
  archiveSource: (source: NonNullable<Plan["source"]>) => void;
}
export function ExamPlan({
  plan,
  setPlan,
  sessions,
  setSessions,
  startSubject,
  notify,
  language,
  archiveSource,
}: Props) {
  const [editing, setEditing] = useState<{
    kind: "subject" | "topic";
    subjectId: string;
    topicId?: string;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [weekly, setWeekly] = useState(300);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [showTargets, setShowTargets] = useState(false);
  const [targets, setTargets] = useState(plan.targets);
  const [preset, setPreset] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importExam, setImportExam] = useState("gatecs");
  const [imported, setImported] = useState<ImportedSyllabus | null>(null);
  const [outline, setOutline] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [replaceSubjects, setReplaceSubjects] = useState(false);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [logging, setLogging] = useState(false);
  const [logSubject, setLogSubject] = useState(plan.subjects[0]?.id || "");
  const [logMinutes, setLogMinutes] = useState(25);
  const [logDate, setLogDate] = useState(indiaDate());
  const allTopics = plan.subjects.flatMap((subject) => subject.topics);
  const doneTopics = allTopics.filter((topic) => topic.done).length;
  function updateSubject(
    subjectId: string,
    update: (subject: Subject) => Subject,
  ) {
    setPlan((current) => ({
      ...current,
      subjects: current.subjects.map((subject) =>
        subject.id === subjectId ? update(subject) : subject,
      ),
    }));
  }
  function editSubject(subject?: Subject) {
    setTitle(subject?.name || "");
    setWeekly(subject?.weeklyMinutes || 300);
    setEditing({ kind: "subject", subjectId: subject?.id || "" });
  }
  function editTopic(subject: Subject, topic?: Topic) {
    setTitle(topic?.title || "");
    setDetail(topic?.notes || "");
    setEditing({ kind: "topic", subjectId: subject.id, topicId: topic?.id });
  }
  async function fetchOfficial() {
    setFetching(true);
    setFetchError("");
    try {
      const result = await api<ImportedSyllabus>(`syllabus?exam=${importExam}`);
      setUploadedFile(null);
      setImported(result);
      setOutline(
        result.outline
          .map(
            (subject) =>
              `# ${subject.name}\n${subject.topics.map((topic) => `- ${topic}`).join("\n")}`,
          )
          .join("\n\n") ||
          `# Official syllabus\n- Review the official text below and add your topics`,
      );
    } catch (error) {
      setFetchError(
        error instanceof Error
          ? error.message
          : "Could not fetch the official syllabus.",
      );
    } finally {
      setFetching(false);
    }
  }
  async function importOutline() {
    const subjects: Subject[] = [];
    for (const line of outline
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean)) {
      if (line.startsWith("#"))
        subjects.push(
          makeSubject(line.replace(/^#+\s*/, "").slice(0, 100) || "My subject"),
        );
      else {
        if (!subjects.length) subjects.push(makeSubject("My syllabus"));
        subjects[subjects.length - 1].topics.push({
          id: crypto.randomUUID(),
          title: line.replace(/^[-•]\s*/, "").slice(0, 200),
          done: false,
          notes: "",
        });
      }
    }
    if (!subjects.length) {
      notify("Add at least one subject or topic to import.");
      return;
    }
    if (
      subjects.length + (replaceSubjects ? 0 : plan.subjects.length) > 300 ||
      subjects.some((subject) => subject.topics.length > 2000)
    ) {
      setFetchError(
        "This outline is too large. Keep at most 300 subjects and 2,000 topics per subject.",
      );
      return;
    }
    setFetching(true);
    try {
      const attachment = uploadedFile
        ? await saveAttachment(uploadedFile)
        : undefined;
      if (imported && plan.source?.attachment) archiveSource(plan.source);
      setPlan((current) => ({
        ...current,
        examName:
          replaceSubjects && imported?.examName
            ? imported.examName
            : current.examName,
        subjects: replaceSubjects
          ? subjects
          : [...current.subjects, ...subjects],
        ...(imported
          ? {
              source: {
                url: imported.url,
                title: imported.title,
                fetchedAt: imported.fetchedAt,
                text: imported.text,
                attachment,
              },
            }
          : {}),
      }));
      setImportOpen(false);
      notify(
        "Your reviewed syllabus is saved. Every subject and topic is editable.",
      );
    } catch (error) {
      setFetchError(
        error instanceof Error
          ? error.message
          : "Could not save your PDF. Please retry.",
      );
    } finally {
      setFetching(false);
    }
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            {t("A CLEAR PLAN FOR YOUR BIG AMBITION")}
          </div>
          <h1>{t("Your next chapter, mapped.")}</h1>
          <p>
            {t(
              "Know what to study. See what\u2019s moving. Make the next hour count.",
            )}
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setImported(null);
            setUploadedFile(null);
            setReplaceSubjects(false);
            setOutline("");
            setFetchError("");
            setImportOpen(true);
          }}
        >
          <ArrowDownToLine size={16} />
          {t(" Import syllabus")}
        </button>
      </div>
      <div className="exam-plan-top panel">
        <div>
          <label className="eyebrow" htmlFor="exam-name">
            {t("YOUR EXAM")}
          </label>
          <input
            id="exam-name"
            maxLength={100}
            value={plan.examName}
            onChange={(event) =>
              setPlan({ ...plan, examName: event.target.value })
            }
            aria-label={t("Your exam name")}
          />
        </div>
        <label className="preset-select">
          <span className="sr-only">{t("Choose exam subject preset")}</span>
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) setPreset(event.target.value);
            }}
          >
            <option value="">{t("Choose a subject preset")}</option>
            {t(
              Object.keys(examPresets).map((name) => (
                <option key={name} value={name}>
                  {t(name)}
                </option>
              )),
            )}
          </select>
        </label>
        <div className="exam-completion">
          <CheckCheck size={20} />
          <strong>
            {t(doneTopics)}
            <small>
              {t(" / ")}
              {t(allTopics.length)}
              {t(" topics")}
            </small>
          </strong>
        </div>
      </div>
      <div className="target-grid">
        {t(
          (["daily", "weekly", "monthly", "yearly"] as const).map((period) => {
            const start = periodStart(period);
            const seconds = sessions
              .filter(
                (session) =>
                  session.endedAt >= start && session.endedAt <= Date.now(),
              )
              .reduce((sum, session) => sum + session.seconds, 0);
            const percentage = Math.min(
              100,
              Math.round((seconds / (plan.targets[period] * 60)) * 100),
            );
            return (
              <button
                className="panel target-card"
                key={period}
                onClick={() => {
                  setTargets(plan.targets);
                  setShowTargets(true);
                }}
              >
                <span>
                  {t(
                    period === "daily"
                      ? "Today"
                      : period === "weekly"
                        ? "This week"
                        : period === "monthly"
                          ? "This month"
                          : "This year",
                  )}
                  <Target size={16} />
                </span>
                <strong>
                  {t(durationLabel(seconds))}
                  <small>
                    {t(" / ")}
                    {t(durationLabel(plan.targets[period] * 60))}
                  </small>
                </strong>
                <div className="goal-track">
                  <i style={{ width: `${percentage}%` }} />
                </div>
                <span>
                  {t(percentage)}
                  {t("% of your target ")}
                  <Pencil size={10} />
                </span>
              </button>
            );
          }),
        )}
      </div>
      <div className="section-heading">
        <div>
          <h2>{t("Make the syllabus yours.")}</h2>
          <p>
            {t(
              "Track topics, revision notes, subject hours, and weekly targets.",
            )}
          </p>
        </div>
        <div className="inline-actions">
          <button
            className="secondary"
            onClick={() => {
              setLogSubject(plan.subjects[0]?.id || "");
              setLogging(true);
            }}
          >
            <Clock3 size={15} />
            {t(" Log study")}
          </button>
          <button className="primary" onClick={() => editSubject()}>
            <Plus size={15} />
            {t(" Subject")}
          </button>
        </div>
      </div>
      <div className="subject-list">
        {t(
          plan.subjects.map((subject, index) => {
            const total = sessions
              .filter(
                (session) =>
                  session.subjectId === subject.id ||
                  (!session.subjectId && session.subject === subject.name),
              )
              .reduce((sum, session) => sum + session.seconds, 0);
            const week = sessions
              .filter(
                (session) =>
                  (session.subjectId === subject.id ||
                    (!session.subjectId && session.subject === subject.name)) &&
                  session.endedAt >= periodStart("weekly"),
              )
              .reduce((sum, session) => sum + session.seconds, 0);
            const completed = subject.topics.filter(
              (topic) => topic.done,
            ).length;
            const open = expanded.includes(subject.id);
            return (
              <section className="panel subject-card" key={subject.id}>
                <div className="subject-heading">
                  <span className={`subject-number tone-${index % 4}`}>
                    {t(String(index + 1).padStart(2, "0"))}
                  </span>
                  <button
                    className="subject-title"
                    onClick={() =>
                      setExpanded((current) =>
                        open
                          ? current.filter((id) => id !== subject.id)
                          : [...current, subject.id],
                      )
                    }
                    aria-expanded={open}
                  >
                    <h2 translate="no">{subject.name}</h2>
                    <span>
                      {t(completed)}
                      {t("/")}
                      {t(subject.topics.length)}
                      {t(" topics \u00B7 ")}
                      {t(durationLabel(total))}
                      {t(" studied")}
                    </span>
                  </button>
                  <div className="subject-week">
                    <strong>
                      {t(durationLabel(week))}
                      <small>
                        {t(" / ")}
                        {t(durationLabel(subject.weeklyMinutes * 60))}
                        {t(" this week")}
                      </small>
                    </strong>
                    <div className="goal-track">
                      <i
                        style={{
                          width: `${Math.min(100, (week / (subject.weeklyMinutes * 60)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <button
                    className="secondary subject-start"
                    onClick={() => startSubject(subject)}
                  >
                    <Timer size={14} />
                    {t(" Focus")}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Edit ${subject.name}`}
                    onClick={() => editSubject(subject)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button delete-button"
                    aria-label={`Delete subject ${subject.name}`}
                    onClick={() => setDeleting(subject)}
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    className={`icon-button expand-subject ${open ? "expanded" : ""}`}
                    onClick={() =>
                      setExpanded((current) =>
                        open
                          ? current.filter((id) => id !== subject.id)
                          : [...current, subject.id],
                      )
                    }
                    aria-label={`${open ? "Collapse" : "Expand"} ${subject.name}`}
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>
                {t(
                  open && (
                    <div className="subject-topics">
                      {t(
                        subject.topics.length ? (
                          subject.topics.map((topic) => (
                            <div
                              className={`topic-row ${topic.done ? "done" : ""}`}
                              key={topic.id}
                            >
                              <button
                                className="task-check"
                                aria-pressed={topic.done}
                                aria-label={`Mark ${topic.title} ${topic.done ? "incomplete" : "complete"}`}
                                onClick={() =>
                                  updateSubject(subject.id, (current) => ({
                                    ...current,
                                    topics: current.topics.map((item) =>
                                      item.id === topic.id
                                        ? { ...item, done: !item.done }
                                        : item,
                                    ),
                                  }))
                                }
                              >
                                {t(topic.done && <Check size={13} />)}
                              </button>
                              <div>
                                <strong translate="no">{topic.title}</strong>
                                {t(
                                  topic.notes && (
                                    <p translate="no">{topic.notes}</p>
                                  ),
                                )}
                              </div>
                              <button
                                className="icon-button"
                                aria-label={`Edit topic ${topic.title}`}
                                onClick={() => editTopic(subject, topic)}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                className="icon-button delete-button"
                                aria-label={`Delete topic ${topic.title}`}
                                onClick={() =>
                                  updateSubject(subject.id, (current) => ({
                                    ...current,
                                    topics: current.topics.filter(
                                      (item) => item.id !== topic.id,
                                    ),
                                  }))
                                }
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="subject-empty">
                            {t(
                              "A fresh outline. Add your chapters, revision topics, or practice sets.",
                            )}
                          </p>
                        ),
                      )}
                      <button
                        className="text-button"
                        onClick={() => editTopic(subject)}
                      >
                        <Plus size={14} />
                        {t(" Add a topic")}
                      </button>
                    </div>
                  ),
                )}
              </section>
            );
          }),
        )}
      </div>
      {t(
        !plan.subjects.length && (
          <div className="panel empty-state">
            <BookOpen size={35} />
            <h2>{t("A syllabus that fits your journey.")}</h2>
            <p>
              {t(
                "Add your first subject, use a preset, or import from an official source.",
              )}
            </p>
            <button className="secondary" onClick={() => editSubject()}>
              <Plus size={16} />
              {t(" Add subject")}
            </button>
          </div>
        ),
      )}
      {t(
        plan.source && (
          <div className="source-note">
            <FileText size={17} />
            <div>
              <strong>{t("Your saved syllabus source")}</strong>
              <strong translate="no">{plan.source.title}</strong>
              {plan.source.url && (
                <a href={plan.source.url} target="_blank" rel="noreferrer">
                  {t("Open source document")}
                  <ExternalLink size={12} />
                </a>
              )}
              {plan.source.attachment && (
                <button
                  className="text-button"
                  onClick={() =>
                    void downloadAttachment(plan.source!.attachment!).catch(
                      (error) => notify(error.message),
                    )
                  }
                >
                  {t("Download my original PDF")}
                </button>
              )}
              <span>
                {t("Fetched ")}
                {t(new Date(plan.source.fetchedAt).toLocaleDateString("en-IN"))}
                {t(
                  " \u00B7 Your edits apply only to your copy. Verify the year and source before relying on this outline.",
                )}
              </span>
              <details>
                <summary>{t("Read original extracted text")}</summary>
                <pre translate="no">{plan.source.text}</pre>
              </details>
            </div>
          </div>
        ),
      )}

      {t(
        editing && (
          <Modal
            title={
              editing.kind === "subject"
                ? "A little structure for your study."
                : "One topic at a time."
            }
            onClose={() => setEditing(null)}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (editing.kind === "subject") {
                  if (editing.subjectId)
                    updateSubject(editing.subjectId, (current) => ({
                      ...current,
                      name: title.trim(),
                      weeklyMinutes: weekly,
                    }));
                  else
                    setPlan((current) => ({
                      ...current,
                      subjects: [
                        ...current.subjects,
                        { ...makeSubject(title.trim()), weeklyMinutes: weekly },
                      ],
                    }));
                } else
                  updateSubject(editing.subjectId, (current) => ({
                    ...current,
                    topics: editing.topicId
                      ? current.topics.map((topic) =>
                          topic.id === editing.topicId
                            ? { ...topic, title: title.trim(), notes: detail }
                            : topic,
                        )
                      : [
                          ...current.topics,
                          {
                            id: crypto.randomUUID(),
                            title: title.trim(),
                            notes: detail,
                            done: false,
                          },
                        ],
                  }));
                setEditing(null);
              }}
            >
              <label className="field">
                {t(editing.kind === "subject" ? "Subject name" : "Topic name")}
                <input
                  autoFocus
                  required
                  maxLength={editing.kind === "subject" ? 100 : 200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              {t(
                editing.kind === "subject" ? (
                  <label className="field">
                    {t("Weekly target for this subject (minutes)")}
                    <input
                      type="number"
                      required
                      min={1}
                      max={10080}
                      value={weekly}
                      onChange={(event) =>
                        setWeekly(Number(event.target.value))
                      }
                    />
                  </label>
                ) : (
                  <label className="field">
                    {t("Revision notes")}
                    <textarea
                      rows={5}
                      maxLength={5000}
                      value={detail}
                      onChange={(event) => setDetail(event.target.value)}
                      placeholder={t(
                        "Tricky points, next revision, or practice reminders\u2026",
                      )}
                    />
                  </label>
                ),
              )}
              <button className="primary full-width" disabled={!title.trim()}>
                <Save size={16} />
                {t(" Save")}
              </button>
            </form>
          </Modal>
        ),
      )}
      {t(
        showTargets && (
          <Modal
            title={t("A target for every horizon.")}
            onClose={() => setShowTargets(false)}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setPlan({ ...plan, targets });
                setShowTargets(false);
              }}
            >
              <p className="muted">
                {t(
                  "Set realistic study time in minutes. Weekly progress starts on Monday. All periods use IST.",
                )}
              </p>
              {t(
                (["daily", "weekly", "monthly", "yearly"] as const).map(
                  (period) => (
                    <label className="field" key={period}>
                      {t(period[0].toUpperCase() + period.slice(1))}
                      {t(" target (minutes)")}
                      <input
                        type="number"
                        required
                        min={1}
                        max={
                          {
                            daily: 1440,
                            weekly: 10080,
                            monthly: 44640,
                            yearly: 527040,
                          }[period]
                        }
                        value={targets[period]}
                        onChange={(event) =>
                          setTargets({
                            ...targets,
                            [period]: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  ),
                ),
              )}
              <button className="primary full-width">
                <Target size={16} />
                {t(" Save targets")}
              </button>
            </form>
          </Modal>
        ),
      )}
      {t(
        preset && (
          <Modal
            title={t("Start with a subject template?")}
            onClose={() => setPreset(null)}
          >
            <p className="muted">
              {t("Use ")}
              {t(preset)}
              {t(
                " as a starting point? This replaces the current subject and topic list. Your study history and time targets are kept. Templates are not a verified official syllabus.",
              )}
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setPreset(null)}>
                {t("Keep my plan")}
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (plan.source?.attachment) archiveSource(plan.source);
                  setPlan({ ...makePlan(preset), targets: plan.targets });
                  setPreset(null);
                }}
              >
                {t("Use template")}
              </button>
            </div>
          </Modal>
        ),
      )}
      {t(
        deleting && (
          <Modal
            title={t("Remove this subject?")}
            onClose={() => setDeleting(null)}
          >
            <p className="muted">
              {t("Remove ")}
              {t(deleting.name)}
              {t(" and its ")}
              {t(deleting.topics.length)}
              {t(" topics? Saved study sessions will stay in your history.")}
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setDeleting(null)}>
                {t("Keep subject")}
              </button>
              <button
                className="danger"
                onClick={() => {
                  setPlan((current) => ({
                    ...current,
                    subjects: current.subjects.filter(
                      (subject) => subject.id !== deleting.id,
                    ),
                  }));
                  setDeleting(null);
                }}
              >
                {t("Remove subject")}
              </button>
            </div>
          </Modal>
        ),
      )}
      {t(
        logging && (
          <Modal
            title={t("Give your effort its credit.")}
            onClose={() => setLogging(false)}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const subject = plan.subjects.find(
                  (item) => item.id === logSubject,
                );
                const end = Math.min(
                  Date.now(),
                  Date.parse(`${logDate}T23:59:00+05:30`),
                );
                setSessions((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    seconds: logMinutes * 60,
                    subject: subject?.name || "General study",
                    subjectId: subject?.id,
                    endedAt: end,
                    manual: true,
                  },
                ]);
                setLogging(false);
                notify(
                  "Your study time is saved. Manual entries are labelled in history.",
                );
              }}
            >
              <p className="muted">
                {t(
                  "For the time you studied away from the timer. Add only the time you actually spent.",
                )}
              </p>
              <label className="field">
                {t("Subject")}
                <select
                  value={logSubject}
                  onChange={(event) => setLogSubject(event.target.value)}
                >
                  <option value="">{t("General study")}</option>
                  {t(
                    plan.subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {t(subject.name)}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <label className="field">
                {t("Minutes studied")}
                <input
                  type="number"
                  min={1}
                  max={1440}
                  required
                  value={logMinutes}
                  onChange={(event) =>
                    setLogMinutes(Number(event.target.value))
                  }
                />
              </label>
              <label className="field">
                {t("Date")}
                <input
                  type="date"
                  required
                  max={indiaDate()}
                  value={logDate}
                  onChange={(event) => setLogDate(event.target.value)}
                />
              </label>
              <button className="primary full-width">
                <Check size={16} />
                {t(" Save study log")}
              </button>
            </form>
          </Modal>
        ),
      )}
      {t(
        importOpen && (
          <Modal
            title={t("Build a plan from your syllabus.")}
            onClose={() => setImportOpen(false)}
            wide
          >
            <SyllabusUpload
              language={language}
              onRead={(draft, file) => {
                const preview = draft.subjects
                  .map(
                    (subject) =>
                      `# ${subject.name}\n${subject.topics.map((topic) => `- ${topic}`).join("\n")}`,
                  )
                  .join("\n\n");
                setUploadedFile(file);
                setImported({
                  title: file.name.slice(0, 200),
                  url: "",
                  fetchedAt: new Date().toISOString(),
                  text: preview,
                  outline: draft.subjects,
                  warning: draft.warning,
                  examName: draft.examName,
                });
                setOutline(preview);
                setFetchError("");
              }}
            />
            <h3 className="import-alternative">
              {t("Or fetch an official syllabus")}
            </h3>
            <div className="import-controls">
              <select
                value={importExam}
                onChange={(event) => setImportExam(event.target.value)}
                aria-label={t("Official exam source")}
              >
                <option value="gatecs">GATE 2027 CS · IIT Madras</option>
                <option value="jee">{t("JEE Main \u00B7 NTA")}</option>
                <option value="neet">{t("NEET UG \u00B7 NTA")}</option>
                <option value="upsc">{t("UPSC CSE")}</option>
                <option value="ssc">{t("SSC CGL")}</option>
              </select>
              <button
                className="primary"
                onClick={() => void fetchOfficial()}
                disabled={fetching}
              >
                <ArrowDownToLine size={15} />
                {t(
                  fetching
                    ? "Reading official source…"
                    : "Fetch official syllabus",
                )}
              </button>
            </div>
            <p className="import-notice">
              {t(
                "The importer reads the official website and PDF. Review the document year and extracted outline. Choose whether to add subjects or replace your outline. Study history is always kept.",
              )}
            </p>
            {t(
              fetchError && (
                <p className="inline-error" role="alert">
                  {t(fetchError)}
                </p>
              ),
            )}
            {t(
              imported && (
                <div className="import-source">
                  {imported.url ? (
                    <a href={imported.url} target="_blank" rel="noreferrer">
                      {t("Open official PDF ")}
                      <ExternalLink size={13} />
                    </a>
                  ) : (
                    <strong translate="no">{imported.title}</strong>
                  )}
                  <p>{t(imported.warning)}</p>
                  <details>
                    <summary>{t("Read extracted official text")}</summary>
                    <pre translate="no">{imported.text}</pre>
                  </details>
                </div>
              ),
            )}
            <label className="field">
              {t("Editable import preview")}
              <textarea
                rows={12}
                maxLength={180000}
                value={outline}
                onChange={(event) => setOutline(event.target.value)}
                placeholder={
                  "# Physics\n- Kinematics\n- Laws of motion\n\n# Chemistry\n- Atomic structure"
                }
              />
            </label>
            <p className="muted tiny">
              {t(
                "Use # for each subject, then one topic per line. You can also paste your own outline for any exam.",
              )}
            </p>
            <label className="check-field">
              <input
                type="checkbox"
                checked={replaceSubjects}
                onChange={(event) => setReplaceSubjects(event.target.checked)}
              />
              <span>
                {t("Replace my current subjects and topic checklists")}
                <small>
                  {t(
                    "Leave this off to add subjects. Replacement removes current topics and revision notes; your study history and targets are kept.",
                  )}
                </small>
              </span>
            </label>
            <button
              className="primary full-width"
              disabled={!outline.trim() || fetching}
              onClick={() => void importOutline()}
            >
              <CheckCheck size={16} />
              {t(" Save reviewed syllabus")}
            </button>
          </Modal>
        ),
      )}
    </>
  );
}
