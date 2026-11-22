import { t } from "../i18n";
import { languages } from "../i18n";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bell,
  BookMarked,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Download,
  FileText,
  Flame,
  Globe2,
  GraduationCap,
  Leaf,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trash2,
  Upload,
  Wifi,
} from "lucide-react";
import { resources } from "../data";
import {
  durationLabel,
  indiaDate,
  studyStreak,
  validateBackup,
  type Backup,
} from "../lib/study";
import { downloadFile } from "../lib/storage";
import type { Note, Profile, Session, Task } from "../types";
import { Modal } from "../components/Modal";
export function Resources() {
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            {t("GREAT RESOURCES. ZERO PAYWALLS HERE.")}
          </div>
          <h1>{t("A little help along the way.")}</h1>
          <p>{t("Official learning resources for your next chapter.")}</p>
        </div>
        <span className="live-pill">
          <ShieldCheck size={14} />
          {t(" Official sources")}
        </span>
      </div>
      <div className="resource-hero">
        <div>
          <span className="eyebrow">{t("KNOWLEDGE IS FOR EVERYONE")}</span>
          <h2>
            {t("Your ambition shouldn\u2019t")}
            <br />
            {t("need a subscription.")}
          </h2>
          <p>
            {t("Start with the foundations. Learn from the source.")}
            <br />
            {t("Find the resources that work for you.")}
          </p>
        </div>
        <div className="resource-art">
          <BookOpen size={100} strokeWidth={0.8} />
          <Sparkles size={27} />
          <GraduationCap size={58} strokeWidth={1} />
        </div>
      </div>
      <div className="resource-grid">
        {t(
          resources.map((resource) => {
            const Icon =
              resource.icon === "book"
                ? BookOpen
                : resource.icon === "globe"
                  ? Globe2
                  : resource.icon === "cap"
                    ? GraduationCap
                    : FileText;
            return (
              <a
                className="panel resource-card"
                key={resource.name}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div>
                  <span
                    className={`stat-icon ${resource.color === "orange" ? "peach" : resource.color === "green" ? "sage" : resource.color === "purple" ? "lavender" : "butter"}`}
                  >
                    <Icon size={23} />
                  </span>
                  <ArrowUpRight size={20} />
                </div>
                <h2>{t(resource.name)}</h2>
                <p>{t(resource.description)}</p>
                <span className="tag">{t(resource.tag)}</span>
              </a>
            );
          }),
        )}
      </div>
      <p className="resource-disclaimer">
        <ShieldCheck size={15} />
        {t(
          " External resources have their own terms. Learning content is free to access; optional exams or certificates may cost extra.",
        )}
      </p>
    </>
  );
}
