import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import { database } from "./db.mjs";
import { addEmailRecovery, recoverStudyKey, resetKeyVault } from "./key-recovery.mjs";

const derivePassword = promisify(scrypt);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const cookieName = "padhai_session";
const sessionLength = 30 * 86400000;
export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await derivePassword(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 67108864,
  });
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  if (
    typeof password !== "string" ||
    password.length > 128 ||
    typeof stored !== "string"
  )
    return false;
  const [algorithm, salt, expected] = stored.split(":");
  if (
    algorithm !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(expected)
  )
    return false;
  const actual = await derivePassword(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 67108864,
  });
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

async function limit(request, action, email, maximum) {
  const address = process.env.VERCEL
    ? String(request.headers["x-forwarded-for"] || "").split(",")[0]
    : request.socket?.remoteAddress || "local";
  const window = Math.floor(Date.now() / 900000);
  for (const identity of [address, email].filter(Boolean)) {
    const id = `auth:${action}:${hash(identity)}:${window}`;
    const rows = await database(
      "INSERT INTO request_limits (id, count, expires_at) VALUES (?, 1, ?) ON CONFLICT (id) DO UPDATE SET count = request_limits.count + 1 WHERE request_limits.count < ? RETURNING count",
      [id, Date.now() + 900000, identity === address ? maximum * 5 : maximum],
    );
    if (!rows.length)
      throw fail(
        "Too many attempts. Please wait 15 minutes and try again.",
        429,
      );
  }
}

function setCookie(response, token, maxAge) {
  response.setHeader(
    "Set-Cookie",
    `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.VERCEL ? "; Secure" : ""}`,
  );
}
export async function sessionUser(request) {
  const token = String(request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [user] = await database(
    "SELECT users.* FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id WHERE auth_sessions.id = ? AND auth_sessions.expires_at > ?",
    [hash(token), Date.now()],
  );
  return user || null;
}
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    courseName: user.course_name,
  };
}
async function signedIn(response, user) {
  const token = randomBytes(32).toString("hex");
  const created = await database(
    "INSERT INTO auth_sessions (id, user_id, expires_at) SELECT ?, id, ? FROM users WHERE id = ? AND password_hash = ? RETURNING id",
    [hash(token), Date.now() + sessionLength, user.id, user.password_hash],
  );
  if (!created.length) throw fail("Your password changed. Please sign in again.", 409);
  setCookie(response, token, sessionLength / 1000);
  const { salt, iv, encrypted } = JSON.parse(user.key_vault);
  return { user: publicUser(user), keyVault: { salt, iv, encrypted } };
}

export function otpEmail(code) {
  return {
    from: `Padhai <${process.env.SMTP_USER || "info.dasanudas@gmail.com"}>`,
    subject: "Your Padhai verification code",
    text: `Your Padhai verification code is ${code}.\n\nIt expires in 10 minutes. Never share this code. If you did not request a Padhai account, you can ignore this email.\n\nBuilt with ❤️ by Ayush Mishra`,
  };
}

async function sendAccountEmail(email, mail) {
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || "info.dasanudas@gmail.com",
      pass: process.env.SMTP_PASS.replace(/\s/g, ""),
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    await transport.sendMail({ ...mail, to: email });
  } catch (error) {
    console.error("Padhai email delivery:", error.code || "unknown", error.responseCode || "");
    throw error;
  } finally {
    transport.close();
  }
}

async function readReset(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw fail("This password reset link is invalid or expired.");
  const [user] = await database(
    "SELECT users.* FROM auth_resets JOIN users ON users.id = auth_resets.user_id WHERE auth_resets.id = ? AND auth_resets.expires_at > ?",
    [hash(token), Date.now()],
  );
  if (!user) throw fail("This password reset link is invalid or expired.");
  return user;
}

export async function authRequest(request, response, path, data) {
  const allowedOrigins = [
    `https://${request.headers.host}`,
    `http://${request.headers.host}`,
  ];
  if (!process.env.VERCEL)
    allowedOrigins.push("http://127.0.0.1:4173", "http://localhost:4173");
  if (
    request.headers.origin &&
    !allowedOrigins.includes(request.headers.origin)
  )
    throw fail("Please open Padhai directly to manage your account.", 403);
  if (path === "auth/session" && request.method === "GET") {
    const user = await sessionUser(request);
    return { user: user ? publicUser(user) : null };
  }
  if (request.method !== "POST")
    throw fail("This account action is not available.", 405);
  if (path === "auth/logout") {
    const token = String(request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    if (token)
      await database("DELETE FROM auth_sessions WHERE id = ?", [hash(token)]);
    setCookie(response, "", 0);
    return { signedOut: true };
  }
  if (path === "auth/login") {
    const email = normalizeEmail(data.email);
    await limit(request, "login", email, 15);
    const [user] = await database("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    // Use the same slow password derivation for unknown addresses to reduce account discovery.
    const stored =
      user?.password_hash ||
      "scrypt:00000000000000000000000000000000:" + "00".repeat(64);
    if (!(await verifyPassword(data.password, stored)) || !user)
      throw fail("Email or password is incorrect.", 401);
    const vault = JSON.parse(user.key_vault);
    const updatedVault = await addEmailRecovery(vault, data.password, user.email);
    if (updatedVault !== vault)
      await database(
        "UPDATE users SET key_vault = ? WHERE id = ? AND password_hash = ?",
        [JSON.stringify(updatedVault), user.id, user.password_hash],
      );
    return signedIn(response, user);
  }
  if (path === "auth/forgot-password") {
    const email = normalizeEmail(data.email);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw fail("Enter a valid email address.");
    if (!process.env.SMTP_PASS)
      throw fail("Password reset email is temporarily unavailable.", 503);
    await limit(request, "password-reset", email, 3);
    const [user] = await database("SELECT id FROM users WHERE email = ?", [email]);
    if (user) {
      const token = randomBytes(32).toString("hex");
      await database(
        "INSERT INTO auth_resets (id, user_id, expires_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET id = excluded.id, expires_at = excluded.expires_at",
        [hash(token), user.id, Date.now() + 900000],
      );
      const origin = process.env.PADHAI_PUBLIC_URL ||
        (process.env.VERCEL ? "https://padhai-gamma.vercel.app" : "http://127.0.0.1:4173");
      const link = new URL(`/#reset=${token}`, origin).href;
      try {
        await sendAccountEmail(email, {
          from: otpEmail("").from,
          subject: "Reset your Padhai password",
          text: `Open this link to choose a new password and sign in:\n\n${link}\n\nThis link expires in 15 minutes and works once. If you did not request it, you can ignore this email.`,
        });
      } catch {
        await database("DELETE FROM auth_resets WHERE id = ?", [hash(token)]);
      }
    }
    return { requested: true };
  }
  if (path === "auth/reset-status" || path === "auth/reset-password") {
    await limit(request, "open-reset", "", 12);
    const user = await readReset(data.token);
    const vault = JSON.parse(user.key_vault);
    if (path === "auth/reset-status")
      return { user: publicUser(user), needsStudyKey: !recoverStudyKey(vault, user.email) };
    if (typeof data.password !== "string" || data.password.length < 10 || data.password.length > 128)
      throw fail("Use a password of 10–128 characters.");
    let studyKey = recoverStudyKey(vault, user.email);
    if (!studyKey) {
      if (typeof data.studyKey !== "string" || !/^padhai_[a-f0-9]{64}$/.test(data.studyKey))
        throw fail("Enter the private study key from your original workspace.");
      const [workspace] = await database(
        "SELECT id FROM workspaces WHERE token_hash = ?",
        [hash(hash(`authentication:${data.studyKey}`))],
      );
      if (!workspace) throw fail("No workspace was found for this private study key.");
      studyKey = data.studyKey;
    }
    const keyVault = await resetKeyVault(studyKey, data.password, user.email);
    const passwordHash = await hashPassword(data.password);
    const claimed = await database(
      "DELETE FROM auth_resets WHERE id = ? AND expires_at > ? RETURNING id",
      [hash(data.token), Date.now()],
    );
    if (!claimed.length) throw fail("This password reset link is invalid or expired.");
    const [updated] = await database(
      "UPDATE users SET password_hash = ?, key_vault = ? WHERE id = ? AND password_hash = ? RETURNING *",
      [passwordHash, JSON.stringify(keyVault), user.id, user.password_hash],
    );
    if (!updated) throw fail("Your password changed. Please request a new reset link.", 409);
    await database("DELETE FROM auth_sessions WHERE user_id = ?", [user.id]);
    return signedIn(response, updated);
  }
  if (path === "auth/register") {
    if (!process.env.SMTP_PASS)
      throw fail(
        "Email registration is not available yet. The app owner must configure Gmail SMTP_PASS in Vercel. Your private study workspace is still available.",
        503,
      );
    const email = normalizeEmail(data.email);
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      typeof data.name !== "string" ||
      !data.name.trim() ||
      data.name.length > 40 ||
      typeof data.courseName !== "string" ||
      !data.courseName.trim() ||
      data.courseName.length > 100 ||
      typeof data.password !== "string" ||
      data.password.length < 10 ||
      data.password.length > 128
    )
      throw fail(
        "Enter your name, course, a valid email, and a password of 10–128 characters.",
      );
    const vault = data.keyVault;
    if (
      !vault ||
      typeof vault.encrypted !== "string" ||
      !/^[A-Za-z0-9+/=]{80,500}$/.test(vault.encrypted) ||
      !/^[A-Za-z0-9+/=]{16}$/.test(vault.iv) ||
      !/^[A-Za-z0-9+/=]{24}$/.test(vault.salt)
    )
      throw fail(
        "Your encrypted study key is incomplete. Please reload and retry.",
      );
    await limit(request, "register", email, 5);
    const [existing] = await database("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existing)
      throw fail("An account already uses this email. Please sign in.", 409);
    const id = randomUUID();
    const code = String(randomInt(100000, 1000000));
    const passwordHash = await hashPassword(data.password);
    let recoverableVault;
    try {
      const { encrypted, iv, salt } = vault;
      recoverableVault = await addEmailRecovery({ encrypted, iv, salt }, data.password, email);
    } catch {
      throw fail("Your encrypted study key could not be verified. Please reload and retry.");
    }
    await database(
      "DELETE FROM auth_challenges WHERE email = ? OR expires_at < ?",
      [email, Date.now()],
    );
    await database(
      "INSERT INTO auth_challenges (id, email, name, course_name, password_hash, key_vault, otp_hash, attempts, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
      [
        id,
        email,
        data.name.trim(),
        data.courseName.trim(),
        passwordHash,
        JSON.stringify(recoverableVault),
        hash(`${id}:${code}`),
        Date.now() + 600000,
      ],
    );
    try {
      await sendAccountEmail(email, otpEmail(code));
    } catch (error) {
      await database("DELETE FROM auth_challenges WHERE id = ?", [id]);
      throw fail(
        error.code === "EAUTH"
          ? "Gmail rejected the email sender credentials. The app owner must replace SMTP_PASS with the 16-character App Password for info.dasanudas@gmail.com, then redeploy."
          : "The verification email could not be sent. Please retry shortly; the app owner may need to check the Gmail App Password.",
        502,
      );
    }
    return { challengeId: id, expiresIn: 600 };
  }
  if (path === "auth/verify") {
    if (
      typeof data.challengeId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(data.challengeId) ||
      typeof data.code !== "string" ||
      !/^\d{6}$/.test(data.code)
    )
      throw fail("Enter the six-digit verification code.");
    const [challenge] = await database(
      "UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = ? AND attempts < 5 AND expires_at > ? RETURNING *",
      [data.challengeId, Date.now()],
    );
    if (
      !challenge ||
      !timingSafeEqual(
        Buffer.from(challenge.otp_hash, "hex"),
        Buffer.from(hash(`${data.challengeId}:${data.code}`), "hex"),
      )
    )
      throw fail(
        "This code is incorrect, expired, or has too many attempts. Try again or request a new code.",
      );
    const claimed = await database(
      "DELETE FROM auth_challenges WHERE id = ? RETURNING id",
      [challenge.id],
    );
    if (!claimed.length)
      throw fail("This code has already been used. Please sign in.");
    const id = randomUUID();
    const created = await database(
      "INSERT INTO users (id, email, name, course_name, password_hash, key_vault, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING RETURNING *",
      [
        id,
        challenge.email,
        challenge.name,
        challenge.course_name,
        challenge.password_hash,
        challenge.key_vault,
        Date.now(),
      ],
    );
    if (!created.length)
      throw fail("This email is already registered. Please sign in.", 409);
    return signedIn(response, created[0]);
  }
  throw fail("This account action does not exist.", 404);
}
