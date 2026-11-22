import { createTopicStrategy, type StrategyMessage } from "@trystero-p2p/core";
import { api } from "./cloud";

interface CallSignal {
  id: string;
  topic: string;
  message: StrategyMessage;
}

export interface CallInbox {
  request: () => { signalTopics: string[]; readSignals: string[] };
  receive: (signals: CallSignal[]) => void;
  connectedPeers: () => number;
}

export function createRoomCall(
  roomId: string,
  memberId: string,
  iceServers: RTCIceServer[],
  signal: AbortSignal,
) {
  const topics = new Map<string, (topic: string, message: StrategyMessage) => void | Promise<void>>();
  const received = new Set<string>();
  const inbox: CallInbox = {
    request: () => ({ signalTopics: [...topics.keys()], readSignals: [...received] }),
    connectedPeers: () => Object.keys(room.getPeers()).length,
    receive(signals) {
      for (const packet of signals) {
        const receive = topics.get(packet.topic);
        if (!receive || received.has(packet.id)) continue;
        received.add(packet.id);
        if (received.size > 100) received.delete(received.values().next().value!);
        void Promise.resolve(receive(packet.topic, packet.message)).catch(() => {});
      }
    },
  };
  const joinRoom = createTopicStrategy({
    init: () => memberId,
    steadyAnnounceIntervalMs: 15000,
    subscribeTopic(_relay, topic, receive) {
      topics.set(topic, receive);
      return () => { topics.delete(topic); };
    },
    async publishTopic(_relay, topic, message) {
      await api(`rooms/${roomId}/signals`, {
        method: "POST",
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
        body: JSON.stringify({ memberId, topic, message }),
      });
    },
  });

  const room = joinRoom({
    appId: "padhai-room-media-v3",
    identity: "none",
    maxUsers: 8,
    rtcConfig: { iceServers },
  }, roomId);
  return { room, inbox };
}
