import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

let connection;
let initialized;

async function query(text, parameters = []) {
  if (!connection) {
    if (process.env.DATABASE_URL) {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL);
      connection = async (statement, values) => {
        let index = 0;
        return sql.query(
          statement.replace(/\?/g, () => `$${++index}`),
          values,
        );
      };
    } else {
      if (process.env.VERCEL)
        throw new Error(
          "DATABASE_URL must be configured for permanent cloud saving.",
        );
      const { DatabaseSync } = await import("node:sqlite");
      mkdirSync(resolve("data"), { recursive: true });
      const database = new DatabaseSync(resolve("data/padhai.sqlite"));
      database.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
      connection = async (statement, values) => {
        const prepared = database.prepare(statement);
        if (/^\s*(SELECT|WITH|.*RETURNING)/i.test(statement))
          return prepared.all(...values);
        prepared.run(...values);
        return [];
      };
    }
  }
  return connection(text, parameters);
}

export async function database(text, parameters = []) {
  if (!initialized) {
    initialized = (async () => {
      await query(
        "CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, encrypted TEXT, iv TEXT, revision INTEGER NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL)",
      );
      await query(
        "CREATE TABLE IF NOT EXISTS request_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at BIGINT NOT NULL)",
      );
      await query(
        "CREATE TABLE IF NOT EXISTS syllabus_cache (id TEXT PRIMARY KEY, content TEXT NOT NULL, fetched_at BIGINT NOT NULL)",
      );
      await query(
        "CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, encrypted TEXT NOT NULL, iv TEXT NOT NULL, size INTEGER NOT NULL, created_at BIGINT NOT NULL)",
      );
      await query(
        "CREATE INDEX IF NOT EXISTS attachments_owner ON attachments (owner_id)",
      );
      await query(
        "CREATE TABLE IF NOT EXISTS note_shares (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, encrypted TEXT NOT NULL, iv TEXT NOT NULL, created_at BIGINT NOT NULL)",
      );
      await query(
        "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, course_name TEXT NOT NULL, password_hash TEXT NOT NULL, key_vault TEXT NOT NULL, created_at BIGINT NOT NULL)",
      );
      await query(
        "CREATE TABLE IF NOT EXISTS auth_challenges (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, course_name TEXT NOT NULL, password_hash TEXT NOT NULL, key_vault TEXT NOT NULL, otp_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires_at BIGINT NOT NULL)",
      );
      await query(
        "CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at BIGINT NOT NULL)",
      );
      await query(
        "CREATE TABLE IF NOT EXISTS auth_resets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, expires_at BIGINT NOT NULL)",
      );
      await query(
        "CREATE TABLE IF NOT EXISTS study_rooms (id TEXT PRIMARY KEY, clock TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)",
      );
      await query(
        "CREATE TABLE IF NOT EXISTS room_members (room_id TEXT NOT NULL, member_id TEXT NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, exam TEXT NOT NULL, goal TEXT NOT NULL, seen_at BIGINT NOT NULL, joined_at BIGINT NOT NULL, PRIMARY KEY (room_id, member_id))",
      );
      await query(
        "CREATE TABLE IF NOT EXISTS room_messages (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, member_id TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, sent_at BIGINT NOT NULL)",
      );
      await query(
        "CREATE INDEX IF NOT EXISTS room_messages_room ON room_messages (room_id, sent_at)",
      );
      await query("DELETE FROM request_limits WHERE expires_at < ?", [
        Date.now(),
      ]);
      await query("DELETE FROM auth_challenges WHERE expires_at < ?", [
        Date.now(),
      ]);
      await query("DELETE FROM auth_sessions WHERE expires_at < ?", [
        Date.now(),
      ]);
      await query("DELETE FROM auth_resets WHERE expires_at < ?", [Date.now()]);
      await query("DELETE FROM room_members WHERE seen_at < ?", [
        Date.now() - 45000,
      ]);
      await query("DELETE FROM room_messages WHERE sent_at < ?", [
        Date.now() - 86400000,
      ]);
    })().catch((error) => {
      initialized = undefined;
      throw error;
    });
  }
  await initialized;
  return query(text, parameters);
}
