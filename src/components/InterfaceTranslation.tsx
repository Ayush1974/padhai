import { useState } from "react";
import { Languages } from "lucide-react";
import { askAI } from "../lib/ai";
import {
  languages,
  missingInterfacePhrases,
  saveInterfaceTranslations,
  t,
} from "../i18n";

export function InterfaceTranslation({
  language,
  ready,
  notify,
}: {
  language: string;
  ready: boolean;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (language === "en") return null;
  return (
    <div className="interface-translation">
      <Languages size={18} />
      <p>
        <strong>
          {languages.find((value) => value.code === language)?.name}
        </strong>{" "}
        ·{" "}
        {t(
          "Missing labels stay in English. Translate the built-in interface text with AI; your notes, names, messages, and files are never included.",
        )}
      </p>
      <button
        className="secondary"
        disabled={busy || !ready}
        onClick={async () => {
          setBusy(true);
          try {
            const phrases = missingInterfacePhrases();
            if (!phrases.length) {
              notify("All available labels on this page are translated.");
              return;
            }
            for (let offset = 0; offset < phrases.length; offset += 60) {
              const batch = phrases.slice(offset, offset + 60);
              const result = await askAI<{ translations: string[] }>({
                kind: "translate",
                language,
                phrases: batch,
              });
              if (
                !Array.isArray(result.translations) ||
                result.translations.length !== batch.length
              )
                throw new Error(
                  "This translation was incomplete. Please retry.",
                );
              saveInterfaceTranslations(language, batch, result.translations);
            }
            notify(
              "Interface translations saved on this device. You can translate new pages as you visit them.",
            );
          } catch (error) {
            notify(
              error instanceof Error
                ? error.message
                : "Could not translate these labels.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {t(busy ? "Translating labels…" : "Translate interface")}
      </button>
    </div>
  );
}
