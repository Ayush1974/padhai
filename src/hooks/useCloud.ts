import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  decryptWorkspace,
  encryptWorkspace,
  getStudyKey,
} from "../lib/cloud";

interface SavedWorkspace {
  id: string;
  encrypted: string | null;
  iv: string | null;
  revision: number;
}

export function useCloud<T>(
  value: T,
  restore: (value: unknown) => void,
  enabled = true,
) {
  const [status, setStatus] = useState("Connecting to cloud…");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conflict, setConflict] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const revision = useRef(0);
  const lastSaved = useRef("");
  const latest = useRef("");
  const restoreRef = useRef(restore);
  const saving = useRef(false);
  const saveImmediately = useRef(false);
  const readyRef = useRef(false);
  const statusRef = useRef(status);
  const serialized = useMemo(() => JSON.stringify(value), [value]);
  latest.current = serialized;
  restoreRef.current = restore;
  statusRef.current = status;

  async function fingerprint(text: string) {
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text),
    );
    return Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }
  async function remember(text: string, version: number) {
    localStorage.setItem("padhai-cloud-hash", await fingerprint(text));
    localStorage.setItem("padhai-cloud-revision", String(version));
  }

  useEffect(() => {
    if (!enabled) {
      readyRef.current = false;
      setReady(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    let stopped = false;
    async function connect() {
      try {
        getStudyKey();
        const cloud = await api<SavedWorkspace>("account");
        if (stopped) return;
        const oldHash = localStorage.getItem("padhai-cloud-hash");
        const oldRevision = Number(
          localStorage.getItem("padhai-cloud-revision") ?? -1,
        );
        const hasLocalChanges =
          !!oldHash && (await fingerprint(latest.current)) !== oldHash;
        revision.current = Number(cloud.revision);
        if (hasLocalChanges && Number(cloud.revision) !== oldRevision) {
          setConflict(true);
          setStatus("Newer changes on another device");
          readyRef.current = true;
          setReady(true);
          return;
        }
        if (cloud.encrypted && cloud.iv) {
          const text = await decryptWorkspace({
            encrypted: cloud.encrypted,
            iv: cloud.iv,
          });
          if (stopped) return;
          const parsed = JSON.parse(text);
          if (!hasLocalChanges) {
            restoreRef.current(parsed);
            await remember(text, Number(cloud.revision));
          }
          lastSaved.current = JSON.stringify(parsed);
        }
        readyRef.current = true;
        setStatus(hasLocalChanges ? "Saving…" : "Saved to cloud");
        setReady(true);
      } catch {
        if (!stopped) setStatus("Saved here · cloud reconnecting");
      } finally {
        if (!stopped) setLoading(false);
      }
    }
    void connect();
    const retry = () => {
      if (stopped) return;
      if (readyRef.current) setRetryCount((value) => value + 1);
      else void connect();
    };
    const interval = window.setInterval(() => {
      if (!readyRef.current || statusRef.current.includes("reconnecting"))
        retry();
    }, 20000);
    window.addEventListener("online", retry);
    return () => {
      stopped = true;
      clearInterval(interval);
      window.removeEventListener("online", retry);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready || conflict || serialized === lastSaved.current)
      return;
    setStatus("Saving…");
    const timeout = setTimeout(async () => {
      saveImmediately.current = false;
      if (saving.current) return;
      saving.current = true;
      try {
        while (latest.current !== lastSaved.current) {
          const snapshot = latest.current;
          const encrypted = await encryptWorkspace(snapshot);
          const result = await api<{ revision: number }>("account", {
            method: "PUT",
            body: JSON.stringify({ ...encrypted, revision: revision.current }),
          });
          revision.current = result.revision;
          lastSaved.current = snapshot;
          await remember(snapshot, result.revision);
        }
        setStatus("Saved to cloud");
      } catch (error) {
        if (
          error instanceof Error &&
          "status" in error &&
          error.status === 409
        ) {
          setConflict(true);
          setStatus("Newer changes on another device");
        } else setStatus("Saved here · cloud reconnecting");
      } finally {
        saving.current = false;
      }
    }, saveImmediately.current ? 0 : 900);
    return () => clearTimeout(timeout);
  }, [serialized, ready, conflict, retryCount, enabled]);

  async function resolveConflict(useCloudCopy: boolean) {
    try {
      const cloud = await api<SavedWorkspace>("account");
      revision.current = Number(cloud.revision);
      if (useCloudCopy && cloud.encrypted && cloud.iv) {
        const text = await decryptWorkspace({
          encrypted: cloud.encrypted,
          iv: cloud.iv,
        });
        const parsed = JSON.parse(text);
        restoreRef.current(parsed);
        lastSaved.current = JSON.stringify(parsed);
        await remember(JSON.stringify(parsed), Number(cloud.revision));
      }
      if (!useCloudCopy) lastSaved.current = "";
      setConflict(false);
      setReady(true);
      setRetryCount((value) => value + 1);
      setStatus("Saved to cloud");
    } catch {
      setStatus("Saved here · cloud reconnecting");
    }
  }
  function saveNow() {
    if (latest.current === lastSaved.current) return;
    saveImmediately.current = true;
    setRetryCount((value) => value + 1);
  }

  return { status, ready, loading, conflict, resolveConflict, saveNow };
}
