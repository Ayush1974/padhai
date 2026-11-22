import test from "node:test";
import assert from "node:assert/strict";
import { aiRequest, chooseAIKey } from "./ai.mjs";
import { randomUUID } from "node:crypto";

test("a saved personal key takes precedence over the shared key", () => {
  assert.deepEqual(chooseAIKey("personal-key", "shared-key"), {
    key: "personal-key",
    personal: true,
  });
  assert.deepEqual(chooseAIKey("", "shared-key"), {
    key: "shared-key",
    personal: false,
  });
});
test("a provider rejection sends only the personal key and asks for an update", async () => {
  const originalFetch = globalThis.fetch;
  const originalShared = process.env.GEMINI_API_KEY;
  const personal = "personal-test-key-123456789012345";
  const sent = [];
  process.env.GEMINI_API_KEY = "owner-test-key-123456789012345678";
  globalThis.fetch = async (_url, options) => {
    sent.push(options.headers["X-goog-api-key"]);
    return new Response('{"error":{"message":"expired"}}', {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await assert.rejects(
      aiRequest(
        { headers: { "x-padhai-gemini-key": personal } },
        randomUUID(),
        { kind: "assistant", prompt: "Help with revision." },
      ),
      (error) => error.needsKey === true,
    );
    assert.deepEqual(sent, [personal]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalShared === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalShared;
  }
});
test("an expired personal key is not replaced with the owner key", () => {
  assert.equal(
    chooseAIKey("expired-personal-key", "owner-key").key,
    "expired-personal-key",
  );
});
