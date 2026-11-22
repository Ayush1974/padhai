import { useEffect, useMemo, useRef, useState } from "react";
import {
  joinRoom,
  type Room,
  type UserState,
  type MessageAction,
} from "trystero";
import type { PeerProfile, Profile, StudyRoom } from "../types";
import { useRoomState } from "./useRoomState";

export interface RoomStream {
  peerId: string;
  userId: string;
  kind: string;
  stream: MediaStream;
}
function validProfile(value: PeerProfile) {
  return (
    !!value &&
    typeof value.name === "string" &&
    value.name.length <= 40 &&
    typeof value.exam === "string" &&
    value.exam.length <= 30 &&
    typeof value.goal === "string" &&
    value.goal.length <= 100 &&
    typeof value.presenceId === "string" &&
    /^[a-f0-9-]{36}$/.test(value.presenceId)
  );
}

export function useStudyRoom(
  studyRoom: StudyRoom,
  profile: Profile,
  notify: (message: string) => void,
) {
  const roomState = useRoomState(studyRoom, profile, notify);
  const [streams, setStreams] = useState<RoomStream[]>([]);
  const [localStreams, setLocalStreams] = useState<Record<string, MediaStream>>(
    {},
  );
  const [peerProfiles, setPeerProfiles] = useState<Record<string, PeerProfile>>(
    {},
  );
  const [mediaStatus, setMediaStatus] = useState(
    "Calls connect directly; names and chat use the server.",
  );
  const [busyMedia, setBusyMedia] = useState(false);
  const [blocked, setBlocked] = useState<string[]>([]);
  const roomRef = useRef<Room | null>(null);
  const profileRef = useRef<UserState<PeerProfile> | null>(null);
  const mediaRef = useRef<MessageAction<{
    kind: string;
    enabled: boolean;
  }> | null>(null);
  const localRef = useRef<Record<string, MediaStream>>({});
  const profileValue = useRef(profile);
  profileValue.current = profile;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  useEffect(() => {
    let cancelled = false;
    let room: Room;
    try {
      // Each tab needs its own identity, even when two family accounts share one browser.
      room = joinRoom(
        { appId: "padhai-study-calls-v2", identity: "none", maxUsers: 8 },
        studyRoom.id,
      );
      roomRef.current = room;
      const own = room.makeUserState<PeerProfile>(
        "student",
        {
          name: profileValue.current.name,
          exam: profileValue.current.exam,
          goal: "",
          roomId: studyRoom.id,
          presenceId: roomState.selfId,
        },
        { maxBytes: 1024, validate: validProfile },
      );
      profileRef.current = own;
      own.onChange(() => {
        if (!cancelled) setPeerProfiles({ ...own.getAll() });
      });
      const media = room.makeAction<{ kind: string; enabled: boolean }>(
        "media",
      );
      mediaRef.current = media;
      media.onReceive(({ byteLength }) => byteLength <= 256);
      media.onMessage((data, { peerId }) => {
        if (
          data &&
          ["camera", "microphone", "screen"].includes(data.kind) &&
          data.enabled === false
        )
          setStreams((current) =>
            current.filter(
              (item) => !(item.peerId === peerId && item.kind === data.kind),
            ),
          );
      });
      room.onPeerJoin(({ peerId }) => {
        if (cancelled) return;
        setMediaStatus("Peer connected · encrypted camera and audio available");
        Object.entries(localRef.current).forEach(([kind, stream]) => {
          void room
            .addStream(stream, { target: peerId, metadata: { kind } })
            .catch(() =>
              notifyRef.current("A media connection could not be established."),
            );
        });
      });
      room.onPeerLeave(({ peerId }) => {
        if (!cancelled)
          setStreams((current) =>
            current.filter((item) => item.peerId !== peerId),
          );
      });
      room.onPeerStream((stream, { peerId, userId, metadata }) => {
        if (cancelled) return;
        const kind =
          metadata &&
          typeof metadata === "object" &&
          !Array.isArray(metadata) &&
          "kind" in metadata &&
          typeof metadata.kind === "string"
            ? metadata.kind
            : "camera";
        if (!["camera", "microphone", "screen"].includes(kind)) return;
        setStreams((current) => [
          ...current.filter(
            (item) => !(item.peerId === peerId && item.kind === kind),
          ),
          { peerId, userId, kind, stream },
        ]);
      });
      room.onError((error) => {
        if (
          !cancelled &&
          ["relay-failed", "peer-connect-failed", "identity-failed"].includes(
            error.code,
          )
        )
          setMediaStatus(
            "Direct calls are reconnecting. Everyone can still use room chat and the shared clock.",
          );
      });
      void room
        .getSelf()
        .then(() =>
          own.set({
            name: profileValue.current.name,
            exam: profileValue.current.exam,
            goal: "",
            roomId: studyRoom.id,
            presenceId: roomState.selfId,
          }),
        )
        .catch(() => {
          if (!cancelled)
            setMediaStatus(
              "Calls unavailable on this network. Room chat and the shared clock still work.",
            );
        });
    } catch {
      setMediaStatus(
        "Calls unavailable on this browser. Room chat and the shared clock still work.",
      );
    }
    return () => {
      cancelled = true;
      Object.values(localRef.current).forEach((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      );
      localRef.current = {};
      roomRef.current = null;
      profileRef.current = null;
      if (room) void room.leave();
    };
  }, [studyRoom.id, roomState.selfId]);
  useEffect(() => {
    void profileRef.current
      ?.set((current) => ({
        ...current,
        name: profile.name,
        exam: profile.exam,
      }))
      .catch(() => {});
  }, [profile.name, profile.exam]);

  useEffect(() => {
    if (!profile.lowData) return;
    Object.entries(localRef.current).forEach(([kind, stream]) => {
      roomRef.current?.removeStream(stream);
      stream.getTracks().forEach((track) => track.stop());
      void mediaRef.current?.send({ kind, enabled: false }).catch(() => {});
    });
    localRef.current = {};
    setLocalStreams({});
  }, [profile.lowData]);

  async function toggleMedia(kind: "camera" | "microphone" | "screen") {
    const room = roomRef.current;
    if (!room || busyMedia) return;
    const existing = localRef.current[kind];
    if (existing) {
      room.removeStream(existing);
      existing.getTracks().forEach((track) => track.stop());
      delete localRef.current[kind];
      setLocalStreams({ ...localRef.current });
      void mediaRef.current?.send({ kind, enabled: false }).catch(() => {});
      return;
    }
    if (!roomState.ready || profile.lowData) return;
    if (
      !navigator.mediaDevices ||
      (kind === "screen" && !navigator.mediaDevices.getDisplayMedia)
    ) {
      notifyRef.current(
        "This browser does not support this feature. Try Chrome, Edge, or Safari on a supported device.",
      );
      return;
    }
    setBusyMedia(true);
    let acquired: MediaStream | undefined;
    try {
      acquired =
        kind === "screen"
          ? await navigator.mediaDevices.getDisplayMedia({
              video: { frameRate: 10 },
              audio: false,
            })
          : await navigator.mediaDevices.getUserMedia(
              kind === "microphone"
                ? { audio: true, video: false }
                : {
                    audio: false,
                    video: {
                      width: { ideal: 480 },
                      height: { ideal: 360 },
                      frameRate: { ideal: 15, max: 20 },
                    },
                  },
            );
      if (roomRef.current !== room) {
        acquired.getTracks().forEach((track) => track.stop());
        return;
      }
      await room.addStream(acquired, { metadata: { kind } });
      localRef.current[kind] = acquired;
      setLocalStreams({ ...localRef.current });
      acquired.getTracks().forEach((track) => {
        track.onended = () => {
          const current = localRef.current[kind];
          if (current !== acquired) return;
          room.removeStream(current);
          current.getTracks().forEach((item) => item.stop());
          delete localRef.current[kind];
          setLocalStreams({ ...localRef.current });
          void mediaRef.current?.send({ kind, enabled: false }).catch(() => {});
        };
      });
    } catch (error) {
      acquired?.getTracks().forEach((track) => track.stop());
      if (error instanceof DOMException && error.name === "NotAllowedError")
        notifyRef.current(
          "Permission was not granted. You can keep studying with camera and microphone off.",
        );
      else
        notifyRef.current(
          "Media could not start. Check your device and browser permissions.",
        );
    } finally {
      setBusyMedia(false);
    }
  }

  function block(userId: string) {
    setBlocked((current) => [...current, userId]);
    notifyRef.current("Student hidden and muted for you for this visit.");
  }
  const messages = useMemo(
    () =>
      roomState.messages.filter((message) => !blocked.includes(message.peerId)),
    [roomState.messages, blocked],
  );
  const visibleStreams = streams
    .map((stream) => ({
      ...stream,
      userId: peerProfiles[stream.userId]?.presenceId || "",
    }))
    .filter(
      (stream) =>
        stream.userId &&
        roomState.members[stream.userId] &&
        !blocked.includes(stream.userId),
    );
  return {
    ...roomState,
    messages,
    streams: visibleStreams,
    localStreams,
    mediaStatus,
    busyMedia,
    blocked,
    toggleMedia,
    block,
  };
}
