import { randomUUID } from "node:crypto";
import { database } from "./db.mjs";

const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const memberLifetime = 45000;
const validId = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(value);
async function snapshot(roomId) {
  const [room] = await database(
    "SELECT clock, revision FROM study_rooms WHERE id = ?",
    [roomId],
  );
  const members = await database(
    "SELECT member_id, name, exam, goal FROM room_members WHERE room_id = ? AND seen_at > ? ORDER BY joined_at",
    [roomId, Date.now() - memberLifetime],
  );
  const messages = await database(
    "SELECT id, member_id, name, text, sent_at FROM room_messages WHERE room_id = ? AND sent_at > ? ORDER BY sent_at DESC LIMIT 100",
    [roomId, Date.now() - 86400000],
  );
  return {
    revision: Number(room?.revision || 0),
    members: Object.fromEntries(
      members.map((member) => [
        member.member_id,
        { name: member.name, exam: member.exam, goal: member.goal, roomId },
      ]),
    ),
    clock: room ? JSON.parse(room.clock) : null,
    messages: messages
      .reverse()
      .map((message) => ({
        id: message.id,
        peerId: message.member_id,
        name: message.name,
        text: message.text,
        sentAt: Number(message.sent_at),
      })),
  };
}

export async function roomRequest(
  workspaceId,
  roomId,
  action,
  method,
  data,
  query,
) {
  if (!validId(roomId)) throw fail("This room link is not valid.");
  const memberId = data.memberId || query.get("memberId");
  if (!validId(memberId)) throw fail("Please reopen this room to connect.");
  if (action === "presence" && method === "DELETE") {
    await database(
      "DELETE FROM room_members WHERE room_id = ? AND member_id = ? AND owner_id = ?",
      [roomId, memberId, workspaceId],
    );
    return { left: true };
  }
  if (action === "presence" && method === "PUT") {
    if (
      typeof data.name !== "string" ||
      !data.name.trim() ||
      data.name.length > 40 ||
      typeof data.exam !== "string" ||
      data.exam.length > 30 ||
      typeof data.goal !== "string" ||
      data.goal.length > 100 ||
      ![25, 50, 90].includes(data.minutes)
    )
      throw fail("Your room profile is incomplete. Please confirm your name.");
    const now = Date.now();
    const initialClock = {
      endAt: null,
      duration: data.minutes * 60,
      remaining: data.minutes * 60,
      by: "",
    };
    await database(
      "INSERT INTO study_rooms (id, clock, revision) VALUES (?, ?, 0) ON CONFLICT (id) DO NOTHING",
      [roomId, JSON.stringify(initialClock)],
    );
    const [existing] = await database(
      "SELECT owner_id FROM room_members WHERE room_id = ? AND member_id = ?",
      [roomId, memberId],
    );
    if (existing && existing.owner_id !== workspaceId)
      throw fail("Please reopen this room in a new tab.", 403);
    const joined = await database(
      "INSERT INTO room_members (room_id, member_id, owner_id, name, exam, goal, seen_at, joined_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM room_members WHERE room_id = ? AND seen_at > ?) < 8 OR EXISTS (SELECT 1 FROM room_members WHERE room_id = ? AND member_id = ?) ON CONFLICT (room_id, member_id) DO UPDATE SET name = excluded.name, exam = excluded.exam, goal = excluded.goal, seen_at = excluded.seen_at WHERE room_members.owner_id = excluded.owner_id RETURNING member_id",
      [
        roomId,
        memberId,
        workspaceId,
        data.name.trim(),
        data.exam,
        data.goal,
        now,
        now,
        roomId,
        now - memberLifetime,
        roomId,
        memberId,
      ],
    );
    if (!joined.length)
      throw fail(
        "This room already has 8 students. Create another room for your group.",
        409,
      );
    return snapshot(roomId);
  }
  const [member] = await database(
    "SELECT name FROM room_members WHERE room_id = ? AND member_id = ? AND owner_id = ? AND seen_at > ?",
    [roomId, memberId, workspaceId, Date.now() - memberLifetime],
  );
  if (!member)
    throw fail(
      "Your room connection expired. Wait a moment to reconnect.",
      403,
    );
  if (action === "call" && method === "POST") {
    // Keep the first ID even when two students open the call at the same time.
    const [call] = await database(
      "INSERT INTO room_calls (room_id, call_id) VALUES (?, ?) ON CONFLICT (room_id) DO UPDATE SET call_id = room_calls.call_id RETURNING call_id",
      [roomId, randomUUID().replace(/-/g, "")],
    );
    return { url: `https://kmeet.infomaniak.com/${call.call_id}` };
  }
  if (action === "messages" && method === "POST") {
    if (
      typeof data.text !== "string" ||
      !data.text.trim() ||
      data.text.length > 500 ||
      !validId(data.id)
    )
      throw fail("Write a message of up to 500 characters.");
    const now = Date.now();
    const rateId = `chat:${workspaceId}:${Math.floor(now / 10000)}`;
    const allowed = await database(
      "INSERT INTO request_limits (id, count, expires_at) VALUES (?, 1, ?) ON CONFLICT (id) DO UPDATE SET count = request_limits.count + 1 WHERE request_limits.count < 5 RETURNING count",
      [rateId, now + 10000],
    );
    if (!allowed.length)
      throw fail("Take a little pause before sending another message.", 429);
    await database(
      "INSERT INTO room_messages (id, room_id, member_id, name, text, sent_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING",
      [data.id, roomId, memberId, member.name, data.text.trim(), now],
    );
    await database(
      "DELETE FROM room_messages WHERE room_id = ? AND id NOT IN (SELECT id FROM room_messages WHERE room_id = ? ORDER BY sent_at DESC LIMIT 100)",
      [roomId, roomId],
    );
    return snapshot(roomId);
  }
  if (action === "clock" && method === "POST") {
    if (!["toggle", "reset"].includes(data.action))
      throw fail("Choose a timer action.");
    const [room] = await database(
      "SELECT clock, revision FROM study_rooms WHERE id = ?",
      [roomId],
    );
    const clock = JSON.parse(room.clock);
    const now = Date.now();
    const remaining = clock.endAt
      ? Math.max(0, Math.ceil((clock.endAt - now) / 1000))
      : clock.remaining;
    const next =
      data.action === "reset"
        ? { ...clock, remaining: clock.duration, endAt: null, by: member.name }
        : clock.endAt && remaining > 0
          ? { ...clock, remaining, endAt: null, by: member.name }
          : {
              ...clock,
              remaining: remaining || clock.duration,
              endAt: now + (remaining || clock.duration) * 1000,
              by: member.name,
            };
    const updated = await database(
      "UPDATE study_rooms SET clock = ?, revision = revision + 1 WHERE id = ? AND revision = ? RETURNING id",
      [JSON.stringify(next), roomId, Number(room.revision)],
    );
    if (!updated.length)
      throw fail(
        "Another student just changed the clock. Please try again.",
        409,
      );
    return snapshot(roomId);
  }
  throw fail("This room action is not available.", 404);
}
