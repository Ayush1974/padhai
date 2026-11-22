import { getStudyKey, readAPIResponse } from "./cloud";

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  courseName: string;
}
export interface KeyVault {
  salt: string;
  iv: string;
  encrypted: string;
}
export interface AccountResult {
  user: AccountUser;
  keyVault: KeyVault;
}

function encode(value: Uint8Array) {
  return btoa(String.fromCharCode(...value));
}
function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
async function passwordKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function sealStudyKey(
  password: string,
  studyKey = getStudyKey(),
): Promise<KeyVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passwordKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(studyKey),
  );
  return {
    salt: encode(salt),
    iv: encode(iv),
    encrypted: encode(new Uint8Array(encrypted)),
  };
}
export async function openStudyKey(
  password: string,
  vault: KeyVault,
): Promise<string> {
  const key = await passwordKey(password, decode(vault.salt));
  const value = new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(vault.iv) },
      key,
      decode(vault.encrypted),
    ),
  );
  if (!/^padhai_[a-f0-9]{64}$/.test(value))
    throw new Error(
      "Your encrypted workspace key could not be restored. Use your saved private study key in Settings.",
    );
  return value;
}
export async function accountRequest<T>(
  action: string,
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api/auth/${action}`, {
    method: data ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await readAPIResponse(response);
  if (!response.ok)
    throw new Error(
      result.error || "Your account could not be opened. Please retry.",
    );
  return result;
}
export function switchWorkspace(studyKey: string, accountId?: string) {
  for (const field of [
    "profile",
    "my-rooms",
    "tasks",
    "notes",
    "notebooks",
    "ai-settings",
    "sessions",
    "exam-plan",
    "habits",
    "events",
    "journal",
    "timer",
    "cloud-hash",
    "cloud-revision",
  ])
    localStorage.removeItem(`padhai-${field}`);
  localStorage.setItem("padhai-study-key", JSON.stringify(studyKey));
  if (accountId) localStorage.setItem("padhai-device-account", accountId);
  else localStorage.removeItem("padhai-device-account");
  location.reload();
}
