import { useState } from "react";
import { Cloud, Copy, Eye, EyeOff } from "lucide-react";
import { t } from "../i18n";
import { getStudyKey } from "../lib/cloud";

export function CloudPanel({
  status,
  conflict,
  resolveConflict,
  notify,
}: {
  status: string;
  conflict: boolean;
  resolveConflict: (cloud: boolean) => Promise<void>;
  notify: (message: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <section className="panel settings-panel cloud-panel">
      <h2><Cloud size={20} /> {t("Cloud backup")}</h2>
      <span className="cloud-status">
        <span className="green-dot" /> {t(status)}
      </span>
      <p className="muted">
        {t("Padhai encrypts your notes and progress in your browser before backing them up. Sign in on another device to open your study space.")}
      </p>
      <details className="study-key-details">
        <summary>{t("Private study backup key")}</summary>
        <p className="key-warning">
          {t("Keep this key somewhere private for study data recovery. Anyone with the key can unlock your study workspace.")}
        </p>
        <div className="key-field">
          <input
            type={visible ? "text" : "password"}
            readOnly
            value={getStudyKey()}
            aria-label={t("Private study backup key")}
          />
          <button
            className="icon-button"
            aria-label={t(visible ? "Hide study key" : "Reveal study key")}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(getStudyKey());
              notify("Private study key copied. Keep it somewhere safe.");
            } catch {
              setVisible(true);
              notify("Reveal the key and copy it manually.");
            }
          }}
        >
          <Copy size={15} /> {t("Copy study backup key")}
        </button>
      </details>
      {conflict && (
        <div className="cloud-conflict">
          <strong>{t("Another device has newer changes.")}</strong>
          <p>{t("Export a backup first if you need to keep both copies. Then choose which workspace to use.")}</p>
          <button className="secondary" onClick={() => void resolveConflict(true)}>
            {t("Load cloud copy")}
          </button>
          <button className="primary" onClick={() => void resolveConflict(false)}>
            {t("Keep this device’s copy")}
          </button>
        </div>
      )}
    </section>
  );
}
