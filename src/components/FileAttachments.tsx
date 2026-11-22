import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Download, File, Image, Paperclip, Trash2 } from "lucide-react";
import type { Attachment } from "../types";
import {
  attachmentBlob,
  deleteAttachment,
  downloadAttachment,
  saveAttachment,
} from "../lib/attachments";
import { Modal } from "./Modal";
import { t } from "../i18n";

export function FileAttachments({
  files,
  onChange,
  notify,
}: {
  files: Attachment[];
  onChange: Dispatch<SetStateAction<Attachment[]>>;
  notify: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    file: Attachment;
    url: string;
  } | null>(null);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  async function view(file: Attachment) {
    try {
      setPreview({
        file,
        url: URL.createObjectURL(await attachmentBlob(file)),
      });
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not open this attachment.",
      );
    }
  }
  return (
    <div className="attachments">
      <div className="attachment-heading">
        <strong>
          <Paperclip size={17} />
          {t("Files & memories")}
        </strong>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Paperclip size={15} />
          {t(busy ? "Encrypting & saving…" : "Attach a file")}
        </button>
      </div>
      <input
        className="sr-only"
        ref={input}
        type="file"
        aria-label={t("Choose a file to attach")}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            const attachment = await saveAttachment(file);
            onChange((current) => [...current, attachment]);
            notify("Attachment encrypted and saved to your workspace.");
          } catch (error) {
            notify(
              error instanceof Error
                ? error.message
                : "Upload failed. Your note is safe.",
            );
          } finally {
            setBusy(false);
            event.target.value = "";
          }
        }}
      />
      {files.length > 0 && (
        <div className="attachment-list">
          {files.map((file) => (
            <article key={file.id}>
              <span className="attachment-icon">
                {file.mime.startsWith("image/") ? (
                  <Image size={21} />
                ) : (
                  <File size={21} />
                )}
              </span>
              <button
                className="attachment-name"
                onClick={() => void view(file)}
              >
                <strong translate="no">{file.name}</strong>
                <small>
                  {(file.size / 1048576).toFixed(1)} MB ·{" "}
                  {t("Private attachment")}
                </small>
              </button>
              <button
                className="icon-button"
                aria-label={`Download ${file.name}`}
                onClick={() =>
                  void downloadAttachment(file).catch((error) =>
                    notify(error.message),
                  )
                }
              >
                <Download size={16} />
              </button>
              <button
                className="icon-button delete-button"
                aria-label={`Remove ${file.name}`}
                onClick={() => setRemoving(file)}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
      <p className="language-notice">
        {t(
          "PDFs, photos, audio, videos, and other files up to 20 MB each. Files are encrypted before cloud saving. This free workspace includes 50 MB of attachment storage; add links for larger files. Uploads and downloads need an internet connection.",
        )}
      </p>
      {preview && (
        <Modal title={preview.file.name} onClose={() => setPreview(null)} wide>
          <div className="attachment-preview">
            {/^image\/(png|jpeg|gif|webp|avif)$/.test(preview.file.mime) ? (
              <img src={preview.url} alt={preview.file.name} />
            ) : preview.file.mime.startsWith("video/") ? (
              <video src={preview.url} controls playsInline />
            ) : preview.file.mime.startsWith("audio/") ? (
              <audio src={preview.url} controls />
            ) : preview.file.mime === "application/pdf" ? (
              <iframe title={preview.file.name} src={preview.url} />
            ) : (
              <p>{t("Download this file to open it in its own app.")}</p>
            )}
            <a
              className="primary"
              href={preview.url}
              download={preview.file.name}
            >
              <Download size={16} />
              {t("Download file")}
            </a>
          </div>
        </Modal>
      )}
      {removing && (
        <Modal
          title={t("Remove this attachment?")}
          onClose={() => setRemoving(null)}
        >
          <p className="muted">
            {t(
              "Download a copy first if you want to keep it. This removes the encrypted file from your cloud storage.",
            )}
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setRemoving(null)}>
              {t("Keep file")}
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await deleteAttachment(removing);
                  onChange((current) =>
                    current.filter((file) => file.id !== removing.id),
                  );
                  setRemoving(null);
                } catch (error) {
                  notify(
                    error instanceof Error
                      ? error.message
                      : "Could not remove the file. Please retry.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("Remove file")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
