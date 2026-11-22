import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Flag,
  LockKeyhole,
  MessageCircle,
  Mic,
  MicOff,
  MonitorUp,
  Pause,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Target,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { FocusTimer } from "../hooks/useTimer";
import type { Ambient } from "../hooks/useAmbient";
import { useStudyRoom } from "../hooks/useRooms";
import { clock, createTimer } from "../lib/study";
import type { Profile, StudyRoom } from "../types";
import { Timer } from "./Timer";
import { SoundMixer } from "./SoundMixer";
import { Modal } from "./Modal";
function Media({
  stream,
  muted,
  audioOnly = false,
}: {
  stream: MediaStream;
  muted: boolean;
  audioOnly?: boolean;
}) {
  const element = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  useEffect(() => {
    const media = element.current!;
    media.srcObject = stream;
    return () => {
      media.srcObject = null;
    };
  }, [stream]);
  useEffect(() => {
    let active = true;
    void element.current?.play().then(
      () => { if (active) setNeedsPlay(false); },
      () => { if (active) setNeedsPlay(true); },
    );
    return () => { active = false; };
  }, [stream, muted]);
  return (
    <>
      <video
        ref={element}
        autoPlay
        muted={muted}
        playsInline
        className={audioOnly ? "audio-only" : ""}
      />
      {t(
        needsPlay && !muted && (
          <button
            className="media-play"
            onClick={() => {
              void element.current?.play().then(() => setNeedsPlay(false)).catch(() => {});
            }}
          >
            <Volume2 size={15} />
            {t(" Enable room sound")}
          </button>
        ),
      )}
    </>
  );
}
export function RoomView({
  room,
  profile,
  focus,
  audio,
  onLeave,
  onExpand,
  notify,
}: {
  room: StudyRoom;
  profile: Profile;
  focus: FocusTimer;
  audio: Ambient;
  onLeave: () => void;
  onExpand: () => void;
  notify: (message: string) => void;
}) {
  const live = useStudyRoom(room, profile, notify);
  const [message, setMessage] = useState("");
  const [goal, setGoal] = useState("");
  const [now, setNow] = useState(Date.now());
  const [muted, setMuted] = useState(false);
  const [joiningTimer, setJoiningTimer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const inviteInput = useRef<HTMLInputElement>(null);
  const chatPane = useRef<HTMLDivElement>(null);
  const shared = live.sharedClock;
  const sharedLeft = shared.endAt
    ? Math.max(0, Math.ceil((shared.endAt - now) / 1000))
    : shared.remaining;
  const allMembers = Object.entries(live.members);
  useEffect(() => {
    if (!shared.endAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [shared.endAt]);
  useEffect(() => {
    const pane = chatPane.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, [live.messages.length]);
  useEffect(() => {
    if (!joiningTimer) return;
    const remaining = shared.endAt
      ? Math.max(0, Math.ceil((shared.endAt - Date.now()) / 1000))
      : shared.remaining;
    focus.syncTimer({
      ...createTimer(shared.duration / 60),
      id: `shared-${room.id}-${shared.endAt ?? "paused"}-${shared.remaining}`,
      remaining,
      endAt: shared.endAt,
      subject: focus.timer.subject,
      subjectId: focus.timer.subjectId,
    });
  }, [shared, joiningTimer]);
  async function invite() {
    setShowInvite(true);
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      inviteInput.current?.focus();
      inviteInput.current?.select();
      const copied = document.execCommand("copy");
      setCopied(copied);
      if (!copied)
        notify(
          "Your browser blocked copying. The invite link is selected: press Ctrl+C, or long-press and choose Copy.",
        );
    }
  }
  return (
    <>
      <div className="room-page-heading">
        <div>
          <button className="back-link" onClick={onLeave}>
            <ArrowLeft size={15} />
            {t(" All study rooms")}
          </button>
          <h1>
            {t(room.name)} {t(room.private && <LockKeyhole size={22} />)}
          </h1>
          <p>{t(room.description)}</p>
        </div>
        <button className="primary" onClick={() => void invite()}>
          {t(copied ? <Check size={16} /> : <Copy size={16} />)}
          {t(copied ? "Link copied" : "Invite a friend")}
        </button>
      </div>
      <div className="room-live-status">
        <span
          className={`pulse-dot ${allMembers.length < 2 ? "waiting" : ""}`}
        />
        {t(live.status)}
        <span>
          <ShieldCheck size={13} />
          {t(" Camera & mic are your choice")}
        </span>
      </div>
      <div className="study-layout room-layout">
        <div className="study-main">
          <section className="shared-clock">
            <div>
              <span className="eyebrow">{t("A LITTLE FOCUS, TOGETHER")}</span>
              <h2>
                {t("Room focus clock ")}
                <span>
                  {t(allMembers.length)}
                  {t("/8 studying")}
                </span>
              </h2>
            </div>
            <span
              className="shared-digits"
              role="timer"
              aria-label={t("Shared room countdown")}
            >
              {t(clock(sharedLeft))}
            </span>
            <div className="shared-clock-actions">
              <button
                className="icon-button bordered"
                disabled={!live.ready}
                aria-label={t("Reset shared timer")}
                onClick={() => void live.changeClock("reset")}
              >
                <RotateCcw size={17} />
              </button>
              <button
                className="primary"
                disabled={!live.ready}
                onClick={() => void live.changeClock("toggle")}
              >
                {t(
                  shared.endAt && sharedLeft > 0 ? (
                    <Pause size={15} />
                  ) : (
                    <Play size={15} />
                  ),
                )}
                {t(
                  shared.endAt && sharedLeft > 0
                    ? "Pause together"
                    : "Start together",
                )}
              </button>
            </div>
            <label className="shared-join">
              <input
                type="checkbox"
                checked={joiningTimer}
                onChange={(event) => setJoiningTimer(event.target.checked)}
              />
              {t(" Sync my personal timer with the room")}
              {t(
                shared.by && (
                  <span>
                    {t("Updated by ")}
                    {t(shared.by)}
                  </span>
                ),
              )}
            </label>
          </section>

          <p className="room-connection-note" role="status">{t(live.mediaStatus)}</p>
          <section className="room-stage" aria-label={t("Study participants")}>
            <div className="stage-heading">
              <span>
                <Users size={16} />
                {t(" Your focus crew")}
              </span>
              <span className="tiny">
                {t(
                  profile.lowData ? "LOW DATA MODE" : "A LITTLE COMPANY HELPS",
                )}
              </span>
            </div>
            <div className="participant-grid">
              {t(
                allMembers.map(([userId, member]) => {
                  const self = userId === live.selfId;
                  const camera = self
                    ? live.localStreams.camera
                    : live.streams.find(
                        (stream) =>
                          stream.userId === userId && stream.kind === "camera",
                      )?.stream;
                  return (
                    <article
                      className={`participant ${self ? "is-you" : ""} ${live.blocked.includes(userId) ? "is-blocked" : ""}`}
                      key={userId}
                    >
                      {t(
                        camera && !profile.lowData ? (
                          <Media stream={camera} muted />
                        ) : (
                          <div className="participant-placeholder">
                            <div
                              className={`participant-avatar avatar-${member.exam.toLowerCase()}`}
                            >
                              {t(member.name.slice(0, 1).toUpperCase())}
                            </div>
                            <span>
                              {t(
                                live.blocked.includes(userId)
                                  ? "Hidden for you"
                                  : member.goal || "One page at a time.",
                              )}
                            </span>
                          </div>
                        ),
                      )}
                      <div className="participant-label">
                        <span>
                          <span className="green-dot" />
                          {t(member.name)}
                          {t(self && <small>{t("You")}</small>)}
                        </span>
                        {t(
                          !self && (
                            <button
                              className="icon-button"
                              title={t(
                                "Hide and mute this student for this visit",
                              )}
                              aria-label={`Hide ${member.name}`}
                              onClick={() => live.block(userId)}
                            >
                              <Flag size={13} />
                            </button>
                          ),
                        )}
                        {t(
                          self &&
                            (live.localStreams.microphone ? (
                              <Mic size={13} />
                            ) : (
                              <MicOff size={13} />
                            )),
                        )}
                      </div>
                      <span className="participant-exam">{t(member.exam)}</span>
                    </article>
                  );
                }),
              )}
              {t(
                allMembers.length < 8 && (
                  <button className="empty-seat" onClick={() => void invite()}>
                    <div>
                      <Users size={23} />
                    </div>
                    <strong>{t("A little room for a friend")}</strong>
                    <span>
                      {t("Share your invite link ")}
                      <ArrowUpRight size={13} />
                    </span>
                  </button>
                ),
              )}
            </div>
            {t(
              live.streams
                .filter(
                  (stream) =>
                    stream.kind === "microphone" &&
                    !live.blocked.includes(stream.userId),
                )
                .map((stream) => (
                  <Media
                    key={`${stream.peerId}-audio`}
                    stream={stream.stream}
                    muted={muted}
                    audioOnly
                  />
                )),
            )}
            {t(
              live.localStreams.screen && (
                <div className="screen-share">
                  <span>{t("You\u2019re sharing your screen")}</span>
                  <Media stream={live.localStreams.screen} muted />
                </div>
              ),
            )}
            {t(
              live.streams
                .filter(
                  (stream) =>
                    stream.kind === "screen" &&
                    !live.blocked.includes(stream.userId),
                )
                .map((stream) => (
                  <div className="screen-share" key={`${stream.peerId}-screen`}>
                    <span>
                      {t(live.members[stream.userId]?.name || "Student")}
                      {t("\u2019s screen")}
                    </span>
                    <Media stream={stream.stream} muted />
                  </div>
                )),
            )}
            <div className="room-media-controls">
              <button
                className={`media-control ${live.localStreams.camera ? "enabled" : ""}`}
                disabled={
                  live.busyMedia ||
                  (!live.localStreams.camera &&
                    (profile.lowData || !live.ready || !live.mediaReady))
                }
                onClick={() => void live.toggleMedia("camera")}
                aria-label={
                  live.localStreams.camera
                    ? "Turn camera off"
                    : "Turn camera on"
                }
              >
                {t(
                  live.localStreams.camera ? (
                    <Video size={19} />
                  ) : (
                    <VideoOff size={19} />
                  ),
                )}
                <span>{t("Camera")}</span>
              </button>
              <button
                className={`media-control ${live.localStreams.microphone ? "enabled" : ""}`}
                disabled={
                  live.busyMedia ||
                  (!live.localStreams.microphone &&
                    (profile.lowData || !live.ready || !live.mediaReady))
                }
                onClick={() => void live.toggleMedia("microphone")}
                aria-label={
                  live.localStreams.microphone
                    ? "Turn microphone off"
                    : "Turn microphone on"
                }
              >
                {t(
                  live.localStreams.microphone ? (
                    <Mic size={19} />
                  ) : (
                    <MicOff size={19} />
                  ),
                )}
                <span>{t("Microphone")}</span>
              </button>
              <button
                className={`media-control ${live.localStreams.screen ? "enabled" : ""}`}
                disabled={
                  live.busyMedia ||
                  (!live.localStreams.screen &&
                    (profile.lowData || !live.ready || !live.mediaReady))
                }
                onClick={() => void live.toggleMedia("screen")}
                aria-label={
                  live.localStreams.screen
                    ? "Stop sharing screen"
                    : "Share your screen"
                }
              >
                <MonitorUp size={19} />
                <span>{t("Share screen")}</span>
              </button>
              <button
                className={`media-control ${muted ? "" : "enabled"}`}
                onClick={(event) => {
                  setMuted(!muted);
                  if (muted) {
                    const players = event.currentTarget.closest(".room-stage")
                      ?.querySelectorAll<HTMLVideoElement>(".audio-only");
                    for (const player of players || []) {
                      player.muted = false;
                      void player.play().catch(() => {});
                    }
                  }
                }}
                aria-label={t(muted ? "Unmute room audio" : "Mute room audio")}
                aria-pressed={!muted}
              >
                {t(muted ? <VolumeX size={19} /> : <Volume2 size={19} />)}
                <span>{t(muted ? "Turn sound on" : "Room sound on")}</span>
              </button>
              <button className="leave-room" onClick={onLeave}>
                {t("Leave room")}
              </button>
            </div>
          </section>

          <form
            className="room-goal"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await live.setGoal(goal))
                notify("Your focus intention is shared with your room.");
            }}
          >
            <Target size={20} />
            <label>
              <strong>{t("What\u2019s your little win this session?")}</strong>
              <input
                maxLength={100}
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder={t("e.g. Finish 20 questions on integration")}
              />
            </label>
            <button className="secondary" disabled={!live.ready} type="submit">
              {t("Set intention ")}
              <Check size={15} />
            </button>
          </form>

          <section className="panel room-chat">
            <div className="panel-heading">
              <h2>
                <MessageCircle size={17} />
                {t(" A little conversation")}
              </h2>
              <span className="tiny muted">{t("BE KIND. STAY FOCUSED.")}</span>
            </div>
            <div
              ref={chatPane}
              className="chat-messages"
              aria-live="polite"
              aria-relevant="additions"
              role="log"
              aria-label={t("Room chat")}
            >
              {t(
                !live.messages.length && (
                  <div className="chat-welcome">
                    <span>{t("\uD83D\uDC4B")}</span>
                    <h3>{t("You\u2019re in good company.")}</h3>
                    <p>
                      {t(
                        "Say hello, share a goal, or save a question for your break.",
                      )}
                      <br />
                      {t(
                        "Recent messages sync through the server for up to 24 hours. Avoid sharing private information.",
                      )}
                    </p>
                  </div>
                ),
              )}
              {t(
                live.messages.map((item) => (
                  <div
                    key={item.id}
                    className={`chat-message ${item.peerId === live.selfId ? "own-message" : ""}`}
                  >
                    <div className="chat-avatar">
                      {t(item.name.slice(0, 1))}
                    </div>
                    <div>
                      <span className="chat-author">
                        {t(item.name)}{" "}
                        {t(
                          item.peerId === live.selfId && (
                            <small>{t("you")}</small>
                          ),
                        )}
                        <time>
                          {t(
                            new Intl.DateTimeFormat("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Kolkata",
                            }).format(item.sentAt),
                          )}
                        </time>
                      </span>
                      <p>{t(item.text)}</p>
                    </div>
                  </div>
                )),
              )}
            </div>
            <form
              className="chat-input"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await live.sendMessage(message)) setMessage("");
              }}
            >
              <label className="sr-only" htmlFor="room-message">
                {t("Message your study room")}
              </label>
              <input
                id="room-message"
                maxLength={500}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t("A kind word goes a long way\u2026")}
                autoComplete="off"
              />
              <span className="tiny muted">
                {t(message.length)}
                {t("/500")}
              </span>
              <button
                className="primary icon-button"
                type="submit"
                aria-label={t("Send message")}
                disabled={!live.ready || !message.trim()}
              >
                <Send size={17} />
              </button>
            </form>
          </section>
        </div>
        <aside className="study-widgets">
          <Timer focus={focus} onExpand={onExpand} />
          <SoundMixer audio={audio} />
          <div className="room-etiquette">
            <ShieldCheck size={22} />
            <h3>{t("A good place to be.")}</h3>
            <p>
              {t(
                "Be kind. Respect each other\u2019s space. Keep personal details private. You can hide or mute anyone for your visit.",
              )}
            </p>
            <span>{t("Public rooms \u00B7 8 seats \u00B7 No recording")}</span>
          </div>
        </aside>
      </div>
      {showInvite && (
        <Modal
          title="Invite a friend to this study room"
          onClose={() => {
            setShowInvite(false);
            setCopied(false);
          }}
        >
          <p className="muted">
            Send this link to your friend. They can open it on any device and
            enter their name to join the same room.
          </p>
          <label className="field">
            Room invite link
            <input
              ref={inviteInput}
              readOnly
              value={location.href}
              onFocus={(event) => event.target.select()}
              aria-label="Room invite link"
            />
          </label>
          <button
            className="primary full-width"
            onClick={() => void copyInvite()}
          >
            {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
            {copied ? "Copied — ready to share" : "Copy invite link"}
          </button>
          <p className="language-notice">
            If copying is blocked, select the link above and copy it manually.
            Anyone with the link can join; share it with people you trust.
          </p>
        </Modal>
      )}
    </>
  );
}
