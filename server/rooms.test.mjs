import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { roomRequest } from "./rooms.mjs";
import { database } from "./db.mjs";

test("room members share one saved kMeet link and can use chat and the clock", async () => {
  const id = "room-" + randomUUID();
  const otherRoom = "room-" + randomUUID();
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
    await assert.rejects(
      roomRequest("owner-b", id, "call", "POST", { memberId: a }, query),
      { status: 403 },
    );
    const [firstCall, secondCall] = await Promise.all([
      roomRequest("owner-a", id, "call", "POST", { memberId: a }, query),
      roomRequest("owner-b", id, "call", "POST", { memberId: b }, query),
    ]);
    assert.match(firstCall.url, /^https:\/\/kmeet\.infomaniak\.com\/[a-f0-9]{32}$/);
    assert.equal(secondCall.url, firstCall.url);
    await roomRequest("owner-a", otherRoom, "presence", "PUT", { ...profile, memberId: a }, query);
    const otherCall = await roomRequest("owner-a", otherRoom, "call", "POST", { memberId: a }, query);
    assert.notEqual(otherCall.url, firstCall.url);
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
    await assert.rejects(
      roomRequest("owner-b", id, "call", "POST", { memberId: b }, query),
      { status: 403 },
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
    await database("DELETE FROM room_members WHERE room_id IN (?, ?)", [id, otherRoom]);
    await database("DELETE FROM room_messages WHERE room_id = ?", [id]);
    await database("DELETE FROM room_calls WHERE room_id IN (?, ?)", [id, otherRoom]);
    await database("DELETE FROM study_rooms WHERE id IN (?, ?)", [id, otherRoom]);
  }
});
