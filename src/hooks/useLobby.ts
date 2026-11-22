import { useEffect, useState } from "react";
import type { StudyRoom } from "../types";

export function useLobby(active: StudyRoom | null) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!active || active.private) return;
    let stopped = false;
    let leave = () => {};
    void import("trystero")
      .then(({ joinRoom, scale }) => {
        if (stopped) return;
        const lobby = joinRoom(
          { appId: `padhai-v1:${location.host}`, use: [scale()] },
          "public-lobby",
        );
        const presence = lobby.makeUserState<{ roomId: string }>(
          "presence",
          { roomId: active.id },
          {
            maxBytes: 256,
            validate: (value) =>
              !!value &&
              typeof value.roomId === "string" &&
              value.roomId.length <= 100,
          },
        );
        const unsubscribe = presence.onChange(() => {
          const totals: Record<string, number> = {};
          Object.values(presence.getAll()).forEach((value) => {
            if (value.roomId)
              totals[value.roomId] = (totals[value.roomId] || 0) + 1;
          });
          if (!stopped) setCounts(totals);
        });
        lobby.onError(() => {});
        void presence.set({ roomId: active.id }).catch(() => {});
        leave = () => {
          unsubscribe();
          void lobby.leave();
        };
      })
      .catch(() => {});
    return () => {
      stopped = true;
      leave();
      setCounts({});
    };
  }, [active?.id]);
  return counts;
}
