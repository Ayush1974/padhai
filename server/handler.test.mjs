import test from "node:test";
import assert from "node:assert/strict";
import handler, { bodyOf } from "./handler.mjs";

test("a study key alone cannot access private modules without a verified login", async () => {
  for (const path of [
    "account",
    "ai",
    "files/" + "a".repeat(36),
    "rooms/test/presence",
  ]) {
    let result;
    const response = {
      statusCode: 0,
      setHeader() {},
      end(body) {
        result = JSON.parse(body);
      },
    };
    await handler(
      {
        url: "/api/" + path,
        method: "GET",
        headers: {
          host: "localhost",
          authorization: "Bearer " + "a".repeat(64),
        },
      },
      response,
    );
    assert.equal(response.statusCode, 401);
    assert.match(result.error, /sign in/i);
  }
});

test("streamed JSON keeps Indic characters intact across network chunk boundaries", async () => {
  const data = { name: "अभ्यास", text: "मेहनत और नियमित पढ़ाई" };
  const bytes = Buffer.from(JSON.stringify(data));
  async function* chunks() {
    for (const byte of bytes) yield Buffer.from([byte]);
  }
  assert.deepEqual(await bodyOf(chunks()), data);
});
