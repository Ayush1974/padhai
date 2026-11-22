import { useEffect, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  LogIn,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  accountRequest,
  openStudyKey,
  sealStudyKey,
  switchWorkspace,
  type AccountResult,
  type AccountUser,
} from "../lib/account";
import { getStudyKey } from "../lib/cloud";
import { readStorage } from "../lib/storage";
import { Modal } from "./Modal";
import { t } from "../i18n";

export function AccountAccess({
  open,
  onClose,
  onUser,
  defaultCourse,
  defaultName,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  onUser: (user: AccountUser | null) => void;
  defaultCourse: string;
  defaultName: string;
  notify: (message: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [resetToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get("reset"));
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(
    resetToken !== null ? "reset" : "register",
  );
  const [name, setName] = useState(
    defaultName === "Student" ? "" : defaultName,
  );
  const [courseName, setCourseName] = useState(defaultCourse);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nextWorkspace, setNextWorkspace] = useState<{ key: string; accountId: string }>();
  const [resetSent, setResetSent] = useState(false);
  const [resetReady, setResetReady] = useState(false);
  const [needsStudyKey, setNeedsStudyKey] = useState(false);
  const [studyKey, setStudyKey] = useState("");
  useEffect(() => {
    let alive = true;
    async function restoreSession() {
      if (resetToken !== null) {
        const result = await accountRequest<{ user: AccountUser; needsStudyKey: boolean }>(
          "reset-status", { token: resetToken },
        );
        if (!alive) return;
        setEmail(result.user.email);
        setNeedsStudyKey(result.needsStudyKey);
        if (
          result.needsStudyKey &&
          localStorage.getItem("padhai-device-account") === result.user.id
        ) {
          setStudyKey(readStorage("study-key", ""));
        }
        setResetReady(true);
        return;
      }
      const { user } = await accountRequest<{ user: AccountUser | null }>("session");
      if (!alive || !user) return;
      const deviceAccount = localStorage.getItem("padhai-device-account");
      if (!readStorage("study-key", "") || (deviceAccount && deviceAccount !== user.id)) {
        setMode("login");
        return;
      }
      localStorage.setItem("padhai-device-account", user.id);
      onUser(user);
      onClose();
    }
    void restoreSession()
      .catch((error: Error) => {
        if (alive) setError(error.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function finish(result: AccountResult, login: boolean) {
    if (login) {
      const key = await openStudyKey(password, result.keyVault);
      if (key !== getStudyKey()) {
        setNextWorkspace({ key, accountId: result.user.id });
        return;
      }
    }
    localStorage.setItem("padhai-device-account", result.user.id);
    onUser(result.user);
    setPassword("");
    setCode("");
    setChallenge("");
    onClose();
    notify(
      "You are signed in. Your encrypted study workspace is connected to this account.",
    );
  }
  function clearResetLink() {
    if (location.hash.startsWith("#reset="))
      history.replaceState(null, "", location.pathname + location.search);
  }
  return (
    <>
      {open && (
        <Modal
          title={t(
            challenge
              ? "Verify your email"
              : mode === "forgot"
                ? "Reset your password"
                : mode === "reset"
                  ? "Choose a new password"
              : mode === "register"
                ? "Create your Padhai account"
                : "Welcome back to Padhai",
          )}
          onClose={onClose}
          closable={false}
        >
          <div className="auth-panel">
            <img
              className="onboarding-logo"
              src="/padhai-logo.webp"
              alt="Padhai"
            />
            {loading ? (
              <p role="status">{t("Checking your account…")}</p>
            ) : (
              <>
                {!challenge && (mode === "login" || mode === "register") && (
                  <div className="segmented auth-tabs">
                    <button
                      className={mode === "register" ? "active" : ""}
                      onClick={() => {
                        setMode("register");
                        setError("");
                      }}
                    >
                      {t("Register")}
                    </button>
                    <button
                      className={mode === "login" ? "active" : ""}
                      onClick={() => {
                        setMode("login");
                        setError("");
                      }}
                    >
                      {t("Sign in")}
                    </button>
                  </div>
                )}
                {mode === "forgot" ? (
                  <form onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError("");
                    try {
                      await accountRequest("forgot-password", { email: email.trim() });
                      setResetSent(true);
                    } catch (error) {
                      setError(error instanceof Error ? error.message : "Could not request the reset link.");
                    } finally {
                      setBusy(false);
                    }
                  }}>
                    {resetSent ? (
                      <p role="status">{t("If this email has a Padhai account, a reset link will arrive shortly. Check Spam too. The link expires in 15 minutes.")}</p>
                    ) : (
                      <>
                        <label className="field">
                          {t("Email address")}
                          <input autoFocus required type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                        </label>
                        <button className="primary full-width" disabled={busy}>
                          {t(busy ? "Sending link…" : "Email me a reset link")}
                        </button>
                      </>
                    )}
                    <button type="button" className="text-button" disabled={busy} onClick={() => {
                      setMode("login");
                      setError("");
                    }}>{t("Back to sign in")}</button>
                  </form>
                ) : mode === "reset" ? (
                  <form onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError("");
                    try {
                      const result = await accountRequest<AccountResult>("reset-password", {
                        token: resetToken,
                        password,
                        ...(needsStudyKey ? { studyKey: studyKey.trim() } : {}),
                      });
                      clearResetLink();
                      setMode("login");
                      await finish(result, true);
                    } catch (error) {
                      setError(error instanceof Error ? error.message : "Could not reset your password.");
                    } finally {
                      setBusy(false);
                    }
                  }}>
                    {resetReady && (
                      <>
                        <p>{t("Set a password of at least 10 characters for")} <strong>{email}</strong>.</p>
                        <label className="field">
                          {t("New password")}
                          <span className="password-field">
                            <input autoFocus required type={visible ? "text" : "password"} minLength={10} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                            <button className="icon-button" type="button" aria-label={t(visible ? "Hide password" : "Show password")} aria-pressed={visible} onClick={() => setVisible(!visible)}>
                              {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                            </button>
                          </span>
                        </label>
                        {needsStudyKey && (
                          <label className="field">
                            {t("Private study backup key")}
                            <input required type="password" autoComplete="off" maxLength={71} value={studyKey} onChange={(event) => setStudyKey(event.target.value)} />
                            <small>{t("This older account needs its original study backup key to keep your encrypted notes and progress.")}</small>
                          </label>
                        )}
                        <button className="primary full-width" disabled={busy}>
                          {t(busy ? "Resetting password…" : "Reset password & sign in")}
                        </button>
                      </>
                    )}
                    <button type="button" className="text-button" disabled={busy} onClick={() => {
                      clearResetLink();
                      setMode("login");
                      setPassword("");
                      setError("");
                    }}>{t("Back to sign in")}</button>
                  </form>
                ) : challenge ? (
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setBusy(true);
                      setError("");
                      try {
                        await finish(
                          await accountRequest<AccountResult>("verify", {
                            challengeId: challenge,
                            code,
                          }),
                          false,
                        );
                      } catch (error) {
                        setError(
                          error instanceof Error
                            ? error.message
                            : "Could not verify this code.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <p>
                      <Mail size={17} /> {t("Enter the six-digit code sent to")}{" "}
                      <strong>{email}</strong>.
                    </p>
                    <p className="language-notice">
                      {t(
                        "Sent from info.dasanudas@gmail.com. Check Spam if needed. The code expires in 10 minutes, with at most 5 attempts.",
                      )}
                    </p>
                    <label className="field">
                      {t("Email verification code")}
                      <input
                        autoFocus
                        required
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        value={code}
                        onChange={(event) =>
                          setCode(event.target.value.replace(/\D/g, ""))
                        }
                      />
                    </label>
                    <button
                      className="primary full-width"
                      disabled={busy || code.length !== 6}
                    >
                      <Check size={16} />
                      {t(
                        busy ? "Verifying…" : "Verify email & open my account",
                      )}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        setChallenge("");
                        setCode("");
                        setError("");
                      }}
                    >
                      {t("Change email or request a new code")}
                    </button>
                  </form>
                ) : (
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setBusy(true);
                      setError("");
                      try {
                        if (mode === "register") {
                          const keyVault = await sealStudyKey(password);
                          const result = await accountRequest<{
                            challengeId: string;
                          }>("register", {
                            name: name.trim(),
                            courseName: courseName.trim(),
                            email: email.trim(),
                            password,
                            keyVault,
                          });
                          setChallenge(result.challengeId);
                        } else
                          await finish(
                            await accountRequest<AccountResult>("login", {
                              email: email.trim(),
                              password,
                            }),
                            true,
                          );
                      } catch (error) {
                        setError(
                          error instanceof Error
                            ? error.message
                            : "Could not open your account.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {mode === "register" && (
                      <>
                        <label className="field">
                          {t("Your name")}
                          <input
                            autoFocus
                            required
                            maxLength={40}
                            autoComplete="name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={t("Enter your name or nickname")}
                          />
                        </label>
                        <label className="field">
                          {t("Course or exam name")}
                          <input
                            required
                            maxLength={100}
                            autoComplete="off"
                            value={courseName}
                            onChange={(event) =>
                              setCourseName(event.target.value)
                            }
                            placeholder="GATE CS"
                          />
                        </label>
                      </>
                    )}
                    <label className="field">
                      {t("Email address")}
                      <input
                        required
                        type="email"
                        maxLength={254}
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      {t("Password")}
                      <span className="password-field">
                        <input
                          required
                          type={visible ? "text" : "password"}
                          minLength={mode === "register" ? 10 : 1}
                          maxLength={128}
                          autoComplete={
                            mode === "register"
                              ? "new-password"
                              : "current-password"
                          }
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={t(
                            visible ? "Hide password" : "Show password",
                          )}
                          aria-pressed={visible}
                          onClick={() => setVisible((value) => !value)}
                        >
                          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                        </button>
                      </span>
                    </label>
                    {mode === "register" && (
                      <p className="language-notice">
                        {t(
                          "Use at least 10 characters. Your current study workspace will be linked to this account after email verification. Keep your private study key from Settings as a recovery copy.",
                        )}
                      </p>
                    )}
                    <button
                      className="primary full-width"
                      disabled={
                        busy ||
                        (mode === "register" &&
                          (!name.trim() || !courseName.trim()))
                      }
                    >
                      <LogIn size={16} />
                      {t(
                        busy
                          ? "Opening securely…"
                          : mode === "register"
                            ? "Send verification code"
                            : "Sign in to my study space",
                      )}
                    </button>
                    {mode === "login" && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          setMode("forgot");
                          setPassword("");
                          setResetSent(false);
                          setError("");
                        }}
                      >
                        {t("Forgot password?")}
                      </button>
                    )}
                  </form>
                )}
                {error && (
                  <p className="inline-error" role="alert">
                    {t(error)}
                  </p>
                )}
                <p className="language-notice">
                  {t(
                    "Your study data is encrypted. Keep a private study backup key in case you ever need to recover an older workspace.",
                  )}
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
      {nextWorkspace && (
        <Modal
          title={t("Open your account’s study workspace?")}
          onClose={() => {
            void accountRequest("logout", {}).finally(() => setNextWorkspace(undefined));
          }}
        >
          <p>
            {t(
              "Signing in will replace the workspace displayed on this device with your saved account workspace. Export the current workspace in Settings first if you want a separate copy.",
            )}
          </p>
          <div className="modal-actions">
            <button
              className="secondary"
              onClick={() => {
                void accountRequest("logout", {}).finally(() =>
                  setNextWorkspace(undefined),
                );
              }}
            >
              {t("Keep current workspace for now")}
            </button>
            <button
              className="primary"
              onClick={() => switchWorkspace(nextWorkspace.key, nextWorkspace.accountId)}
            >
              {t("Open my account workspace")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AccountSummary({
  user,
  canSignOut,
  notify,
}: {
  user: AccountUser;
  canSignOut: boolean;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel settings-panel account-panel">
      <h2>
        <UserRound size={21} />
        {t("My account")}
      </h2>
      {user ? (
        <>
          <p>
            <strong>{user.name}</strong>
            <br />
            {user.email}
            <br />
            {user.courseName}
          </p>
          <p className="ai-key-status">
            <ShieldCheck size={16} />
            {t("Email verified · encrypted workspace")}
          </p>
          <button
            className="secondary"
            disabled={!canSignOut || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await accountRequest("logout", {});
                sessionStorage.removeItem("padhai-auth-dismissed");
                localStorage.removeItem("padhai-study-key");
                switchWorkspace(
                  `padhai_${Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, "0")).join("")}`,
                );
              } catch (error) {
                notify(
                  error instanceof Error
                    ? error.message
                    : "Could not sign out.",
                );
                setBusy(false);
              }
            }}
          >
            {t("Sign out on this device")}
          </button>
          {!canSignOut && (
            <p className="language-notice">
              {t(
                "Wait for cloud saving to finish before signing out, so your latest changes are kept.",
              )}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="muted">
            {t(
              "Use email and a password to open the same encrypted study workspace on another device.",
            )}
          </p>
          <button className="primary" onClick={() => location.reload()}>
            <LogIn size={16} />
            {t("Sign in or create account")}
          </button>
        </>
      )}
    </section>
  );
}
