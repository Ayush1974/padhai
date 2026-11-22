import type { Note } from "../types";
import { api, decryptWorkspace, encryptWorkspace } from "./cloud";

async function noteKey(bytes: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function createNoteLink(note: Note) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = await noteKey(bytes);
  const text = JSON.stringify({ title: note.title, body: note.body });
  const encrypted = await encryptWorkspace(text, key);
  const { id } = await api<{ id: string }>("note-shares", {
    method: "POST",
    body: JSON.stringify(encrypted),
  });
  const secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  // The browser keeps the fragment out of the server request.
  return `${location.origin}/?page=notes&share=${id}#note-key=${secret}`;
}

export async function openNoteLink(url: URL): Promise<Note> {
  const id = url.searchParams.get("share") || "";
  const secret = new URLSearchParams(url.hash.slice(1)).get("note-key") || "";
  if (!/^[a-f0-9-]{36}$/.test(id) || !/^[a-f0-9]{64}$/.test(secret))
    throw new Error("This note link is incomplete. Ask for the full link.");

  const encrypted = await api<{ encrypted: string; iv: string }>(`note-shares/${id}`);
  try {
    const bytes = Uint8Array.from(secret.match(/../g)!, (pair) => parseInt(pair, 16));
    const text = await decryptWorkspace(encrypted, await noteKey(bytes));
    const { title, body } = JSON.parse(text);
    if (
      typeof title !== "string" ||
      title.length > 100 ||
      typeof body !== "string" ||
      body.length > 100000
    )
      throw new Error();

    return { id: `shared-${id}`, title, body, notebookId: "inbox", updatedAt: Date.now() };
  } catch {
    throw new Error("This note link could not be opened. Ask for a new link.");
  }
}
