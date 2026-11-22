import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  normalizeEmail,
  otpEmail,
  verifyPassword,
} from "./auth.mjs";

test("password hashes use unique salts and reject incorrect passwords", async () => {
  const first = await hashPassword("Study with intention 2026");
  const second = await hashPassword("Study with intention 2026");
  assert.notEqual(first, second);
  assert.ok(!first.includes("Study"));
  assert.equal(await verifyPassword("Study with intention 2026", first), true);
  assert.equal(await verifyPassword("different password", first), false);
  assert.equal(await verifyPassword("anything", "malformed"), false);
});
test("OTP email identifies the sender and expiry without exposing account credentials", () => {
  assert.equal(normalizeEmail(" Student@Example.com "), "student@example.com");
  const mail = otpEmail("123456");
  assert.match(mail.from, /info\.dasanudas@gmail\.com/);
  assert.match(mail.text, /123456/);
  assert.match(mail.text, /10 minutes/);
  assert.ok(!mail.text.includes("password"));
});
