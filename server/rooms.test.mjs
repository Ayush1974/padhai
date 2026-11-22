import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { roomRequest } from "./rooms.mjs";
import { database } from "./db.mjs";

test("room members, chat and clock work without a peer connection and enforce ownership", async () => {
  const id = "room-" + randomUUID();
  const a = randomUUID(),
    b = randomUUID();
  const query = new URLSearchParams();
  const profile = {
    name: "First Student",
    exam: "GATE",
    goal: "",
    minutes: 50,
  };
  try {
    const first = await roomRequest(
      "owner-a",
      id,
      "presence",
      "PUT",
      { ...profile, memberId: a },
      query,
    );
    assert.equal(first.clock.duration, 3000);
    assert.equal(Object.keys(first.members).length, 1);
    const second = await roomRequest(
      "owner-b",
      id,
      "presence",
      "PUT",
      { ...profile, name: "Second Student", memberId: b },
      query,
    );
    assert.equal(Object.keys(second.members).length, 2);
    const topic = "test-room-calls-topic";
    const packet = { topic, message: { peerId: "test-peer" } };
    await assert.rejects(
      roomRequest("owner-b", id, "signals", "POST", { memberId: a, ...packet }, query),
      { status: 403 },
    );
    await roomRequest("owner-a", id, "signals", "POST", { memberId: a, ...packet }, query);
    const polling = { ...profile, signalTopics: [topic], readSignals: [] };
    const sender = await roomRequest("owner-a", id, "presence", "PUT", { ...polling, memberId: a }, query);
    assert.deepEqual(sender.signals, []);
    const secondPoll = { ...polling, name: "Second Student", memberId: b };
    const recipient = await roomRequest("owner-b", id, "presence", "PUT", secondPoll, query);
    assert.equal(recipient.signals.length, 1);
    assert.deepEqual(recipient.signals[0].message, packet.message);
    const next = await roomRequest("owner-b", id, "presence", "PUT",
      { ...secondPoll, readSignals: [recipient.signals[0].id] }, query);
    assert.deepEqual(next.signals, []);
    await assert.rejects(
      roomRequest(
        "owner-b",
        id,
        "presence",
        "PUT",
        { ...profile, memberId: a },
        query,
      ),
    );
    const chat = await roomRequest(
      "owner-a",
      id,
      "messages",
      "POST",
      { memberId: a, id: randomUUID(), text: "Ready for GATE CS" },
      query,
    );
    assert.equal(chat.messages[0].name, "First Student");
    assert.equal(chat.messages[0].text, "Ready for GATE CS");
    await assert.rejects(
      roomRequest(
        "outsider",
        id,
        "messages",
        "POST",
        { memberId: a, id: randomUUID(), text: "Spoofed" },
        query,
      ),
    );
    const running = await roomRequest(
      "owner-b",
      id,
      "clock",
      "POST",
      { memberId: b, action: "toggle" },
      query,
    );
    assert.ok(running.clock.endAt > Date.now());
    assert.equal(running.clock.by, "Second Student");
    await roomRequest(
      "owner-b",
      id,
      "presence",
      "DELETE",
      {},
      new URLSearchParams({ memberId: b }),
    );
    const remaining = await roomRequest(
      "owner-a",
      id,
      "presence",
      "PUT",
      { ...profile, memberId: a },
      query,
    );
    assert.equal(Object.keys(remaining.members).length, 1);
    for (let index = 0; index < 7; index++)
      await roomRequest(
        `extra-${index}`,
        id,
        "presence",
        "PUT",
        { ...profile, memberId: randomUUID() },
        query,
      );
    await assert.rejects(
      roomRequest(
        "ninth",
        id,
        "presence",
        "PUT",
        { ...profile, memberId: randomUUID() },
        query,
      ),
    );
  } finally {
    await database("DELETE FROM room_members WHERE room_id = ?", [id]);
    await database("DELETE FROM room_messages WHERE room_id = ?", [id]);
    await database("DELETE FROM room_signals WHERE room_id = ?", [id]);
    await database("DELETE FROM study_rooms WHERE id = ?", [id]);
  }
});
