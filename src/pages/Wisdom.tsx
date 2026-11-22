import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, ExternalLink, Leaf, Sparkles } from "lucide-react";
import { LanguagePicker } from "../components/LanguagePicker";
import { t } from "../i18n";
import { askAI } from "../lib/ai";
import { readAPIResponse } from "../lib/cloud";
import { periodStart } from "../lib/plans";
import type { AISettings } from "../types";

type PassageKind = "shloka" | "chaupai";
interface Passage {
  date: string;
  reference: string;
  verse: string;
  source: string;
  lang: string;
}
interface Explanation {
  title: string;
  meaning: string;
  context: string;
  reflection: string;
  practice: string;
}

export function Wisdom({
  language, settings, aiReady, onAct,
}: {
  language: string;
  settings: AISettings;
  aiReady: boolean;
  onAct: () => void;
}) {
  const [kind, setKind] = useState<PassageKind>("shloka");
  const [dayStart, setDayStart] = useState(() => periodStart("daily"));
  const [translationLanguage, setTranslationLanguage] = useState(language);
  const [passages, setPassages] = useState<Record<string, Passage>>({});
  const [explanations, setExplanations] = useState<Record<string, Explanation>>({});
  const [sourceError, setSourceError] = useState("");
  const [explanationError, setExplanationError] = useState("");
  const [retry, setRetry] = useState(0);
  const passageId = [dayStart, kind].join(":");
  const passage = passages[passageId];
  const explanationId = [passageId, translationLanguage, settings.encryptedKey?.iv].join(":");
  const explanation = explanations[explanationId];

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    function refreshDay() {
      clearTimeout(timeout);
      const now = Date.now();
      const midnight = periodStart("daily", now);
      setDayStart(midnight);
      timeout = setTimeout(refreshDay, midnight + 86400000 - now);
    }
    refreshDay();
    document.addEventListener("visibilitychange", refreshDay);
    window.addEventListener("pageshow", refreshDay);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", refreshDay);
      window.removeEventListener("pageshow", refreshDay);
    };
  }, []);

  useEffect(() => setTranslationLanguage(language), [language]);

  useEffect(() => {
    setSourceError("");
    if (passage) return;
    const controller = new AbortController();
    async function loadPassage() {
      try {
        const response = await fetch("/api/wisdom/daily?kind=" + kind, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await readAPIResponse(response);
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted)
          setPassages((current) => ({ ...current, [passageId]: data }));
      } catch (error) {
        if (!controller.signal.aborted)
          setSourceError(error instanceof Error ? error.message : "Could not load the daily passage.");
      }
    }
    void loadPassage();
    return () => controller.abort();
  }, [kind, passageId, passage, retry]);

  useEffect(() => {
    setExplanationError("");
    if (!passage || !aiReady || explanation) return;
    let active = true;
    void askAI<Explanation>({
      kind: "daily-wisdom",
      passageKind: kind,
      date: passage.date,
      language: translationLanguage,
    }, settings)
      .then((result) => {
        if (active) setExplanations((current) => ({ ...current, [explanationId]: result }));
      })
      .catch((error: Error) => {
        if (active) setExplanationError(error.message);
      });
    return () => { active = false; };
  }, [kind, passage, aiReady, translationLanguage, settings, explanationId, explanation, retry]);

  return (
    <>
      <div className="page-intro">
        <div>
          <h1>{t("Wisdom you can put into practice.")}</h1>
          <p>{t("A new shloka and chaupai every day at midnight IST.")}</p>
        </div>
        <span className="live-pill"><BookOpen size={14} /> Heritage IIT Kanpur</span>
      </div>
      <div className="wisdom-tabs">
        <button className={kind === "shloka" ? "active" : ""} aria-pressed={kind === "shloka"} onClick={() => setKind("shloka")}>
          {t("Daily shloka")}
        </button>
        <button className={kind === "chaupai" ? "active" : ""} aria-pressed={kind === "chaupai"} onClick={() => setKind("chaupai")}>
          {t("Daily chaupai")}
        </button>
      </div>
      <div className="wisdom-language-tools">
        <strong>{t("Read the meaning in your language")}</strong>
        <LanguagePicker language={translationLanguage} onChange={setTranslationLanguage} />
      </div>
      {sourceError && <p className="inline-error" role="alert">{t(sourceError)}</p>}
      {!passage && !sourceError && <p role="status">{t("Loading today’s passage…")}</p>}
      {passage && (
        <article className="panel wisdom-article">
          <div className="wisdom-article-heading">
            <span className="eyebrow">{passage.reference}</span>
            <time className="tag" dateTime={passage.date}>{passage.date} IST</time>
          </div>
          <blockquote lang={passage.lang} translate="no">
            {passage.verse.split("\n").map((line, index) => <span key={index}>{line}</span>)}
          </blockquote>
          <a className="wisdom-source" href={passage.source} target="_blank" rel="noreferrer">
            {t("Read the original at Heritage IIT Kanpur")} <ExternalLink size={13} />
          </a>
          {explanation ? (
            <>
              <p className="wisdom-note">{t("AI explanation and study reflection")}</p>
              <h2 lang={translationLanguage} translate="no">{explanation.title}</h2>
              <section>
                <span className="eyebrow">{t("THE MEANING")}</span>
                <p lang={translationLanguage} translate="no">{explanation.meaning}</p>
              </section>
              <section>
                <h3><BookOpen size={18} />{t(" The moment behind the words")}</h3>
                <p lang={translationLanguage} translate="no">{explanation.context}</p>
              </section>
              <section>
                <h3><Leaf size={18} />{t(" What this can mean for your day")}</h3>
                <p lang={translationLanguage} translate="no">{explanation.reflection}</p>
              </section>
              <div className="wisdom-practice">
                <Sparkles size={24} />
                <div>
                  <span className="eyebrow">{t("TURN THE THOUGHT INTO ACTION")}</span>
                  <p lang={translationLanguage} translate="no">{explanation.practice}</p>
                  <button className="primary" onClick={onAct}>
                    {t("Take a two-minute first step ")} <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : explanationError ? (
            <p className="inline-error" role="alert">{t(explanationError)}</p>
          ) : (
            <p role="status">{t(aiReady ? "Preparing your explanation…" : "Waiting for your saved study settings…")}</p>
          )}
        </article>
      )}
      {(sourceError || explanationError) && (
        <button className="secondary" onClick={() => setRetry((current) => current + 1)}>{t("Try again")}</button>
      )}
    </>
  );
}
