import { useCallback, useEffect, useRef, useState } from "react";
import type { Message, PeerProfile, Profile, StudyRoom } from "../types";
import { api, cloudIdentity } from "../lib/cloud";

export interface SharedClock {
  endAt: number | null;
  remaining: number;
  duration: number;
  by: string;
}
interface Snapshot {
  members: Record<string, PeerProfile>;
  clock: SharedClock;
  revision: number;
  messages: Message[];
}

export function useRoomState(
  room: StudyRoom,
  profile: Profile,
  notify: (message: string) => void,
) {
  const [selfId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<Snapshot>({
    members: {},
    clock: {
      endAt: null,
      remaining: room.minutes * 60,
      duration: room.minutes * 60,
      by: "",
    },
    revision: -1,
    messages: [],
  });
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Connecting to your room…");
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const goal = useRef("");
  const refreshRef = useRef<() => void>(() => {});
  const apply = useCallback((data: Snapshot) => {
    setState((current) => {
      const messages = new Map(
        current.messages.map((message) => [message.id, message]),
      );
      for (const message of data.messages) messages.set(message.id, message);
      return {
        members: data.members,
        clock: data.revision > current.revision ? data.clock : current.clock,
        revision: Math.max(data.revision, current.revision),
        messages: [...messages.values()]
          .sort((a, b) => a.sentAt - b.sentAt)
          .slice(-100),
      };
    });
    setReady(true);
    setStatus("Connected · names and chat sync across devices");
  }, []);
  useEffect(() => {
    let stopped = false,
      inFlight = false;
    let timeout: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let token = "";
    void cloudIdentity()
      .then((identity) => {
        token = identity.token;
      })
      .catch(() => {});
    async function refresh() {
      if (stopped || inFlight) return;
      clearTimeout(timeout);
      inFlight = true;
      controller = new AbortController();
      try {
        const current = profileRef.current;
        const data = await api<Snapshot>(`rooms/${room.id}/presence`, {
          method: "PUT",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20000),
          ]),
          body: JSON.stringify({
            memberId: selfId,
            name: current.name,
            exam: current.exam,
            goal: goal.current,
            minutes: room.minutes,
          }),
        });
        if (!stopped) apply(data);
      } catch (error) {
        if (!stopped) {
          setReady(false);
          setStatus(
            error instanceof Error ? error.message : "Room is reconnecting…",
          );
        }
      } finally {
        inFlight = false;
        if (!stopped) {
          timeout = setTimeout(() => void refresh(), document.hidden ? 12000 : 3500);
        }
      }
    }
    function leave() {
      if (token)
        void fetch(`/api/rooms/${room.id}/presence?memberId=${selfId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        }).catch(() => {});
    }
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    refreshRef.current = () => void refresh();
    void refresh();
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      clearTimeout(timeout);
      controller?.abort();
      leave();
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [room.id, room.minutes, selfId, apply]);
  useEffect(() => refreshRef.current(), [profile.name, profile.exam]);

  async function sendMessage(text: string) {
    if (!text.trim() || text.length > 500 || !ready) return false;
    try {
      apply(
        await api<Snapshot>(`rooms/${room.id}/messages`, {
          method: "POST",
          body: JSON.stringify({
            memberId: selfId,
            id: crypto.randomUUID(),
            text: text.trim(),
          }),
        }),
      );
      return true;
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Message could not be sent. Please retry.",
      );
      return false;
    }
  }
  async function changeClock(action: "toggle" | "reset") {
    try {
      apply(
        await api<Snapshot>(`rooms/${room.id}/clock`, {
          method: "POST",
          body: JSON.stringify({ memberId: selfId, action }),
        }),
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not update the room clock. Please retry.",
      );
    }
  }
  return {
    members: state.members,
    selfId,
    messages: state.messages,
    sharedClock: state.clock,
    ready,
    status,
    sendMessage,
    changeClock,
    setGoal: async (value: string) => {
      goal.current = value.slice(0, 100);
      try {
        apply(
          await api<Snapshot>(`rooms/${room.id}/presence`, {
            method: "PUT",
            body: JSON.stringify({
              memberId: selfId,
              name: profileRef.current.name,
              exam: profileRef.current.exam,
              goal: goal.current,
              minutes: room.minutes,
            }),
          }),
        );
        return true;
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : "Your intention could not be shared. Please retry.",
        );
        return false;
      }
    },
  };
}
