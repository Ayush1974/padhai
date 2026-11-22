import { t } from "../i18n";
import { useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  LockKeyhole,
  BookOpen,
  Check,
  ChevronRight,
  Flame,
  Headphones,
  Heart,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Timer as TimerIcon,
  Users,
  X,
} from "lucide-react";
import { rooms } from "../data";
import type { FocusTimer } from "../hooks/useTimer";
import type { Ambient } from "../hooks/useAmbient";
import { durationLabel, indiaDate, studyStreak } from "../lib/study";
import type { Profile, Session, StudyRoom, Task } from "../types";
import { Timer } from "../components/Timer";
import { SoundMixer } from "../components/SoundMixer";
import { Modal } from "../components/Modal";
interface Props {
  myRooms: StudyRoom[];
  removeRoom: (id: string) => void;
  profile: Profile;
  sessions: Session[];
  tasks: Task[];
  counts: Record<string, number>;
  focus: FocusTimer;
  audio: Ambient;
  onJoin: (room: StudyRoom) => void;
  onExpand: () => void;
  onPlanner: () => void;
  onToggleTask: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
}
export function StudyRooms({
  myRooms,
  removeRoom,
  profile,
  sessions,
  tasks,
  counts,
  focus,
  audio,
  onJoin,
  onExpand,
  onPlanner,
  onToggleTask,
  search,
  onSearch,
}: Props) {
  const [category, setCategory] = useState("All rooms");
  const [sort, setSort] = useState("recommended");
  const [creating, setCreating] = useState(false);
  const [roomName, setRoomName] = useState("");

  const [roomMinutes, setRoomMinutes] = useState(25);
  const today = indiaDate();
  const totalSeconds = sessions
    .filter((session) => indiaDate(session.endedAt) === today)
    .reduce((sum, session) => sum + session.seconds, 0);
  const todaysTasks = tasks.filter((task) => task.date === today).slice(0, 4);
  const connected = Object.values(counts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const visibleRooms = rooms
    .filter(
      (room) =>
        (category === "All rooms" || room.exam === category) &&
        `${room.name} ${room.exam} ${room.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((first, second) =>
      sort === "active"
        ? (counts[second.id] || 0) - (counts[first.id] || 0)
        : sort === "short"
          ? first.minutes - second.minutes
          : 0,
    );
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            <span className="sun-mark">{t("\u2733")}</span>
            {t(" YOUR EVERYDAY STUDY COMPANION")}
          </div>
          <h1>
            {t(
              profile.language === "hi"
                ? "चलो, साथ पढ़ते हैं।"
                : "Good things take focus.",
            )}
            <span className="heading-leaf">{t("\u2727")}</span>
          </h1>
          <p>
            {t(
              profile.language === "hi"
                ? "बड़े सपने, छोटे कदम। आज की शुरुआत यहीं से।"
                : "Big dreams, small steps. Let’s make today count.",
            )}
          </p>
        </div>
        <button
          className="secondary create-top"
          onClick={() => setCreating(true)}
        >
          <Plus size={17} />
          {t(" Create a room")}
        </button>
      </div>

      <div className="study-layout">
        <div className="study-main">
          <section className="hero-banner">
            {t(
              !profile.lowData && (
                <img
                  src="/library.jpg"
                  alt={t("A warm, quiet library filled with books")}
                  fetchPriority="high"
                />
              ),
            )}
            <div className="hero-shade" />
            <div className="hero-content">
              <span className="hero-pill">
                <span />
                {t(" YOUR SEAT IS WAITING")}
              </span>
              <h2>
                {t("A little focus.")}
                <br />
                {t("A big ")}
                <span>{t("future.")}</span>
              </h2>
              <p>
                {t("Find your people. Open your books.")}
                <br />
                {t("You don\u2019t have to do it alone.")}
              </p>
              <button
                className="hero-button"
                onClick={() =>
                  document
                    .getElementById("room-list")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                {t("Find your study room ")}
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="hero-note">
              <BookOpen size={17} />
              <span>{t("Made for your next chapter.")}</span>
            </div>
          </section>

          <div className="daily-stats">
            <div>
              <span className="stat-icon peach">
                <TimerIcon size={19} />
              </span>
              <span>
                <strong>
                  {t(durationLabel(totalSeconds))}
                  <small>
                    {t(" / ")}
                    {t(
                      profile.dailyGoal >= 60
                        ? `${profile.dailyGoal / 60}h`
                        : `${profile.dailyGoal}m`,
                    )}
                  </small>
                </strong>
                <span>{t("Focus today")}</span>
              </span>
              <svg
                className="mini-ring"
                viewBox="0 0 36 36"
                aria-label={`${Math.min(100, Math.round((totalSeconds / (profile.dailyGoal * 60)) * 100))}% of daily goal`}
              >
                <circle cx="18" cy="18" r="14" />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  strokeDasharray={`${Math.min(1, totalSeconds / (profile.dailyGoal * 60)) * 88} 88`}
                />
              </svg>
            </div>
            <div>
              <span className="stat-icon sage">
                <Target size={19} />
              </span>
              <span>
                <strong>
                  {t(
                    tasks.filter((task) => task.date === today && task.done)
                      .length,
                  )}
                  <small>
                    {t(" / ")}
                    {t(tasks.filter((task) => task.date === today).length)}
                  </small>
                </strong>
                <span>{t("Tasks completed")}</span>
              </span>
              <span className="stat-micro">{t("ONE AT A TIME")}</span>
            </div>
            <div>
              <span className="stat-icon butter">
                <Flame size={19} />
              </span>
              <span>
                <strong>
                  {t(studyStreak(sessions))} <small>{t("days")}</small>
                </strong>
                <span>{t("Study streak")}</span>
              </span>
              <span className="stat-micro flame-emoji">{t("\u2726")}</span>
            </div>
          </div>

          <section className="rooms-section" id="room-list">
            {myRooms.length > 0 && (
              <div className="panel saved-rooms">
                <h2>{t("My invite rooms")}</h2>
                <p className="muted">
                  {t("Your saved rooms travel with your study workspace.")}
                </p>
                {myRooms.map((room) => (
                  <div key={room.id}>
                    <button
                      className="text-button"
                      onClick={() => onJoin(room)}
                    >
                      <LockKeyhole size={15} />
                      <span translate="no">{room.name}</span>
                      <ArrowRight size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${room.name} from my saved rooms`}
                      onClick={() => removeRoom(room.id)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="section-heading">
              <div>
                <h2>
                  {t("Find your focus crew ")}
                  <span className="small-spark">{t("\u2733")}</span>
                </h2>
                <p>{t("Different dreams. The same determination.")}</p>
              </div>
              <span className="live-pill">
                <span />
                {t(connected ? `${connected} studying now` : "Rooms open 24/7")}
              </span>
            </div>
            <div className="room-toolbar">
              <div
                className="category-tabs"
                role="tablist"
                aria-label={t("Exam category")}
              >
                {t(
                  [
                    "All rooms",
                    "GATE",
                    "JEE",
                    "NEET",
                    "UPSC",
                    "School",
                    "College",
                  ].map((value) => (
                    <button
                      role="tab"
                      aria-selected={category === value}
                      key={value}
                      className={category === value ? "active" : ""}
                      onClick={() => setCategory(value)}
                    >
                      {t(value === "All rooms" && <Sparkles size={13} />)}
                      {t(value)}
                    </button>
                  )),
                )}
              </div>
              <label className="room-sort">
                <ArrowDownWideNarrow size={15} />
                <span className="sr-only">{t("Sort rooms")}</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="recommended">{t("Recommended")}</option>
                  <option value="active">{t("Most active")}</option>
                  <option value="short">{t("Short sessions")}</option>
                </select>
              </label>
            </div>
            {t(
              search && (
                <div className="search-summary">
                  <Search size={14} />
                  {t("Results for \u201C")}
                  {t(search)}
                  {t("\u201D")}
                  <button className="text-button" onClick={() => onSearch("")}>
                    <X size={13} />
                    {t(" Clear")}
                  </button>
                </div>
              ),
            )}
            <div className="room-grid">
              {t(
                visibleRooms.map((room) => (
                  <article className="room-card" key={room.id}>
                    <button
                      className={`room-image ${room.color}`}
                      onClick={() => onJoin(room)}
                      aria-label={`Enter ${room.name}`}
                    >
                      {t(
                        !profile.lowData && (
                          <img src={room.image} alt={t("")} loading="lazy" />
                        ),
                      )}
                      <span className={`exam-badge ${room.color}`}>
                        {t(room.exam === "Other" ? "EVERYONE" : room.exam)}
                      </span>
                      <span className="room-image-tag">
                        <Headphones size={11} /> {t(room.tag)}
                      </span>
                      <span className="room-image-arrow">
                        <ArrowRight size={18} />
                      </span>
                    </button>
                    <div className="room-card-body">
                      <div className="room-name-row">
                        <h3>{t(room.name)}</h3>
                        <Heart size={15} aria-hidden="true" />
                      </div>
                      <p>{t(room.description)}</p>
                      <div className="room-card-footer">
                        <span>
                          <Users size={13} />{" "}
                          {t(
                            counts[room.id]
                              ? `${counts[room.id]}/8 in room`
                              : "Take the first seat",
                          )}
                        </span>
                        <span>
                          <TimerIcon size={12} />
                          {t(room.minutes)}
                          {t("/")}
                          {t(room.minutes === 50 ? 10 : 5)}
                        </span>
                        <button
                          onClick={() => onJoin(room)}
                          aria-label={`Join ${room.name}`}
                        >
                          {t("Join room ")}
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  </article>
                )),
              )}
            </div>
            {t(
              !visibleRooms.length && (
                <div className="empty-state">
                  <Search size={30} />
                  <h3>{t("No rooms found")}</h3>
                  <p>
                    {t(
                      "Try another exam or search, or make a space of your own.",
                    )}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => {
                      setCategory("All rooms");
                      onSearch("");
                    }}
                  >
                    {t("Show all rooms")}
                  </button>
                </div>
              ),
            )}
            <div className="create-room-strip">
              <span className="create-strip-icon">
                <Users size={20} />
              </span>
              <div>
                <strong>{t("Your people. Your pace.")}</strong>
                <p>{t("Make a little space for your study group.")}</p>
              </div>
              <button className="text-button" onClick={() => setCreating(true)}>
                {t("Create a room ")}
                <ArrowRight size={15} />
              </button>
            </div>
          </section>
          <div className="bottom-promise">
            <span>
              <ShieldCheck size={14} />
              {t(" All features free. Always.")}
            </span>
            <span>
              {t("Made with a little ")}
              <Heart size={12} />
              {t(" for students in India")}
            </span>
          </div>
        </div>

        <aside className="study-widgets">
          <Timer focus={focus} onExpand={onExpand} />
          <section className="panel daily-tasks">
            <div className="panel-heading">
              <h2>
                <span className="green-dot" />
                {t(" Today\u2019s little wins")}
              </h2>
              <span className="tiny muted">
                {t(today.split("-").reverse().slice(0, 2).join("/"))}
              </span>
            </div>
            {t(
              todaysTasks.length ? (
                <div className="mini-task-list">
                  {t(
                    todaysTasks.map((task) => (
                      <button
                        key={task.id}
                        className={`mini-task ${task.done ? "done" : ""}`}
                        onClick={() => onToggleTask(task.id)}
                      >
                        <span className="checkbox">
                          {t(task.done && <Check size={11} />)}
                        </span>
                        <span>
                          {t(task.title)}
                          <small>
                            {t(task.subject || "A little progress")}
                          </small>
                        </span>
                      </button>
                    )),
                  )}
                </div>
              ) : (
                <div className="task-empty">
                  <span>{t("\u270E")}</span>
                  <p>
                    {t("Clear mind. A fresh page.")}
                    <br />
                    {t("What\u2019s your first little win?")}
                  </p>
                </div>
              ),
            )}
            <button className="add-task-button" onClick={onPlanner}>
              <Plus size={15} />{" "}
              {t(todaysTasks.length ? "Plan your day" : "Add your first task")}
              <ChevronRight size={14} />
            </button>
          </section>
          <SoundMixer audio={audio} />
          <div className="daily-thought">
            <span className="thought-flower">{t("\u273D")}</span>
            <span>{t("A LITTLE REMINDER")}</span>
            <p>
              {t("\u201CYou don\u2019t have to be perfect.")}
              <br />
              {t("Just keep showing up.\u201D")}
            </p>
            <div>{t("One session at a time. You\u2019ve got this.")}</div>
          </div>
        </aside>
      </div>

      {t(
        creating && (
          <Modal
            title={t("A space of your own")}
            onClose={() => setCreating(false)}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const room: StudyRoom = {
                  id: `room-${crypto.randomUUID()}`,
                  name: roomName.trim(),
                  description: "A little space to focus, together.",
                  exam: profile.exam,
                  image: "/library.jpg",
                  minutes: roomMinutes,
                  tag: "Invite only",
                  color: "orange",
                  private: true,
                };
                setCreating(false);
                onJoin(room);
              }}
            >
              <p className="muted">
                {t("Up to 8 students. Camera and microphone off by default.")}
              </p>
              <label className="field">
                {t("Room name")}
                <input
                  autoFocus
                  required
                  maxLength={60}
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder={t("e.g. Our 6 AM study club")}
                />
              </label>
              <label className="field">
                {t("Shared focus session")}
                <select
                  value={roomMinutes}
                  onChange={(event) =>
                    setRoomMinutes(Number(event.target.value))
                  }
                >
                  <option value={25}>
                    {t("25 minutes \u00B7 A little sprint")}
                  </option>
                  <option value={50}>
                    {t("50 minutes \u00B7 Deep focus")}
                  </option>
                  <option value={90}>
                    {t("90 minutes \u00B7 In the zone")}
                  </option>
                </select>
              </label>
              <p className="language-notice">
                {t(
                  "Invite room: anyone with your link can join. Share it only with your group. The room is saved to your study workspace.",
                )}
              </p>
              <button className="primary full-width" type="submit">
                {t("Create & enter room ")}
                <ArrowRight size={16} />
              </button>
            </form>
          </Modal>
        ),
      )}
    </>
  );
}
