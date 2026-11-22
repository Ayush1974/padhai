import { useState } from "react";
import { FileUp, Sparkles } from "lucide-react";
import { askAI } from "../lib/ai";
import { fileBase64 } from "../lib/attachments";
import { t } from "../i18n";

export interface SyllabusDraft {
  examName: string;
  warning: string;
  subjects: { name: string; topics: string[] }[];
}
export function SyllabusUpload({
  language,
  onRead,
}: {
  language: string;
  onRead: (draft: SyllabusDraft, file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="syllabus-upload">
      <h3>
        <FileUp size={21} />
        {t("Start with your own syllabus PDF")}
      </h3>
      <p className="muted">
        {t(
          "Choose a PDF up to 2 MB. Gemini reads this document only after you press Read PDF. Review the extracted subjects and topics before saving; AI can miss details.",
        )}
      </p>
      <label className="field">
        {t("Your syllabus PDF")}
        <input
          type="file"
          accept="application/pdf,.pdf"
          aria-label={t("Upload syllabus PDF")}
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setError("");
          }}
        />
      </label>
      <button
        className="primary"
        disabled={!file || busy}
        onClick={async () => {
          if (!file) return;
          setBusy(true);
          setError("");
          try {
            if (
              file.size > 2_097_152 ||
              !file.name.toLowerCase().endsWith(".pdf")
            )
              throw new Error(
                "Choose a PDF up to 2 MB. You can paste a larger syllabus as an outline below, and keep the original PDF in Notes.",
              );
            const result = await askAI<SyllabusDraft>({
              kind: "syllabus",
              language,
              pdf: await fileBase64(file),
            });
            if (!Array.isArray(result.subjects))
              throw new Error(
                "No readable outline was returned. Try another PDF or paste an outline.",
              );
            const subjects = result.subjects
              .filter(
                (subject) =>
                  subject &&
                  typeof subject.name === "string" &&
                  Array.isArray(subject.topics),
              )
              .slice(0, 40)
              .map((subject) => ({
                name: subject.name.slice(0, 100),
                topics: subject.topics
                  .filter((topic) => typeof topic === "string")
                  .slice(0, 220)
                  .map((topic) => topic.slice(0, 200)),
              }));
            if (!subjects.length)
              throw new Error(
                result.warning ||
                  "No readable subjects were found. Paste your outline below.",
              );
            onRead(
              {
                examName:
                  typeof result.examName === "string"
                    ? result.examName.slice(0, 100)
                    : "",
                warning:
                  typeof result.warning === "string" ? result.warning : "",
                subjects,
              },
              file,
            );
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not read this PDF.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Sparkles size={16} />
        {t(busy ? "Reading your syllabus…" : "Read PDF with AI")}
      </button>
      {error && (
        <p className="inline-error" role="alert">
          {t(error)}
        </p>
      )}
    </section>
  );
}
