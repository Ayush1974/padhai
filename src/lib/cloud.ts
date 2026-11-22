import { readStorage } from "./storage";

let identity: Promise<{ token: string; key: CryptoKey; id: string }> | null =
  null;
const encoder = new TextEncoder();

export async function readAPIResponse(response: Response) {
  if (!response.headers.get("Content-Type")?.includes("application/json"))
    throw new Error(
      "The app service could not be reached. Please reload Padhai and try again shortly.",
    );
  try {
    return await response.json();
  } catch {
    throw new Error(
      "The app service returned an incomplete response. Please try again shortly.",
    );
  }
}

export function getStudyKey(): string {
  let key = readStorage<string>("study-key", "");
  if (!/^padhai_[a-f0-9]{64}$/.test(key)) {
    key = `padhai_${Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, "0")).join("")}`;
    localStorage.setItem("padhai-study-key", JSON.stringify(key));
  }
  return key;
}

async function credentials(studyKey: string) {
  const encryptionBytes = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`encryption:${studyKey}`),
  );
  const authBytes = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`authentication:${studyKey}`),
  );
  const token = Array.from(new Uint8Array(authBytes), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  const key = await crypto.subtle.importKey(
    "raw",
    encryptionBytes,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
  return { token, key };
}

export async function cloudIdentity() {
  if (!identity)
    identity = (async () => {
      const auth = await credentials(getStudyKey());
      const response = await fetch("/api/account", {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const result = await readAPIResponse(response);
      if (!response.ok)
        throw new Error(result.error || "Could not connect to cloud storage.");
      return { ...auth, id: result.id as string };
    })().catch((error) => {
      identity = null;
      throw error;
    });
  return identity;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { token } = await cloudIdentity();
  const response = await fetch(`/api/${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(path === "ai" ? 58000 : 25000),
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await readAPIResponse(response);
  if (response.status === 401)
    window.dispatchEvent(new Event("account-sign-in-needed"));
  if (!response.ok)
    throw Object.assign(new Error(data.error || "Please try again."), {
      status: response.status,
      needsKey: data.needsKey === true,
    });
  return data;
}

function toBase64(data: Uint8Array): string {
  let text = "";
  for (const byte of data) text += String.fromCharCode(byte);
  return btoa(text);
}
export async function encryptWorkspace(text: string, key?: CryptoKey) {
  const cipherKey = key || (await cloudIdentity()).key;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cipherKey,
    encoder.encode(text),
  );
  return { iv: toBase64(iv), encrypted: toBase64(new Uint8Array(encrypted)) };
}

export async function decryptWorkspace(
  data: { iv: string; encrypted: string },
  key?: CryptoKey,
) {
  const decode = (value: string) =>
    Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  const cipherKey = key || (await cloudIdentity()).key;
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(data.iv) },
      cipherKey,
      decode(data.encrypted),
    ),
  );
}
