import { useState } from "react";
import {
  Check,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { AISettings as Settings } from "../types";
import { savePersonalAIKey } from "../lib/ai";
import { t } from "../i18n";

export function AISettings({
  settings,
  onChange,
  notify,
  message = "",
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  notify: (message: string) => void;
  message?: string;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="panel settings-panel personal-ai-panel">
      <h2>
        <KeyRound size={21} />
        {t("Personal Gemini API key")}
      </h2>
      <span className="ai-key-status">
        <ShieldCheck size={15} />
        {t(
          settings.encryptedKey
            ? "Using your personal Gemini key"
            : "Using the shared free AI allowance",
        )}
      </span>
      {message && <p className="inline-error">{t(message)}</p>}
      <p className="muted">
        {t(
          "Get an API key in Google AI Studio using your Google account. Padhai encrypts it when you save it and uses your Google quota for your Gemini requests.",
        )}
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            onChange(await savePersonalAIKey(key));
            setKey("");
            notify(
              "Your personal Gemini key is saved. Gemini requests will use your Google quota.",
            );
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not save this key.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          {t(
            settings.encryptedKey
              ? "Replace your personal key"
              : "Google Gemini API key",
          )}
          <input
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            required
            minLength={25}
            maxLength={250}
            autoComplete="new-password"
            placeholder="Paste your Gemini key"
          />
        </label>
        {error && (
          <p className="inline-error" role="alert">
            {t(error)}
          </p>
        )}
        <button className="primary" disabled={busy || !key.trim()}>
          <Check size={16} />
          {t(busy ? "Validating securely…" : "Save Gemini API key")}
        </button>
        {settings.encryptedKey && (
          <button
            className="text-button remove-key"
            type="button"
            onClick={() => {
              onChange({});
              notify(
                "Your personal key is removed from this workspace. Shared AI will be used when available.",
              );
            }}
          >
            <Trash2 size={14} />
            {t("Remove my key")}
          </button>
        )}
      </form>
      <a
        className="source-link"
        href="https://aistudio.google.com/api-keys"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("Get a Gemini key from Google AI Studio")}
        <ExternalLink size={13} />
      </a>
      <p className="language-notice">
        {t(
          "Google’s free quota and terms apply. Your key is not unlimited; this app does not enable billing or paid upgrades. Only the content you choose for AI is sent to Gemini. Google may use free-tier content to improve its products.",
        )}
      </p>
    </section>
  );
}
