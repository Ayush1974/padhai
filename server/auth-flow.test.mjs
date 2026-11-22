import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import { authRequest } from "./auth.mjs";
import { database } from "./db.mjs";
import { openStudyKey, sealStudyKey } from "../src/lib/account.ts";

test("email verification and password reset preserve the workspace and revoke old sessions", async () => {
  const email = `qa-${randomUUID()}@example.invalid`;
  const password = "A private QA password 123";
  const previousPassword = process.env.SMTP_PASS;
  const previousRecovery = process.env.PADHAI_RECOVERY_SECRET;
  const originalTransport = nodemailer.createTransport;
  let deliveredCode = "";
  let deliveredReset = "";
  let deliveredResetCount = 0;
  let cookie = "";
  let userId = "";
  const request = {
    method: "POST",
    headers: { host: "localhost" },
    socket: { remoteAddress: email },
  };
  const response = {
    setHeader(name, value) {
      if (name === "Set-Cookie") cookie = value.split(";")[0];
    },
  };
  process.env.SMTP_PASS = "test transport only";
  process.env.PADHAI_RECOVERY_SECRET = "b9".repeat(32);
  nodemailer.createTransport = () => ({
    async sendMail(mail) {
      assert.equal(mail.to, email);
      if (mail.subject === "Reset your Padhai password") {
        deliveredReset = mail.text.match(/#reset=([a-f0-9]{64})/)[1];
        deliveredResetCount++;
      } else deliveredCode = mail.text.match(/\b\d{6}\b/)[0];
    },
    close() {},
  });
  try {
    const studyKey = "padhai_" + "cd".repeat(32);
    const keyVault = await sealStudyKey(password, studyKey);
    const registration = await authRequest(request, response, "auth/register", {
      name: "QA Student",
      courseName: "GATE CS",
      email,
      password,
      keyVault,
    });
    assert.ok(registration.challengeId);
    assert.equal(deliveredCode.length, 6);
    await assert.rejects(
      authRequest(request, response, "auth/verify", {
        challengeId: registration.challengeId,
        code: "000000",
      }),
    );
    const result = await authRequest(request, response, "auth/verify", {
      challengeId: registration.challengeId,
      code: deliveredCode,
    });
    userId = result.user.id;
    assert.equal(result.user.email, email);
    assert.deepEqual(result.keyVault, keyVault);
    assert.ok(!("password_hash" in result.user));
    await assert.rejects(
      authRequest(request, response, "auth/verify", {
        challengeId: registration.challengeId,
        code: deliveredCode,
      }),
    );
    const current = await authRequest(
      { ...request, method: "GET", headers: { host: "localhost", cookie } },
      response,
      "auth/session",
      {},
    );
    assert.equal(current.user.id, userId);
    const firstCookie = cookie;
    await assert.rejects(
      authRequest(request, response, "auth/login", {
        email,
        password: "wrong",
      }),
    );
    await authRequest(request, response, "auth/forgot-password", { email });
    const firstLink = deliveredReset;
    await authRequest(request, response, "auth/forgot-password", { email });
    assert.equal(deliveredResetCount, 2);
    assert.notEqual(deliveredReset, firstLink);
    await assert.rejects(
      authRequest(request, response, "auth/reset-status", { token: firstLink }),
      /expired/,
    );
    const reset = await authRequest(request, response, "auth/reset-status", {
      token: deliveredReset,
    });
    assert.equal(reset.needsStudyKey, false);
    assert.equal(reset.user.email, email);
    const newPassword = "A different reset password 456";
    const restored = await authRequest(request, response, "auth/reset-password", {
      token: deliveredReset,
      password: newPassword,
    });
    assert.equal(await openStudyKey(newPassword, restored.keyVault), studyKey);
    assert.notEqual(cookie, firstCookie);
    const expiredSession = await authRequest(
      { ...request, method: "GET", headers: { host: "localhost", cookie: firstCookie } },
      response, "auth/session", {},
    );
    assert.equal(expiredSession.user, null);
    await assert.rejects(authRequest(request, response, "auth/reset-password", {
      token: deliveredReset,
      password: newPassword,
    }), /expired/);
    await assert.rejects(
      authRequest(request, response, "auth/login", { email, password }), /incorrect/,
    );
    const afterReset = await authRequest(request, response, "auth/login", {
      email: email.toUpperCase(), password: newPassword,
    });
    assert.equal(await openStudyKey(newPassword, afterReset.keyVault), studyKey);
    const signedCookie = cookie;
    await authRequest(
      { ...request, headers: { host: "localhost", cookie: signedCookie } },
      response,
      "auth/logout",
      {},
    );
    assert.equal(
      (
        await authRequest(
          {
            ...request,
            method: "GET",
            headers: { host: "localhost", cookie: signedCookie },
          },
          response,
          "auth/session",
          {},
        )
      ).user,
      null,
    );
  } finally {
    nodemailer.createTransport = originalTransport;
    if (previousPassword === undefined) delete process.env.SMTP_PASS;
    else process.env.SMTP_PASS = previousPassword;
    if (previousRecovery === undefined) delete process.env.PADHAI_RECOVERY_SECRET;
    else process.env.PADHAI_RECOVERY_SECRET = previousRecovery;
    if (userId)
      await database("DELETE FROM auth_sessions WHERE user_id = ?", [userId]);
    await database("DELETE FROM users WHERE email = ?", [email]);
    await database("DELETE FROM auth_challenges WHERE email = ?", [email]);
    if (userId) await database("DELETE FROM auth_resets WHERE user_id = ?", [userId]);
  }
});
