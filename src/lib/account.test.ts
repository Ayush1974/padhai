import test from "node:test";
import assert from "node:assert/strict";
import { openStudyKey, sealStudyKey } from "./account.ts";

test("account vault restores a study key only with the correct password", async () => {
  const studyKey = "padhai_" + "ab".repeat(32);
  const vault = await sealStudyKey("a long private password", studyKey);
  assert.ok(!JSON.stringify(vault).includes(studyKey));
  assert.equal(await openStudyKey("a long private password", vault), studyKey);
  await assert.rejects(openStudyKey("wrong password", vault));
});
