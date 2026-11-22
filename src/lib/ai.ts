import type { AISettings } from "../types";
import { api, decryptWorkspace, encryptWorkspace } from "./cloud";
import { readStorage } from "./storage";
let workspaceReady = false;
export function setAIWorkspaceReady(value: boolean) {
  workspaceReady = value;
}

export async function askAI<T>(
  input: Record<string, unknown>,
  settings?: AISettings,
): Promise<T> {
  if (!workspaceReady)
    throw new Error(
      "Your saved profile is still loading. Try AI again in a moment.",
    );
  const current = settings || readStorage<AISettings>("ai-settings", {});
  const headers: Record<string, string> = {};
  if (current.encryptedKey) {
    try {
      headers["X-Padhai-Gemini-Key"] = await decryptWorkspace(
        current.encryptedKey,
      );
    } catch {
      window.dispatchEvent(
        new CustomEvent("ai-key-needed", {
          detail:
            "Your personal key could not be opened. Please enter it again.",
        }),
      );
      throw new Error("Please update your personal Gemini key in Settings.");
    }
  }
  try {
    return await api<T>("ai", {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof Error && "needsKey" in error && error.needsKey)
      window.dispatchEvent(
        new CustomEvent("ai-key-needed", { detail: error.message }),
      );
    throw error;
  }
}

export async function savePersonalAIKey(key: string): Promise<AISettings> {
  const value = key.trim();
  if (!/^[A-Za-z0-9._-]{25,250}$/.test(value))
    throw new Error("Paste a complete Google Gemini API key.");
  await api("ai", {
    method: "POST",
    headers: { "X-Padhai-Gemini-Key": value },
    body: JSON.stringify({ kind: "validate" }),
  });
  return { encryptedKey: await encryptWorkspace(value) };
}
