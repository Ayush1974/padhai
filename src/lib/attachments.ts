import type { Attachment } from "../types";
import { api, cloudIdentity } from "./cloud";

function base64(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}
function bytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export async function saveAttachment(file: File): Promise<Attachment> {
  if (file.size > 20_971_520 || file.size < 1)
    throw new Error(
      "Choose a file smaller than 20 MB. Larger files can be added as links in your note.",
    );
  if (file.size > 2_097_152) {
    const parts: { id: string; size: number }[] = [];
    try {
      for (let offset = 0; offset < file.size; offset += 1_572_864) {
        const part = await saveAttachment(
          new File([file.slice(offset, offset + 1_572_864)], file.name, {
            type: file.type,
          }),
        );
        parts.push({ id: part.id, size: part.size });
      }
      return {
        id: parts[0].id,
        name: file.name.slice(0, 200),
        mime: file.type || "application/octet-stream",
        size: file.size,
        createdAt: Date.now(),
        parts,
      };
    } catch (error) {
      await Promise.allSettled(
        parts.map((part) => api(`files/${part.id}`, { method: "DELETE" })),
      );
      throw error;
    }
  }
  const { key } = await cloudIdentity();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const content = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    await file.arrayBuffer(),
  );
  const id = crypto.randomUUID();
  await api(`files/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      iv: base64(iv),
      encrypted: base64(new Uint8Array(content)),
      size: file.size,
    }),
  });
  return {
    id,
    name: file.name.slice(0, 200),
    mime: file.type || "application/octet-stream",
    size: file.size,
    createdAt: Date.now(),
  };
}

export async function attachmentBlob(file: Attachment): Promise<Blob> {
  if (file.parts?.length) {
    const pieces = [];
    for (const part of file.parts)
      pieces.push(
        await attachmentBlob({
          ...file,
          id: part.id,
          size: part.size,
          parts: undefined,
        }),
      );
    return new Blob(pieces, { type: file.mime });
  }
  const data = await api<{ iv: string; encrypted: string }>(`files/${file.id}`);
  const { key } = await cloudIdentity();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(data.iv) },
    key,
    bytes(data.encrypted),
  );
  return new Blob([decrypted], { type: file.mime });
}

export async function downloadAttachment(file: Attachment) {
  const url = URL.createObjectURL(await attachmentBlob(file));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function deleteAttachment(file: Attachment) {
  for (const part of file.parts || [{ id: file.id }])
    await api(`files/${part.id}`, { method: "DELETE" });
}
export async function fileBase64(file: File | Blob) {
  return base64(new Uint8Array(await file.arrayBuffer()));
}
