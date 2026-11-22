import test from "node:test";
import assert from "node:assert/strict";
import { readAPIResponse } from "./cloud.ts";

test("plain-text hosting errors show a readable message instead of a JSON parser error", async () => {
  await assert.rejects(
    readAPIResponse(
      new Response("The page could not be found", { status: 404 }),
    ),
    /app service could not be reached/,
  );
  assert.deepEqual(
    await readAPIResponse(
      new Response('{"ok":true}', {
        headers: { "Content-Type": "application/json" },
      }),
    ),
    { ok: true },
  );
});
