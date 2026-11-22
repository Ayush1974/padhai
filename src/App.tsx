import { Onboarding } from "./components/Onboarding";
import { t } from "./i18n";
import { LanguagePicker } from "./components/LanguagePicker";
import { loadLanguage } from "./i18n";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  Download,
  Flame,
  Globe2,
  Heart,
  LayoutGrid,
  Leaf,
  Menu,
  Moon,
  NotebookPen,
  Pause,
  Play,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer as TimerIcon,
  TrendingUp,
  WifiOff,
  X,
} from "lucide-react";
import { defaultProfile, quotes, rooms } from "./data";
import { useStoredState } from "./lib/storage";
import {
  clock,
  createTimer,
  indiaDate,
  studyStreak,
  validateBackup,
  type Backup,
} from "./lib/study";
import { useTimer } from "./hooks/useTimer";
import { useAmbient } from "./hooks/useAmbient";
import { useLobby } from "./hooks/useLobby";
import type {
  CalendarEvent,
  ExamPlan as Plan,
  Habit,
  Journal,
  Note,
  Page,
  Profile,
  Session,
  StudyRoom,
  Subject,
  Task,
} from "./types";
import { StudyRooms } from "./pages/StudyRooms";
const Planner = lazy(() =>
  import("./pages/Planner").then((module) => ({ default: module.Planner })),
);
const Progress = lazy(() =>
  import("./pages/Progress").then((module) => ({ default: module.Progress })),
);
const Resources = lazy(() =>
  import("./pages/Resources").then((module) => ({ default: module.Resources })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((module) => ({ default: module.Settings })),
);
const RoomView = lazy(() =>
  import("./components/RoomView").then((module) => ({
    default: module.RoomView,
  })),
);
import { Modal } from "./components/Modal";
import { SoundMixer } from "./components/SoundMixer";
import { useCloud } from "./hooks/useCloud";
import { makePlan } from "./lib/plans";
const ExamPlan = lazy(() =>
  import("./pages/ExamPlan").then((module) => ({ default: module.ExamPlan })),
);
const Calendar = lazy(() =>
  import("./pages/Calendar").then((module) => ({ default: module.Calendar })),
);
const Habits = lazy(() =>
  import("./pages/Habits").then((module) => ({ default: module.Habits })),
);
const Wisdom = lazy(() =>
  import("./pages/Wisdom").then((module) => ({ default: module.Wisdom })),
);
import { CloudPanel } from "./components/CloudPanel";
import { InterfaceTranslation } from "./components/InterfaceTranslation";
import type { AccountUser } from "./lib/account";
import { AccountAccess, AccountSummary } from "./components/AccountAccess";
import { AIHelper } from "./components/AIHelper";
import { AISettings } from "./components/AISettings";
import { setAIWorkspaceReady } from "./lib/ai";
import type { AISettings as PersonalAISettings, Notebook } from "./types";
const NotebookNotes = lazy(() =>
  import("./pages/NotebookNotes").then((module) => ({
    default: module.NotebookNotes,
  })),
);
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: string;
  }>;
}
function readPage(): Page {
  const value = new URL(location.href).searchParams.get("page");
  return [
    "rooms",
    "exam",
    "calendar",
    "progress",
    "planner",
    "notes",
    "habits",
    "wisdom",
    "resources",
    "settings",
  ].includes(value || "")
    ? (value as Page)
    : "rooms";
}
function readRoomLink(): StudyRoom | null {
  if (!location.hash.startsWith("#room=")) return null;
  try {
    if (location.hash.length > 2000) return null;
    const data = JSON.parse(decodeURIComponent(location.hash.slice(6)));
    const publicRoom = rooms.find((room) => room.id === data.id);
    if (publicRoom) return publicRoom;
    if (
      !data ||
      typeof data.id !== "string" ||
      !/^room-[a-f0-9-]{36}$/.test(data.id) ||
      typeof data.name !== "string" ||
      !data.name.trim() ||
      data.name.length > 60 ||
      !["JEE", "NEET", "UPSC", "GATE", "School", "College", "Other"].includes(
        data.exam,
      ) ||
      ![25, 50, 90].includes(data.minutes)
    )
      return null;
    return {
      id: data.id,
      name: data.name.trim(),
      description: "A little space to focus, together.",
      exam: data.exam,
      image: "/library.jpg",
      minutes: data.minutes,
      tag: "Invite room",
      color: "orange",
      private: true,
    };
  } catch {
    return null;
  }
}
export default function App() {
  const [profile, setProfile] = useStoredState<Profile>(
    "profile",
    defaultProfile,
  );
  const [tasks, setTasks] = useStoredState<Task[]>("tasks", []);
  const [notes, setNotes] = useStoredState<Note[]>("notes", []);
  const [notebooks, setNotebooks] = useStoredState<Notebook[]>("notebooks", []);
  const [aiSettings, setAISettings] = useStoredState<PersonalAISettings>(
    "ai-settings",
    {},
  );
  const [myRooms, setMyRooms] = useStoredState<StudyRoom[]>("my-rooms", []);
  const [sessions, setSessions] = useStoredState<Session[]>("sessions", []);
  const [plan, setPlan] = useStoredState<Plan>("exam-plan", makePlan);
  const [habits, setHabits] = useStoredState<Habit[]>("habits", []);
  const [events, setEvents] = useStoredState<CalendarEvent[]>("events", []);
  const [journal, setJournal] = useStoredState<Journal>("journal", {
    identity: "",
    entries: {},
  });
  const [theme, setTheme] = useStoredState<"light" | "dark">("theme", "light");
  const [page, setPage] = useState<Page>(readPage);
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(readRoomLink);
  const [confirmedNameFor, setConfirmedNameFor] = useState(
    () => localStorage.getItem("padhai-name-confirmed"),
  );
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const needsName = !!accountUser && confirmedNameFor !== accountUser.id;
  const [authOpen, setAuthOpen] = useState(true);
  const [aiOpen, setAIOpen] = useState(false);
  const [aiPrompt, setAIPrompt] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [installOpen, setInstallOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const installPrompt = useRef<InstallPrompt | null>(null);
  const notify = useCallback((message: string) => {
    clearTimeout(toastTimeout.current);
    setToast(message);
    toastTimeout.current = setTimeout(() => setToast(""), 6500);
  }, []);
  const addSession = useCallback(
    (session: Session) => {
      setSessions((current) =>
        current.some((item) => item.id === session.id)
          ? current.map((item) =>
              item.id === session.id && item.seconds < session.seconds
                ? session
                : item,
            )
          : [...current, session],
      );
    },
    [setSessions],
  );
  const focus = useTimer(addSession, notify, plan.subjects);
  const audio = useAmbient(notify);
  const counts = useLobby(accountUser && !needsName ? activeRoom : null);
  const backup: Backup = useMemo(
    () => ({
      version: 1,
      profile,
      tasks,
      notes,
      notebooks,
      aiSettings,
      myRooms,
      sessions,
      plan,
      habits,
      events,
      journal,
      timer: focus.timer,
    }),
    [
      profile,
      tasks,
      notes,
      notebooks,
      aiSettings,
      myRooms,
      sessions,
      plan,
      habits,
      events,
      journal,
      focus.timer,
    ],
  );
  function applyBackup(value: unknown) {
    const data = validateBackup(value);
    const presetByExam: Record<string, string> = {
      GATE: "GATE CS",
      JEE: "JEE Main / Advanced",
      NEET: "NEET UG",
      UPSC: "UPSC CSE",
      School: "School / College",
      College: "School / College",
    };
    const restoredPlan =
      data.plan || makePlan(presetByExam[data.profile.exam] || "Custom exam");
    if (!data.plan) restoredPlan.targets.daily = data.profile.dailyGoal;
    setProfile({ ...data.profile, dailyGoal: restoredPlan.targets.daily });
    setTasks(data.tasks);
    setNotes(data.notes);
    setSessions(data.sessions);
    setPlan(restoredPlan);
    setHabits(data.habits || []);
    setEvents(data.events || []);
    setJournal(data.journal || { identity: "", entries: {} });
    focus.restoreTimer(data.timer || createTimer());
    setNotebooks(data.notebooks || []);
    setAISettings(data.aiSettings || {});
    setMyRooms(data.myRooms || []);
  }
  const cloud = useCloud(backup, applyBackup, !!accountUser);
  useEffect(() => {
    if (cloud.ready && accountUser && !needsName && activeRoom?.private)
      setMyRooms((current) =>
        current.some((room) => room.id === activeRoom.id)
          ? current
          : [...current, activeRoom].slice(-100),
      );
  }, [cloud.ready, accountUser?.id, needsName, activeRoom?.id]);

  useLayoutEffect(() => {
    setAIWorkspaceReady(cloud.ready && !cloud.conflict);
    return () => setAIWorkspaceReady(false);
  }, [cloud.ready, cloud.conflict]);
  useEffect(() => {
    const needsKey = (event: Event) =>
      setKeyMessage(
        (event as CustomEvent<string>).detail ||
          "Please update your Gemini key to continue using AI.",
      );
    window.addEventListener("ai-key-needed", needsKey);
    return () => window.removeEventListener("ai-key-needed", needsKey);
  }, []);
  const [localeVersion, setLocaleVersion] = useState(0);
  useEffect(() => {
    void loadLanguage(profile.language).then(() =>
      setLocaleVersion((value) => value + 1),
    );
  }, [profile.language]);
  useEffect(() => {
    const refresh = () => setLocaleVersion((value) => value + 1);
    window.addEventListener("padhai-language-updated", refresh);
    return () => window.removeEventListener("padhai-language-updated", refresh);
  }, []);
  const hindi = profile.language === "hi";
  const nav = [
    {
      id: "rooms" as const,
      label: hindi ? "स्टडी रूम" : "Study rooms",
      icon: LayoutGrid,
    },
    { id: "exam" as const, label: "My exam plan", icon: BookOpenCheck },
    { id: "calendar" as const, label: "Study calendar", icon: CalendarDays },
    {
      id: "progress" as const,
      label: hindi ? "मेरी प्रगति" : "My progress",
      icon: TrendingUp,
    },
    {
      id: "planner" as const,
      label: hindi ? "मेरा प्लान" : "My planner",
      icon: CalendarCheck2,
    },
    {
      id: "notes" as const,
      label: hindi ? "मेरे नोट्स" : "My notes",
      icon: NotebookPen,
    },
    { id: "habits" as const, label: "Daily foundations", icon: Leaf },
    { id: "wisdom" as const, label: "A little wisdom", icon: Sparkles },
    {
      id: "resources" as const,
      label: hindi ? "मुफ़्त संसाधन" : "Free resources",
      icon: Globe2,
    },
  ];
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0c1020" : "#f5f5fc");
  }, [theme]);
  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine);
    const accountExpired = () => {
      setAccountUser(null);
      setAuthOpen(true);
    };
    const otherWorkspace = (event: StorageEvent) => {
      if (event.key === "padhai-study-key") location.reload();
    };
    window.addEventListener("account-sign-in-needed", accountExpired);
    window.addEventListener("storage", otherWorkspace);
    const storageError = () =>
      notify(
        "Your browser could not save changes. Export a backup in Settings to keep your work safe.",
      );
    const hashChanged = () => {
      setActiveRoom(readRoomLink());
      setPage(readPage());
    };
    const captureInstall = (event: Event) => {
      event.preventDefault();
      installPrompt.current = event as InstallPrompt;
    };
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    window.addEventListener("storage-error", storageError);
    window.addEventListener("hashchange", hashChanged);
    window.addEventListener("popstate", hashChanged);
    window.addEventListener("beforeinstallprompt", captureInstall);
    return () => {
      window.removeEventListener("account-sign-in-needed", accountExpired);
      window.removeEventListener("storage", otherWorkspace);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.removeEventListener("storage-error", storageError);
      window.removeEventListener("hashchange", hashChanged);
      window.removeEventListener("popstate", hashChanged);
      window.removeEventListener("beforeinstallprompt", captureInstall);
      clearTimeout(toastTimeout.current);
    };
  }, [notify]);
  function navigate(next: Page) {
    setPage(next);
    const url = new URL(location.href);
    if (next === "rooms") url.searchParams.delete("page");
    else url.searchParams.set("page", next);
    history.pushState(null, "", url);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function joinRoom(room: StudyRoom) {
    setActiveRoom(room);
    setPage("rooms");
    history.pushState(
      null,
      "",
      `${location.pathname}#room=${encodeURIComponent(JSON.stringify({ id: room.id, name: room.name, exam: room.exam, minutes: room.minutes }))}`,
    );
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function leaveRoom() {
    setActiveRoom(null);
    history.pushState(null, "", location.pathname + location.search);
  }
  async function install() {
    if (matchMedia("(display-mode: standalone)").matches) {
      notify("You’re already using Padhai as an app. Make yourself at home.");
      return;
    }
    if (installPrompt.current) {
      await installPrompt.current.prompt();
      await installPrompt.current.userChoice;
      installPrompt.current = null;
    } else setInstallOpen(true);
  }
  function importBackup(data: Backup) {
    applyBackup(data);
    notify("Your backup is restored and will sync to your cloud workspace.");
  }
  function focusTask(task: Task) {
    focus.changeMode(
      "focus",
      focus.timer.mode === "focus" ? focus.timer.duration / 60 : 25,
      task.subject || task.title.slice(0, 60),
    );
    setExpanded(true);
  }
  function startSubject(subject: Subject) {
    focus.changeMode("focus", 25, subject.name, subject.id);
    setExpanded(true);
  }
  function quickStart() {
    focus.reset();
    const state = createTimer(2, "focus", focus.timer.subject);
    const now = Date.now();
    focus.restoreTimer({
      ...state,
      subjectId: focus.timer.subjectId,
      endAt: now + 120000,
      runStartedAt: now,
    });
    setExpanded(true);
  }
  function updatePlan(value: Plan | ((previous: Plan) => Plan)) {
    const next = typeof value === "function" ? value(plan) : value;
    setPlan(next);
    if (next.targets.daily !== profile.dailyGoal)
      setProfile((current) => ({ ...current, dailyGoal: next.targets.daily }));
  }
  function updateProfile(value: Profile | ((previous: Profile) => Profile)) {
    const next = typeof value === "function" ? value(profile) : value;
    setProfile(next);
    if (next.dailyGoal !== plan.targets.daily)
      setPlan((current) => ({
        ...current,
        targets: { ...current.targets, daily: next.dailyGoal },
      }));
  }
  const today = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    weekday: "short",
    timeZone: "Asia/Kolkata",
  }).format(Date.now());
  return (
    <div className="app-shell">
      {accountUser && (
        <>
          <a className="skip-link" href="#main-content">
            {t("Skip to study space")}
          </a>
          {t(
            sidebarOpen && (
              <button
                className="sidebar-scrim"
                aria-label={t("Close navigation")}
                onClick={() => setSidebarOpen(false)}
              />
            ),
          )}
          <aside
            className={`sidebar ${sidebarOpen ? "open" : ""}`}
            aria-label={t("Main navigation")}
          >
            <button
              className="brand new-brand"
              onClick={() => navigate("rooms")}
              aria-label="Padhai home"
            >
              <img
                src="/padhai-logo.webp"
                alt="Padhai"
                width="200"
                height="134"
              />
              <span className="sr-only">Padhai home</span>
            </button>
            <button
              className="sidebar-close icon-button"
              onClick={() => setSidebarOpen(false)}
              aria-label={t("Close navigation")}
            >
              <X size={20} />
            </button>
            <div className="sidebar-label">{t("YOUR STUDY CORNER")}</div>
            <nav>
              {t(
                nav.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    className={`nav-item ${page === id ? "active" : ""}`}
                    aria-current={page === id ? "page" : undefined}
                    onClick={() => navigate(id)}
                  >
                    <Icon size={19} strokeWidth={1.7} />
                    <span>{t(label)}</span>
                    {t(id === "rooms" && <span className="nav-active-dot" />)}
                  </button>
                )),
              )}
            </nav>
            <div className="sidebar-divider" />
            <div className="sidebar-label">{t("A LITTLE EXTRA")}</div>
            <button className="nav-item" onClick={() => setExpanded(true)}>
              <TimerIcon size={19} strokeWidth={1.7} />
              <span>{t(hindi ? "फ़ोकस मोड" : "Focus mode")}</span>
              <span className="new-tag">{t("ZEN")}</span>
            </button>
            <button className="nav-item" onClick={() => void install()}>
              <Download size={19} strokeWidth={1.7} />
              <span>{t(hindi ? "ऐप इंस्टॉल करें" : "Get the app")}</span>
            </button>
            <div className="sidebar-bottom">
              <div className="sidebar-encouragement">
                <div>
                  <span>{t("\u273D")}</span>
                  <Sparkles size={15} />
                </div>
                <strong>
                  {t("Big dreams.")}
                  <br />
                  {t("Little steps.")}
                </strong>
                <p>
                  {t("Everything you need.")}
                  <br />
                  {t("Always free, for everyone.")}
                </p>
                <span className="free-label">
                  <Heart size={12} />
                  {t(" NO PREMIUM. JUST PROGRESS.")}
                </span>
              </div>
              <button
                className={`nav-item ${page === "settings" ? "active" : ""}`}
                onClick={() => navigate("settings")}
              >
                <Settings2 size={18} />
                <span>{t(hindi ? "सेटिंग्स" : "Settings")}</span>
              </button>
              <button
                className="sidebar-profile"
                onClick={() => navigate("settings")}
              >
                <span className="profile-avatar">
                  {t(profile.name.slice(0, 1).toUpperCase())}
                </span>
                <span>
                  <strong>{t(profile.name)}</strong>
                  <small>
                    {t(
                      profile.exam === "Other"
                        ? "Building my future"
                        : `${profile.exam} aspirant`,
                    )}
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            </div>
          </aside>

          <div className="main-shell">
            <header className="topbar">
              <div className="topbar-left">
                <button
                  className="mobile-menu icon-button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label={t("Open navigation")}
                >
                  <Menu size={22} />
                </button>
                <span className="breadcrumb">
                  {t("Your study space ")}
                  <ChevronRight size={13} />
                  <strong>
                    {t(
                      activeRoom && page === "rooms"
                        ? "In a room"
                        : nav.find((item) => item.id === page)?.label ||
                            "Settings",
                    )}
                  </strong>
                </span>
              </div>
              <div className="topbar-right">
                <button
                  className="topbar-cloud"
                  onClick={() => navigate("settings")}
                  title={cloud.status}
                >
                  <Cloud size={13} />
                  <span>{t(cloud.status)}</span>
                </button>
                <LanguagePicker
                  language={profile.language}
                  onChange={(language) =>
                    setProfile((current) => ({ ...current, language }))
                  }
                />
                <span className="today-date">
                  {t(today)}
                  <span>{t("IST")}</span>
                </span>
                <span className="topbar-divider" />
                <button
                  className="theme-toggle icon-button"
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                  aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                >
                  {t(
                    theme === "light" ? <Moon size={18} /> : <Sun size={19} />,
                  )}
                </button>
                <button
                  className="icon-button help-button"
                  onClick={() => setHelpOpen(true)}
                  aria-label={t("Help and privacy")}
                >
                  <CircleHelp size={19} />
                </button>
                <button
                  className="topbar-avatar profile-avatar"
                  onClick={() => navigate("settings")}
                  aria-label={t("Open your profile")}
                >
                  {t(profile.name.slice(0, 1).toUpperCase())}
                </button>
              </div>
            </header>
            {t(
              !online && (
                <div className="offline-banner">
                  <WifiOff size={15} />
                  {t(
                    " You\u2019re offline. Your timer, planner, and notes still work. Rooms reconnect when you\u2019re back.",
                  )}
                </div>
              ),
            )}
            {t(
              activeRoom && page !== "rooms" && (
                <button
                  className="in-room-banner"
                  onClick={() => navigate("rooms")}
                >
                  <span className="pulse-dot" />
                  {t(" You\u2019re in ")}
                  {t(activeRoom.name)}
                  <span>
                    {t("Back to your room ")}
                    <ArrowRight size={14} />
                  </span>
                </button>
              ),
            )}
            {cloud.loading && (
              <div className="cloud-loading-banner" role="status">
                {t("Opening your saved study space…")}
              </div>
            )}
            <main
              id="main-content"
              className="main-content"
              inert={cloud.loading}
              aria-busy={cloud.loading}
            >
              <InterfaceTranslation
                language={profile.language}
                ready={cloud.ready && !cloud.conflict}
                notify={notify}
              />
              {page !== "rooms" && (
                <button
                  className="module-back"
                  onClick={() => navigate("rooms")}
                >
                  <ArrowLeft size={16} />
                  Back to study rooms
                </button>
              )}
              <Suspense
                fallback={
                  <p role="status" className="module-loading">
                    {t("Opening this part of your study space…")}
                  </p>
                }
              >
                {t(
                  page === "rooms" && !activeRoom && (
                    <>
                      <div className="dashboard-tools">
                        <span className="welcome-line">
                          <span />
                          {t(" A fresh page. A little possibility.")}
                        </span>
                        <label className="global-search">
                          <Search size={16} />
                          <input
                            aria-label={t("Search study rooms")}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t("Find your kind of room\u2026")}
                          />
                          <kbd>{t("\u2315")}</kbd>
                        </label>
                      </div>
                      <StudyRooms
                        myRooms={myRooms}
                        removeRoom={(id) =>
                          setMyRooms((current) =>
                            current.filter((room) => room.id !== id),
                          )
                        }
                        profile={profile}
                        sessions={sessions}
                        tasks={tasks}
                        counts={counts}
                        focus={focus}
                        audio={audio}
                        onJoin={joinRoom}
                        onExpand={() => setExpanded(true)}
                        onPlanner={() => navigate("planner")}
                        onToggleTask={(id) =>
                          setTasks((current) =>
                            current.map((task) =>
                              task.id === id
                                ? { ...task, done: !task.done }
                                : task,
                            ),
                          )
                        }
                        search={search}
                        onSearch={setSearch}
                      />
                    </>
                  ),
                )}
                {t(
                  activeRoom && !needsName && (
                    <div hidden={page !== "rooms"}>
                      <RoomView
                        key={activeRoom.id}
                        room={activeRoom}
                        profile={profile}
                        focus={focus}
                        audio={audio}
                        onLeave={leaveRoom}
                        onExpand={() => setExpanded(true)}
                        notify={notify}
                      />
                    </div>
                  ),
                )}
                {t(
                  page === "planner" && (
                    <Planner
                      tasks={tasks}
                      setTasks={setTasks}
                      focusTask={focusTask}
                    />
                  ),
                )}
                {t(
                  page === "exam" && (
                    <ExamPlan
                      plan={plan}
                      setPlan={updatePlan}
                      sessions={sessions}
                      setSessions={setSessions}
                      startSubject={startSubject}
                      notify={notify}
                      language={profile.language}
                      archiveSource={(source) =>
                        setNotes((current) => [
                          {
                            id: crypto.randomUUID(),
                            title: `Saved syllabus · ${source.title}`.slice(
                              0,
                              100,
                            ),
                            body: source.text.slice(0, 100000),
                            updatedAt: Date.now(),
                            notebookId: "inbox",
                            attachments: source.attachment
                              ? [source.attachment]
                              : [],
                          },
                          ...current,
                        ])
                      }
                    />
                  ),
                )}
                {t(
                  page === "calendar" && (
                    <Calendar
                      events={events}
                      setEvents={setEvents}
                      sessions={sessions}
                      subjects={plan.subjects}
                      tasks={tasks}
                      onStart={(event) => {
                        const subject = plan.subjects.find(
                          (item) => item.id === event.subjectId,
                        );
                        focus.changeMode(
                          "focus",
                          event.minutes,
                          subject?.name || event.title.slice(0, 60),
                          subject?.id,
                        );
                        setExpanded(true);
                      }}
                    />
                  ),
                )}
                {t(
                  page === "habits" && (
                    <Habits
                      habits={habits}
                      setHabits={setHabits}
                      journal={journal}
                      setJournal={setJournal}
                      sessions={sessions}
                      dailyTarget={plan.targets.daily}
                      onStart={quickStart}
                      notify={notify}
                    />
                  ),
                )}
                {t(
                  page === "wisdom" && (
                    <Wisdom
                      language={profile.language}
                      settings={aiSettings}
                      aiReady={cloud.ready && !cloud.conflict}
                      onAct={quickStart}
                    />
                  ),
                )}
                {t(
                  page === "progress" && (
                    <Progress
                      sessions={sessions}
                      tasks={tasks}
                      profile={profile}
                      onSettings={() => navigate("settings")}
                    />
                  ),
                )}
                {t(
                  page === "notes" && (
                    <NotebookNotes
                      notes={notes}
                      setNotes={setNotes}
                      notebooks={notebooks}
                      setNotebooks={setNotebooks}
                      notify={notify}
                      onSave={cloud.saveNow}
                      saveStatus={cloud.status}
                      onAI={(text) => {
                        setAIPrompt(text);
                        setAIOpen(true);
                      }}
                    />
                  ),
                )}
                {t(page === "resources" && <Resources />)}
                {t(
                  page === "settings" && (
                    <>
                      <Settings
                        profile={profile}
                        setProfile={updateProfile}
                        backup={backup}
                        onImport={importBackup}
                        notify={notify}
                        onInstall={() => void install()}
                      />
                      <div className="cloud-settings-wrap">
                        <AccountSummary
                          user={accountUser}
                          canSignOut={
                            cloud.ready &&
                            !cloud.conflict &&
                            cloud.status === "Saved to cloud"
                          }
                          notify={notify}
                        />
                        <AISettings
                          settings={aiSettings}
                          onChange={setAISettings}
                          notify={notify}
                        />
                        <CloudPanel
                          status={cloud.status}
                          conflict={cloud.conflict}
                          resolveConflict={cloud.resolveConflict}
                          notify={notify}
                        />
                      </div>
                    </>
                  ),
                )}
              </Suspense>
              <div className="module-ai-bar">
                <Sparkles size={19} />
                <div>
                  <strong>{t("A little help for your next step")}</strong>
                  <span>
                    {t(
                      "Explain, plan, reflect, or turn a big goal into small actions.",
                    )}
                  </span>
                </div>
                <button
                  className="primary"
                  disabled={!cloud.ready || cloud.conflict}
                  onClick={() => {
                    setAIPrompt("");
                    setAIOpen(true);
                  }}
                >
                  {t("Ask AI")}
                  <ArrowRight size={16} />
                </button>
              </div>
            </main>
            <footer className="creator-credit">
              Built with ❤️ by <strong>Ayush Mishra</strong>
              <a href="https://github.com/Ayush1974/padhai">Open-source code · MIT</a>
            </footer>
            {t(
              page !== "rooms" && (
                <footer className="app-footer">
                  <span>
                    {t("padhai. ")}
                    <Heart size={11} />
                    {t(" A little every day.")}
                  </span>
                  <button onClick={() => setHelpOpen(true)}>
                    {t("Help & privacy")}
                  </button>
                </footer>
              ),
            )}
            {t(
              focus.timer.endAt && (page !== "rooms" || !expanded) && (
                <button
                  className="floating-timer"
                  onClick={() => setExpanded(true)}
                  aria-label={`Open running timer, ${clock(focus.remaining)} remaining`}
                >
                  <span className="pulse-dot" />
                  <TimerIcon size={16} />
                  <strong>{t(clock(focus.remaining))}</strong>
                  <span>{t("Keep going")}</span>
                  <ArrowRight size={14} />
                </button>
              ),
            )}
            <nav
              className="mobile-bottom-nav"
              aria-label={t("Quick navigation")}
            >
              <button
                className={page === "rooms" ? "active" : ""}
                onClick={() => navigate("rooms")}
              >
                <LayoutGrid size={20} />
                <span>{t("Rooms")}</span>
              </button>
              <button
                className={page === "planner" ? "active" : ""}
                onClick={() => navigate("planner")}
              >
                <CalendarCheck2 size={20} />
                <span>{t("Planner")}</span>
              </button>
              <button
                className="mobile-focus-button"
                onClick={() => setExpanded(true)}
              >
                <span>
                  <TimerIcon size={23} />
                </span>
                <small>{t("Focus")}</small>
              </button>
              <button
                className={page === "notes" ? "active" : ""}
                onClick={() => navigate("notes")}
              >
                <NotebookPen size={20} />
                <span>{t("Notes")}</span>
              </button>
              <button
                className={page === "progress" ? "active" : ""}
                onClick={() => navigate("progress")}
              >
                <TrendingUp size={20} />
                <span>{t("Progress")}</span>
              </button>
            </nav>
          </div>

          {t(
            toast && (
              <div className="toast" role="status">
                <span className="toast-check">
                  <Check size={17} />
                </span>
                <p>{t(toast)}</p>
                <button
                  className="icon-button"
                  onClick={() => setToast("")}
                  aria-label={t("Dismiss notification")}
                >
                  <X size={16} />
                </button>
              </div>
            ),
          )}
          {t(
            expanded && (
              <Modal
                title={t("A little space. Just for you.")}
                onClose={() => setExpanded(false)}
                wide
              >
                <div className="zen-space">
                  <span className="zen-flower">{t("\u273D")}</span>
                  <span className="eyebrow">
                    {t(
                      focus.timer.mode === "focus"
                        ? "BREATHE IN. SHOW UP. BEGIN."
                        : "REST IS PART OF THE PROCESS.",
                    )}
                  </span>
                  <h2>{t(focus.timer.subject || "One thing at a time.")}</h2>
                  <div className="zen-digits" role="timer">
                    {t(clock(focus.remaining))}
                  </div>
                  <div className="zen-controls">
                    <button
                      className="icon-button bordered"
                      onClick={focus.reset}
                      aria-label={t("Reset timer and save focus")}
                    >
                      <RotateCcw size={20} />
                    </button>
                    <button className="primary" onClick={focus.toggle}>
                      {t(
                        focus.timer.endAt ? (
                          <Pause size={19} />
                        ) : (
                          <Play size={19} />
                        ),
                      )}
                      {t(focus.timer.endAt ? "Pause" : "Start focusing")}
                    </button>
                  </div>
                  <p>{t(quotes[new Date().getDate() % quotes.length])}</p>
                  <SoundMixer audio={audio} />
                  <button
                    className="text-button"
                    onClick={() => setExpanded(false)}
                  >
                    <ArrowLeft size={14} />
                    {t(" Back to your study space")}
                  </button>
                </div>
              </Modal>
            ),
          )}
          {t(
            helpOpen && (
              <Modal
                title={t("A good place to begin.")}
                onClose={() => setHelpOpen(false)}
              >
                <div className="help-content">
                  <p>
                    {t(
                      "Padhai is a free study companion made for students. No subscriptions or payment details. Register with a verified email, then sign in to open your study space.",
                    )}
                  </p>
                  <h3>
                    <TimerIcon size={17} />
                    {t(" Make time for focus")}
                  </h3>
                  <p>
                    {t(
                      "Choose a focus session, add what you\u2019re studying, and press Start. Your time is saved at the end, or when you reset or change modes. A paused timer keeps your progress.",
                    )}
                  </p>
                  <h3>
                    <BookOpenText size={17} />
                    {t(" Study together")}
                  </h3>
                  <p>
                    {t(
                      "Join an exam room or create an invite room for up to 8 students. Use the room clock, chat, optional camera, microphone, or screen sharing. Keep your invite link with people you trust.",
                    )}
                  </p>
                  <h3>
                    <ShieldCheck size={17} />
                    {t(" Your space, your data")}
                  </h3>
                  <p>
                    {t(
                      "Your workspace saves in this browser and syncs to encrypted cloud storage. Keep your private study key in Settings to restore it on another device. Files are encrypted before upload. AI receives only content you explicitly choose to send.",
                    )}
                  </p>
                  <p>
                    {t(
                      "Room names, intentions, and recent chat sync through our server so members on different networks can meet. Chat is retained for up to 24 hours or 100 messages. Camera and audio use encrypted WebRTC and public discovery relays; peers may learn your network address. Strict networks may prevent direct calls.",
                    )}
                  </p>
                  <p>
                    {t(
                      "We don\u2019t record calls. Other participants control their own devices, so share only what you\u2019re comfortable showing.",
                    )}
                  </p>
                  <h3>
                    <Heart size={17} />
                    {t(" A little kindness goes a long way")}
                  </h3>
                  <p>
                    {t(
                      "Keep chat respectful and avoid personal details. Use the flag on a student\u2019s tile to hide and mute them for your visit. Shared room timers can be controlled by any member.",
                    )}
                  </p>
                  <p className="tiny muted">
                    {t(
                      "All dates and progress use Indian Standard Time. Your target exam date is set by you; verify official dates with the exam authority.",
                    )}
                  </p>
                </div>
              </Modal>
            ),
          )}
          {t(
            installOpen && (
              <Modal
                title={t("Make a little space on your home screen.")}
                onClose={() => setInstallOpen(false)}
              >
                <div className="install-help">
                  <span className="brand-mark">
                    <BookOpenText size={30} />
                  </span>
                  <h3>{t("Take Padhai with you.")}</h3>
                  <p>
                    <strong>{t("Android / Chrome / Edge:")}</strong>
                    {t(
                      " Open the browser menu and choose \u201CInstall app\u201D or \u201CAdd to Home screen\u201D.",
                    )}
                  </p>
                  <p>
                    <strong>{t("iPhone / iPad:")}</strong>
                    {t(
                      " Open Padhai in Safari, tap Share, then \u201CAdd to Home Screen\u201D.",
                    )}
                  </p>
                  <p>
                    <strong>{t("Desktop:")}</strong>
                    {t(
                      " Use the install icon in your browser\u2019s address bar or the browser menu.",
                    )}
                  </p>
                  <p className="muted">
                    {t(
                      "While your signed-in app stays open, personal study tools keep working during a connection drop. Opening a new session requires internet access.",
                    )}
                  </p>
                  <button
                    className="primary full-width"
                    onClick={() => setInstallOpen(false)}
                  >
                    {t("Got it ")}
                    <Check size={16} />
                  </button>
                </div>
              </Modal>
            ),
          )}
          {aiOpen && (
            <AIHelper
              page={page}
              plan={plan}
              sessions={sessions}
              language={profile.language}
              initialPrompt={aiPrompt}
              onClose={() => setAIOpen(false)}
              addTasks={(items) => {
                setTasks((current) => [...current, ...items]);
                notify("Suggested tasks added to your planner.");
              }}
              addEvents={(items) => {
                setEvents((current) => [...current, ...items]);
                notify("Suggested sessions added to your calendar.");
              }}
              saveNote={(note) => {
                setNotes((current) => [note, ...current]);
                notify("AI answer saved to your notes.");
              }}
            />
          )}
          {keyMessage && (
            <Modal
              title={t("Continue with your Gemini key")}
              onClose={() => setKeyMessage("")}
            >
              <AISettings
                settings={aiSettings}
                onChange={(value) => {
                  setAISettings(value);
                  setKeyMessage("");
                }}
                message={keyMessage}
                notify={notify}
              />
            </Modal>
          )}
          {needsName && !authOpen && !cloud.loading && (
            <Onboarding
              name={profile.name}
              examName={plan.examName}
              onContinue={(name, exam) => {
                const examGroup = exam.startsWith("GATE")
                  ? "GATE"
                  : exam.startsWith("JEE")
                    ? "JEE"
                    : exam.startsWith("NEET")
                      ? "NEET"
                      : exam.startsWith("UPSC")
                        ? "UPSC"
                        : "Other";
                updateProfile({ ...profile, name, exam: examGroup });
                if (
                  exam !== plan.examName &&
                  plan.subjects.every((subject) => subject.topics.length === 0)
                )
                  updatePlan({ ...makePlan(exam), targets: plan.targets });
                else if (exam !== plan.examName)
                  setPlan((current) => ({ ...current, examName: exam }));
                if (accountUser) {
                  localStorage.setItem("padhai-name-confirmed", accountUser.id);
                  setConfirmedNameFor(accountUser.id);
                }
              }}
            />
          )}
        </>
      )}
      <AccountAccess
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
        }}
        onUser={(user) => {
          setAccountUser(user);
          if (user)
            setProfile((current) =>
              current.name === "Student"
                ? { ...current, name: user.name }
                : current,
            );
        }}
        defaultCourse={plan.examName}
        defaultName={profile.name}
        notify={notify}
      />
    </div>
  );
}
