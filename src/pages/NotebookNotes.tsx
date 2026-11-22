import { useState, type Dispatch, type SetStateAction } from "react";
import {
  BookOpen,
  Download,
  FolderPlus,
  NotebookPen,
  Pencil,
  Plus,
  Save,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Note, Notebook } from "../types";
import { createNoteLink, openNoteLink } from "../lib/noteShare";
import { deleteAttachment } from "../lib/attachments";
import { FileAttachments } from "../components/FileAttachments";
import { Modal } from "../components/Modal";
import { t } from "../i18n";

export function NotebookNotes({
  notes,
  setNotes,
  notebooks,
  setNotebooks,
  notify,
  onAI,
  onSave,
  saveStatus,
}: {
  notes: Note[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  notebooks: Notebook[];
  setNotebooks: Dispatch<SetStateAction<Notebook[]>>;
  notify: (message: string) => void;
  onAI: (text: string) => void;
  onSave: () => void;
  saveStatus: string;
}) {
  const [bookId, setBookId] = useState("all");
  const [activeId, setActiveId] = useState("");
  const [search, setSearch] = useState("");
  const [bookForm, setBookForm] = useState<Notebook | null>(null);
  const [bookName, setBookName] = useState("");
  const [deletingBook, setDeletingBook] = useState<Notebook | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);
  const [sharing, setSharing] = useState<Note | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [incomingLink, setIncomingLink] = useState(() => {
    const url = new URL(location.href);
    return url.searchParams.has("share") ? url : null;
  });
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [exporting, setExporting] = useState(false);
  const visible = notes
    .filter(
      (note) =>
        (bookId === "all" || (note.notebookId || "inbox") === bookId) &&
        `${note.title} ${note.body}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const active = notes.find((note) => note.id === activeId);
  function update(id: string, changes: Partial<Note>) {
    setNotes((current) =>
      current.map((note) =>
        note.id === id ? { ...note, ...changes, updatedAt: Date.now() } : note,
      ),
    );
  }
  function add() {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      notebookId: bookId === "all" ? "inbox" : bookId,
      updatedAt: Date.now(),
      attachments: [],
    };
    setNotes((current) => [note, ...current]);
    setActiveId(note.id);
  }
  function closeImport() {
    const url = new URL(location.href);
    url.searchParams.delete("share");
    if (url.hash.startsWith("#note-key=")) url.hash = "";
    history.replaceState(null, "", url);
    setIncomingLink(null);
    setLinkError("");
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">{t("A HOME FOR EVERYTHING YOU LEARN")}</div>
          <h1>{t("My notebooks & notes")}</h1>
          <p>
            {t(
              "Keep chapters, PDFs, photos, and ideas together. Your changes save as you write.",
            )}
          </p>
        </div>
        <button className="primary" onClick={add}>
          <Plus size={17} />
          {t("New note")}
        </button>
      </div>
      <div className="notebook-toolbar">
        <label className="field">
          <span>{t("Notebook")}</span>
          <select
            value={bookId}
            onChange={(event) => {
              setBookId(event.target.value);
              setActiveId("");
            }}
          >
            <option value="all">{t("All notebooks")}</option>
            <option value="inbox">{t("Inbox")}</option>
            {notebooks.map((book) => (
              <option key={book.id} value={book.id}>
                {book.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          onClick={() => {
            setBookName("");
            setBookForm({ id: "", name: "" });
          }}
        >
          <FolderPlus size={16} />
          {t("New notebook")}
        </button>
        {notebooks.find((book) => book.id === bookId) && (
          <>
            <button
              className="icon-button bordered"
              aria-label={t("Rename notebook")}
              onClick={() => {
                const book = notebooks.find((value) => value.id === bookId)!;
                setBookForm(book);
                setBookName(book.name);
              }}
            >
              <Pencil size={17} />
            </button>
            <button
              className="icon-button bordered delete-button"
              aria-label={t("Delete notebook")}
              onClick={() =>
                setDeletingBook(notebooks.find((book) => book.id === bookId)!)
              }
            >
              <Trash2 size={17} />
            </button>
          </>
        )}
        <label className="notes-search">
          <Search size={17} />
          <input
            aria-label={t("Search notes")}
            placeholder={t("Find a note…")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <section className="panel notebook-workspace">
        <aside className="notebook-note-list" aria-label={t("Your notes")}>
          <div className="notebook-list-heading">
            <BookOpen size={17} />
            <strong>
              {visible.length} {t("notes")}
            </strong>
          </div>
          {visible.map((note) => (
            <button
              key={note.id}
              className={activeId === note.id ? "active" : ""}
              onClick={() => setActiveId(note.id)}
            >
              <strong translate="no">{note.title || t("Untitled note")}</strong>
              <span translate="no">
                {note.body.slice(0, 75) || t("A fresh page…")}
              </span>
              <small>
                {new Date(note.updatedAt).toLocaleDateString("en-IN")} ·{" "}
                {note.attachments?.length || 0} {t("files")}
              </small>
            </button>
          ))}
          {!visible.length && (
            <p className="muted notebook-empty">
              {t("No notes here yet. Create a note to begin.")}
            </p>
          )}
        </aside>
        <div className="notebook-editor">
          {active ? (
            <>
              <div className="note-toolbar">
                <span role="status">{t(saveStatus)}</span>
                <div>
                  <button className="primary" onClick={onSave}>
                    <Save size={16} /> {t("Save note")}
                  </button>
                  <button
                    className="secondary"
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        const { downloadNotePdf } = await import("../lib/notePdf");
                        await downloadNotePdf(active, t("Untitled note"));
                      } catch {
                        notify("Could not download the PDF. Please try again.");
                      } finally {
                        setExporting(false);
                      }
                    }}
                  >
                    <Download size={16} /> {t(exporting ? "Preparing PDF…" : "Download PDF")}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setShareLink("");
                      setLinkError("");
                      setSharing(active);
                    }}
                  >
                    <Share2 size={16} /> {t("Share note")}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={t("Ask AI about this note")}
                    onClick={() =>
                      onAI(
                        `Explain and summarize this study note, then suggest a short revision exercise.\n\n${active.title}\n${active.body}`,
                      )
                    }
                  >
                    <Sparkles size={17} />
                  </button>
                  <button
                    className="icon-button delete-button"
                    aria-label={t("Delete this note")}
                    onClick={() => setDeletingNote(true)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
              <label className="field notebook-move">
                {t("Save in notebook")}
                <select
                  aria-label={t("Move note to notebook")}
                  value={active.notebookId || "inbox"}
                  onChange={(event) =>
                    update(active.id, { notebookId: event.target.value })
                  }
                >
                  <option value="inbox">{t("Inbox")}</option>
                  {notebooks.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.name}
                    </option>
                  ))}
                </select>
              </label>
              <input
                className="note-title"
                maxLength={100}
                aria-label={t("Note title")}
                placeholder={t("Give this thought a title")}
                value={active.title}
                onChange={(event) =>
                  update(active.id, { title: event.target.value })
                }
              />
              <textarea
                className="notebook-text"
                rows={12}
                maxLength={100000}
                aria-label={t("Note text")}
                placeholder={t("Write, paste a link, or attach a PDF below…")}
                value={active.body}
                onChange={(event) =>
                  update(active.id, { body: event.target.value })
                }
              />
              <FileAttachments
                key={active.id}
                files={active.attachments || []}
                onChange={(change) =>
                  setNotes((current) =>
                    current.map((note) =>
                      note.id === active.id
                        ? {
                            ...note,
                            updatedAt: Date.now(),
                            attachments:
                              typeof change === "function"
                                ? change(note.attachments || [])
                                : change,
                          }
                        : note,
                    ),
                  )
                }
                notify={notify}
              />
              <p className="language-notice">
                {t(
                  "AI only receives note text after you press Ask. Attached files stay private unless you explicitly choose an AI upload.",
                )}
              </p>
            </>
          ) : (
            <div className="empty-state">
              <NotebookPen size={44} />
              <h2>{t("A place for your next idea.")}</h2>
              <p>{t("Open a note or start a fresh page.")}</p>
              <button className="secondary" onClick={add}>
                <Plus size={16} />
                {t("Create a note")}
              </button>
            </div>
          )}
        </div>
      </section>
      {sharing && (
        <Modal title={t("Share this note")} closable={!linkBusy} onClose={() => setSharing(null)}>
          <p>{t("Any signed-in Padhai user with the full link can import a copy of this note’s title and text. Attached files stay private.")}</p>
          {shareLink ? (
            <>
              <label className="field">
                {t("Share link")}
                <input value={shareLink} readOnly onFocus={(event) => event.target.select()} />
              </label>
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                    notify("Note link copied.");
                  } catch {
                    setLinkError("Select the link above and copy it manually.");
                  }
                }}
              >
                {t("Copy link")}
              </button>
            </>
          ) : (
            <button
              className="primary"
              disabled={linkBusy}
              onClick={async () => {
                setLinkBusy(true);
                setLinkError("");
                try {
                  setShareLink(await createNoteLink(sharing));
                } catch (error) {
                  setLinkError(error instanceof Error ? error.message : "Could not create the note link.");
                } finally {
                  setLinkBusy(false);
                }
              }}
            >
              {t(linkBusy ? "Creating link…" : "Create share link")}
            </button>
          )}
          {linkError && <p role="alert" className="inline-error">{t(linkError)}</p>}
        </Modal>
      )}
      {incomingLink && (
        <Modal title={t("Import a shared note")} closable={!linkBusy} onClose={closeImport}>
          <p>{t("Add an editable copy of the shared note to your Inbox.")}</p>
          <button
            className="primary"
            disabled={linkBusy}
            onClick={async () => {
              setLinkBusy(true);
              setLinkError("");
              try {
                const note = await openNoteLink(incomingLink);
                setNotes((current) =>
                  current.some((item) => item.id === note.id) ? current : [note, ...current],
                );
                setBookId("all");
                setSearch("");
                setActiveId(note.id);
                closeImport();
                onSave();
              } catch (error) {
                setLinkError(error instanceof Error ? error.message : "Could not import the note.");
              } finally {
                setLinkBusy(false);
              }
            }}
          >
            {t(linkBusy ? "Importing note…" : "Import note")}
          </button>
          {linkError && <p role="alert" className="inline-error">{t(linkError)}</p>}
        </Modal>
      )}
      {bookForm && (
        <Modal
          title={t(bookForm.id ? "Rename notebook" : "Create a notebook")}
          onClose={() => setBookForm(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const book = {
                id: bookForm.id || crypto.randomUUID(),
                name: bookName.trim(),
              };
              setNotebooks((current) =>
                bookForm.id
                  ? current.map((item) => (item.id === book.id ? book : item))
                  : [...current, book],
              );
              setBookId(book.id);
              setBookForm(null);
            }}
          >
            <label className="field">
              {t("Notebook name")}
              <input
                autoFocus
                required
                maxLength={100}
                value={bookName}
                onChange={(event) => setBookName(event.target.value)}
                placeholder="GATE CS · Operating Systems"
              />
            </label>
            <button className="primary" disabled={!bookName.trim()}>
              {t("Save notebook")}
            </button>
          </form>
        </Modal>
      )}
      {deletingBook && (
        <Modal
          title={t("Remove this notebook?")}
          onClose={() => setDeletingBook(null)}
        >
          <p>
            {t(
              "Its notes and attachments will move to Inbox, so your study material is kept.",
            )}
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setDeletingBook(null)}>
              {t("Keep notebook")}
            </button>
            <button
              className="danger"
              onClick={() => {
                setNotes((current) =>
                  current.map((note) =>
                    note.notebookId === deletingBook.id
                      ? { ...note, notebookId: "inbox" }
                      : note,
                  ),
                );
                setNotebooks((current) =>
                  current.filter((book) => book.id !== deletingBook.id),
                );
                setBookId("inbox");
                setDeletingBook(null);
              }}
            >
              {t("Remove notebook")}
            </button>
          </div>
        </Modal>
      )}
      {deletingNote && active && (
        <Modal
          title={t("Delete this note and its files?")}
          onClose={() => setDeletingNote(false)}
        >
          <p>
            {t(
              "Download a copy first if you want to keep it. This removes the note and its attachments from this workspace.",
            )}
          </p>
          <div className="modal-actions">
            <button
              className="secondary"
              onClick={() => setDeletingNote(false)}
            >
              {t("Keep note")}
            </button>
            <button
              className="danger"
              onClick={() => {
                const files = active.attachments || [];
                setNotes((current) =>
                  current.filter((note) => note.id !== active.id),
                );
                setActiveId("");
                setDeletingNote(false);
                void Promise.all(files.map(deleteAttachment)).catch(() =>
                  notify(
                    "Note removed. Some cloud files could not be cleaned up; contact the app owner if storage remains full.",
                  ),
                );
              }}
            >
              {t("Delete note")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
