import { t } from "../i18n";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
let openDialogs = 0;
let previousBodyOverflow = "";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  closable = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  closable?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    if (openDialogs === 0) previousBodyOverflow = document.body.style.overflow;
    openDialogs++;
    document.body.style.overflow = "hidden";
    element.showModal();
    const cancel = (event: Event) => {
      event.preventDefault();
      if (closable) closeRef.current();
    };
    element.addEventListener("cancel", cancel);
    return () => {
      element.close();
      element.removeEventListener("cancel", cancel);
      openDialogs--;
      if (openDialogs === 0)
        document.body.style.overflow = previousBodyOverflow;
      previous?.focus({ preventScroll: true });
    };
  }, [closable]);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onClick={(event) => {
        if (closable && event.target === dialog.current) onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="modal-header">
        <h2 id={titleId}>{t(title)}</h2>
        {closable && (
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("Close dialog")}
          >
            <X size={20} />
          </button>
        )}
      </div>
      {t(children)}
    </dialog>
  );
}
