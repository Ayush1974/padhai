import { useEffect, useMemo, useRef, useState } from "react";
import type { MessageAction, Room } from "@trystero-p2p/core";
import type { Profile, StudyRoom } from "../types";
import { api } from "../lib/cloud";
import { createRoomCall, type CallInbox } from "../lib/roomCall";
import { useRoomState } from "./useRoomState";

type MediaKind = "camera" | "microphone" | "screen";
type MediaChange = { kind: MediaKind; enabled: boolean };
const mediaKinds: readonly string[] = ["camera", "microphone", "screen"];
const callReadyMessage = "Room call is ready. Turn on your camera or microphone when you’re ready.";

export interface RoomStream {
  peerId: string;
  userId: string;
  kind: MediaKind;
  stream: MediaStream;
}

export function useStudyRoom(
  studyRoom: StudyRoom,
  profile: Profile,
  notify: (message: string) => void,
) {
  const inbox = useRef<CallInbox | null>(null);
  const state = useRoomState(studyRoom, profile, notify, inbox);
  const [joinedRoom, setJoinedRoom] = useState("");
  const [mediaReady, setMediaReady] = useState(false);
  const [streams, setStreams] = useState<RoomStream[]>([]);
  const [localStreams, setLocalStreams] = useState<Partial<Record<MediaKind, MediaStream>>>({});
  const [mediaStatus, setMediaStatus] = useState("Connecting the room call…");
  const [busyMedia, setBusyMedia] = useState(false);
  const [blocked, setBlocked] = useState<string[]>([]);
  const roomRef = useRef<Room | null>(null);
  const mediaRef = useRef<MessageAction<MediaChange> | null>(null);
  const localRef = useRef<Partial<Record<MediaKind, MediaStream>>>({});
  const lowData = useRef(profile.lowData);
  lowData.current = profile.lowData;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  useEffect(() => {
    if (state.ready) setJoinedRoom(studyRoom.id);
  }, [state.ready, studyRoom.id]);

  useEffect(() => {
    if (joinedRoom !== studyRoom.id) return;
    if (typeof RTCPeerConnection === "undefined") {
      setMediaStatus("This browser cannot make a room call. Try Chrome, Edge, or Safari.");
      return;
    }

    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    let room: Room | undefined;
    const memberId = state.selfId;

    async function connect() {
      try {
        const { iceServers } = await api<{ iceServers: RTCIceServer[] }>(
          "rooms/" + studyRoom.id + "/signals?memberId=" + memberId,
          { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) },
        );
        if (controller.signal.aborted) return;

        const call = createRoomCall(studyRoom.id, memberId, iceServers, controller.signal);
        room = call.room;
        roomRef.current = room;
        inbox.current = call.inbox;
        setMediaReady(true);
        setMediaStatus(callReadyMessage);

        const media = room.makeAction<MediaChange>("media");
        mediaRef.current = media;
        media.onReceive(({ byteLength }) => byteLength <= 256);
        media.onMessage((data, { peerId }) => {
          if (data?.enabled === false && mediaKinds.includes(data.kind))
            setStreams((current) =>
              current.filter((item) => item.peerId !== peerId || item.kind !== data.kind),
            );
        });

        room.onPeerJoin(({ peerId }) => {
          if (controller.signal.aborted) return;
          setMediaStatus("Live call connected");
          for (const [kind, stream] of Object.entries(localRef.current)) {
            void call.room
              .addStream(stream, { target: peerId, metadata: { kind, memberId } })
              .catch(() => setMediaStatus("Your camera or microphone couldn’t connect. Try turning it off and on."));
          }
        });

        room.onPeerLeave(({ peerId }) => {
          if (controller.signal.aborted) return;
          setStreams((current) => current.filter((item) => item.peerId !== peerId));
          if (!call.inbox.connectedPeers()) setMediaStatus(callReadyMessage);
        });

        room.onPeerStream((stream, { peerId, metadata }) => {
          if (controller.signal.aborted || !metadata || typeof metadata !== "object" ||
            Array.isArray(metadata) || !("kind" in metadata) || !("memberId" in metadata)) return;
          const { kind, memberId: sender } = metadata;
          if (typeof kind !== "string" || !mediaKinds.includes(kind) ||
            typeof sender !== "string" || !/^[a-f0-9-]{36}$/.test(sender)) return;

          setStreams((current) => [
            ...current.filter((item) => item.peerId !== peerId || item.kind !== kind),
            { peerId, userId: sender, kind: kind as MediaKind, stream },
          ]);
        });

        room.onError((error) => {
          if (!controller.signal.aborted &&
            ["relay-failed", "peer-connect-failed", "identity-failed"].includes(error.code)) {
            setMediaStatus("The room call is reconnecting. Keep the room open on both devices.");
          }
        });
      } catch {
        if (controller.signal.aborted) return;
        setMediaStatus("The room call is reconnecting. Keep the room open on both devices.");
        retry = setTimeout(() => void connect(), 3500);
      }
    }

    void connect();
    return () => {
      controller.abort();
      clearTimeout(retry);
      inbox.current = null;
      roomRef.current = null;
      mediaRef.current = null;
      for (const stream of Object.values(localRef.current)) {
        stream.getTracks().forEach((track) => track.stop());
      }
      localRef.current = {};
      if (room) void room.leave();
    };
  }, [joinedRoom, studyRoom.id, state.selfId]);

  function stopMedia(kind: MediaKind) {
    const stream = localRef.current[kind];
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    delete localRef.current[kind];
    roomRef.current?.removeStream(stream);
    setLocalStreams({ ...localRef.current });
    void mediaRef.current?.send({ kind, enabled: false }).catch(() => {});
  }

  useEffect(() => {
    if (profile.lowData) {
      stopMedia("camera");
      stopMedia("microphone");
      stopMedia("screen");
    }
  }, [profile.lowData]);

  async function toggleMedia(kind: MediaKind) {
    const room = roomRef.current;
    if (!room || busyMedia) return;
    if (localRef.current[kind]) {
      stopMedia(kind);
      return;
    }
    if (!state.ready || profile.lowData) return;
    if (!navigator.mediaDevices || (kind === "screen" && !navigator.mediaDevices.getDisplayMedia)) {
      notifyRef.current("This browser does not support this feature. Try Chrome, Edge, or Safari on a supported device.");
      return;
    }

    setBusyMedia(true);
    let acquired: MediaStream | undefined;
    try {
      acquired = kind === "screen"
        ? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10 }, audio: false })
        : await navigator.mediaDevices.getUserMedia(kind === "microphone"
          ? { audio: true, video: false }
          : {
              audio: false,
              video: { width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 20 } },
            });

      if (roomRef.current !== room || lowData.current) {
        acquired.getTracks().forEach((track) => track.stop());
        return;
      }
      await room.addStream(acquired, { metadata: { kind, memberId: state.selfId } });
      if (roomRef.current !== room || lowData.current) {
        acquired.getTracks().forEach((track) => track.stop());
        if (roomRef.current === room) room.removeStream(acquired);
        return;
      }
      localRef.current[kind] = acquired;
      setLocalStreams({ ...localRef.current });
      acquired.getTracks().forEach((track) => {
        track.onended = () => {
          if (localRef.current[kind] === acquired) stopMedia(kind);
        };
      });
    } catch (error) {
      acquired?.getTracks().forEach((track) => track.stop());
      if (error instanceof DOMException && error.name === "NotAllowedError")
        notifyRef.current("Allow camera or microphone access in your browser when you’re ready to share.");
      else
        notifyRef.current("Media could not start. Check your device and browser permissions.");
    } finally {
      setBusyMedia(false);
    }
  }

  function block(userId: string) {
    setBlocked((current) => [...current, userId]);
    notifyRef.current("Student hidden and muted for you for this visit.");
  }

  const messages = useMemo(
    () => state.messages.filter((message) => !blocked.includes(message.peerId)),
    [state.messages, blocked],
  );

  return {
    ...state,
    messages,
    streams: streams.filter((stream) =>
      Object.hasOwn(state.members, stream.userId) && !blocked.includes(stream.userId),
    ),
    localStreams,
    mediaStatus,
    mediaReady,
    busyMedia,
    blocked,
    toggleMedia,
    block,
  };
}
