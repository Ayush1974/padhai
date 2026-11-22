import { createCipheriv, createDecipheriv, pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(pbkdf2);
const validStudyKey = /^padhai_[a-f0-9]{64}$/;

async function passwordKey(password, salt) {
  return deriveKey(password, Buffer.from(salt, "base64"), 310000, 32, "sha256");
}

function seal(value, key, context = "") {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (context) cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { iv: iv.toString("base64"), encrypted: encrypted.toString("base64") };
}

function open(vault, key, context = "") {
  const encrypted = Buffer.from(vault.encrypted, "base64");
  const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(vault.iv, "base64"));
  if (context) cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(encrypted.subarray(-16));
  const value = Buffer.concat([cipher.update(encrypted.subarray(0, -16)), cipher.final()]).toString("utf8");
  if (!validStudyKey.test(value)) throw new Error("Invalid encrypted study key.");
  return value;
}

function recoveryKey() {
  const secret = process.env.PADHAI_RECOVERY_SECRET || "";
  return /^[a-f0-9]{64}$/i.test(secret) ? Buffer.from(secret, "hex") : null;
}

export async function addEmailRecovery(vault, password, email) {
  const key = recoveryKey();
  if (!key || recoverStudyKey(vault, email)) return vault;
  const studyKey = open(vault, await passwordKey(password, vault.salt));
  return { ...vault, recovery: seal(studyKey, key, email) };
}

export function recoverStudyKey(vault, email) {
  const key = recoveryKey();
  if (!vault.recovery || !key) return null;
  try {
    return open(vault.recovery, key, email);
  } catch {
    return null;
  }
}

export async function resetKeyVault(studyKey, password, email) {
  const salt = randomBytes(16).toString("base64");
  const vault = { salt, ...seal(studyKey, await passwordKey(password, salt)) };
  const key = recoveryKey();
  return key ? { ...vault, recovery: seal(studyKey, key, email) } : vault;
}
