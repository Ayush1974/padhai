import { createHash, randomUUID } from "node:crypto";
import { database } from "./db.mjs";
import { fetchSyllabus } from "./syllabus.mjs";
import { aiRequest } from "./ai.mjs";
import { authRequest, sessionUser } from "./auth.mjs";
import { roomRequest } from "./rooms.mjs";
import { dailyWisdom, prepareDailyWisdom } from "./wisdom.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");

export async function bodyOf(request) {
  if (request.body && typeof request.body === "object") {
    if (
      Array.isArray(request.body) ||
      Buffer.byteLength(JSON.stringify(request.body)) > 4_000_000
    )
      throw Object.assign(new Error("Choose a smaller upload or request."), {
        status: 413,
      });
    return request.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 4_000_000)
      throw Object.assign(
        new Error(
          "This workspace is too large to sync. Export a backup to keep your work.",
        ),
        { status: 413 },
      );
    chunks.push(bytes);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    const value = JSON.parse(body || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw Object.assign(new Error("A valid JSON request is required."), {
      status: 400,
    });
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  const send = (status, data) => {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(data));
  };
  try {
    const url = new URL(
      request.url,
      `https://${request.headers.host || "localhost"}`,
    );
    const path = (
      url.searchParams.get("route") || url.pathname.replace(/^\/api\/?/, "")
    ).replace(/\/$/, "");
    if (path === "health") {
      await database("SELECT 1 AS ready");
      send(200, {
        ok: true,
        storage: process.env.DATABASE_URL ? "postgres" : "sqlite",
        persistent: true,
      });
      return;
    }
    if (path === "wisdom/daily" && request.method === "GET") {
      const kind = url.searchParams.get("kind") || "shloka";
      if (kind !== "shloka" && kind !== "chaupai") {
        send(400, { error: "Choose a shloka or a chaupai." });
        return;
      }
      send(200, await dailyWisdom(kind));
      return;
    }
    if (path === "wisdom/prepare" && request.method === "GET") {
      if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        send(401, { error: "This task is reserved for the daily scheduler." });
        return;
      }
      await prepareDailyWisdom();
      send(200, { prepared: true });
      return;
    }
    if (path.startsWith("auth/")) {
      send(
        200,
        await authRequest(
          request,
          response,
          path,
          request.method === "POST" ? await bodyOf(request) : {},
        ),
      );
      return;
    }
    // A study key proves workspace access; a verified email session is also required.
    if (
      !(path === "account" && request.method === "POST") &&
      !(await sessionUser(request))
    ) {
      send(401, {
        error:
          "Please sign in or verify your email to open your study workspace.",
      });
      return;
    }
    const token = request.headers.authorization?.replace(/^Bearer /, "");
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      send(401, { error: "Your study key is required." });
      return;
    }
    const tokenHash = hash(token);
    const [workspace] = await database(
      "SELECT id, encrypted, iv, revision FROM workspaces WHERE token_hash = ?",
      [tokenHash],
    );

    if (path === "account" && request.method === "POST") {
      if (workspace) {
        send(200, { id: workspace.id });
        return;
      }
      const address = process.env.VERCEL
        ? String(request.headers["x-forwarded-for"] || "").split(",")[0]
        : request.socket?.remoteAddress || "local";
      const now = Date.now();
      const rateId = hash(`${address}:${Math.floor(now / 3_600_000)}`);
      const [rate] = await database(
        "SELECT count FROM request_limits WHERE id = ?",
        [rateId],
      );
      if (rate && Number(rate.count) >= 30) {
        send(429, {
          error:
            "Too many new study keys on this network. Please try again later.",
        });
        return;
      }
      await database(
        "INSERT INTO request_limits (id, count, expires_at) VALUES (?, 1, ?) ON CONFLICT (id) DO UPDATE SET count = request_limits.count + 1",
        [rateId, now + 3_600_000],
      );
      const id = randomUUID();
      await database(
        "INSERT INTO workspaces (id, token_hash, updated_at) VALUES (?, ?, ?) ON CONFLICT (token_hash) DO NOTHING",
        [id, tokenHash, now],
      );
      const [created] = await database(
        "SELECT id FROM workspaces WHERE token_hash = ?",
        [tokenHash],
      );
      send(201, { id: created.id });
      return;
    }
    if (!workspace) {
      send(404, {
        error: "This study key does not have a cloud workspace yet.",
      });
      return;
    }
    const roomMatch = path.match(
      /^rooms\/([a-zA-Z0-9-]{1,100})\/(presence|messages|clock|call)$/,
    );
    if (roomMatch) {
      send(
        200,
        await roomRequest(
          workspace.id,
          roomMatch[1],
          roomMatch[2],
          request.method,
          ["PUT", "POST"].includes(request.method) ? await bodyOf(request) : {},
          url.searchParams,
        ),
      );
      return;
    }

    if (path === "ai" && request.method === "POST") {
      const data = await bodyOf(request);
      send(200, await aiRequest(request, workspace.id, data));
      return;
    }
    if (path === "note-shares" && request.method === "POST") {
      const { encrypted, iv } = await bodyOf(request);
      if (
        typeof encrypted !== "string" ||
        encrypted.length > 810000 ||
        encrypted.length < 24 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(encrypted) ||
        typeof iv !== "string" ||
        !/^[A-Za-z0-9+/]{16}$/.test(iv)
      ) {
        send(400, { error: "This note could not be shared. Check its size and try again." });
        return;
      }
      const count = await database(
        "INSERT INTO request_limits (id, count, expires_at) VALUES (?, 1, ?) ON CONFLICT (id) DO UPDATE SET count = request_limits.count + 1 WHERE request_limits.count < 25 RETURNING count",
        [`note-shares:${workspace.id}:${Math.floor(Date.now() / 86400000)}`, Date.now() + 86400000],
      );
      if (!count.length) {
        send(429, { error: "You can create more note links tomorrow." });
        return;
      }
      const id = randomUUID();
      await database(
        "INSERT INTO note_shares (id, owner_id, encrypted, iv, created_at) VALUES (?, ?, ?, ?, ?)",
        [id, workspace.id, encrypted, iv, Date.now()],
      );
      send(201, { id });
      return;
    }
    const noteShare = path.match(/^note-shares\/([a-f0-9-]{36})$/);
    if (noteShare && request.method === "GET") {
      const [shared] = await database(
        "SELECT encrypted, iv FROM note_shares WHERE id = ?",
        [noteShare[1]],
      );
      if (shared) send(200, shared);
      else send(404, { error: "This shared note is no longer available." });
      return;
    }
    const fileMatch = path.match(/^files\/([a-f0-9-]{36})$/);
    if (fileMatch) {
      const id = fileMatch[1];
      if (request.method === "GET") {
        const [file] = await database(
          "SELECT encrypted, iv, size FROM attachments WHERE id = ? AND owner_id = ?",
          [id, workspace.id],
        );
        if (!file) {
          send(404, {
            error: "This attachment is not available in this workspace.",
          });
          return;
        }
        send(200, file);
        return;
      }
      if (request.method === "PUT") {
        const data = await bodyOf(request);
        if (
          typeof data.encrypted !== "string" ||
          data.encrypted.length > 2_900_000 ||
          !/^[A-Za-z0-9+/=]+$/.test(data.encrypted) ||
          typeof data.iv !== "string" ||
          !/^[A-Za-z0-9+/=]{16}$/.test(data.iv) ||
          !Number.isInteger(data.size) ||
          data.size < 1 ||
          data.size > 2_097_152 ||
          Buffer.from(data.encrypted, "base64").length !== data.size + 16
        ) {
          send(400, {
            error:
              "The encrypted file chunk is not valid. Please retry the upload.",
          });
          return;
        }
        const [usage] = await database(
          "SELECT COALESCE(SUM(size), 0) AS total FROM attachments WHERE owner_id = ?",
          [workspace.id],
        );
        const [globalUsage] = await database(
          "SELECT COALESCE(SUM(size), 0) AS total FROM attachments",
        );
        if (
          Number(usage.total) + data.size > 52_428_800 ||
          Number(globalUsage.total) + data.size > 262_144_000
        ) {
          send(413, {
            error:
              "The free attachment storage allowance is full. Download and remove old attachments, or save a link instead.",
          });
          return;
        }
        const [existing] = await database(
          "SELECT owner_id FROM attachments WHERE id = ?",
          [id],
        );
        if (existing && existing.owner_id !== workspace.id) {
          send(409, { error: "Please retry the upload." });
          return;
        }
        await database(
          "INSERT INTO attachments (id, owner_id, encrypted, iv, size, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING",
          [id, workspace.id, data.encrypted, data.iv, data.size, Date.now()],
        );
        send(201, { id });
        return;
      }
      if (request.method === "DELETE") {
        await database(
          "DELETE FROM attachments WHERE id = ? AND owner_id = ?",
          [id, workspace.id],
        );
        send(200, { deleted: true });
        return;
      }
    }

    if (path === "account" && request.method === "GET") {
      send(200, workspace);
      return;
    }
    if (path === "account" && request.method === "PUT") {
      const data = await bodyOf(request);
      if (
        typeof data.encrypted !== "string" ||
        data.encrypted.length > 3_900_000 ||
        !/^[A-Za-z0-9+/=]+$/.test(data.encrypted) ||
        typeof data.iv !== "string" ||
        !/^[A-Za-z0-9+/=]{16}$/.test(data.iv) ||
        !Number.isInteger(data.revision) ||
        data.revision < 0
      ) {
        send(400, { error: "The encrypted workspace is not valid." });
        return;
      }
      const rows = await database(
        "UPDATE workspaces SET encrypted = ?, iv = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? RETURNING revision",
        [data.encrypted, data.iv, Date.now(), workspace.id, data.revision],
      );
      if (!rows.length) {
        send(409, {
          error:
            "Another device has newer changes. Choose which copy to keep in Settings.",
        });
        return;
      }
      send(200, { revision: Number(rows[0].revision) });
      return;
    }
    if (path === "syllabus" && request.method === "GET") {
      const exam = url.searchParams.get("exam") || "jee";
      if (!["gatecs", "jee", "neet", "upsc", "ssc"].includes(exam)) {
        send(400, {
          error:
            "Choose a supported official source. You can add any other syllabus manually.",
        });
        return;
      }
      const [cached] = await database(
        "SELECT content, fetched_at FROM syllabus_cache WHERE id = ?",
        [exam],
      );
      if (cached && Date.now() - Number(cached.fetched_at) < 86_400_000) {
        send(200, JSON.parse(cached.content));
        return;
      }
      const syllabus = await fetchSyllabus(exam);
      await database(
        "INSERT INTO syllabus_cache (id, content, fetched_at) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET content = excluded.content, fetched_at = excluded.fetched_at",
        [exam, JSON.stringify(syllabus), Date.now()],
      );
      send(200, syllabus);
      return;
    }
    send(404, { error: "This route does not exist." });
  } catch (error) {
    console.error("Padhai API:", error.message);
    send(error.status || 503, {
      error: error.status
        ? error.message
        : "Cloud saving is temporarily unavailable. Your work is still saved on this device. Please retry.",
      needsKey: error.needsKey === true,
    });
  }
}
