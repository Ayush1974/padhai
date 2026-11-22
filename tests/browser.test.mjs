import test, { before, after } from "node:test";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import nodemailer from "nodemailer";
import handler from "../server/handler.mjs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const otpCodes = new Map();
const resetLinks = new Map();
let testServer;
const originalTransport = nodemailer.createTransport;
const originalSMTP = process.env.SMTP_PASS;
const originalRecovery = process.env.PADHAI_RECOVERY_SECRET;
before(async () => {
  if (process.env.TEST_BASE_URL) return;
  process.env.SMTP_PASS = "mock email delivery for browser tests";
  process.env.PADHAI_RECOVERY_SECRET = "c7".repeat(32);
  nodemailer.createTransport = () => ({
    async sendMail(mail) {
      if (mail.subject === "Reset your Padhai password")
        resetLinks.set(mail.to, mail.text.match(/https?:\/\/\S+#reset=[a-f0-9]{64}/)[0]);
      else otpCodes.set(mail.to, mail.text.match(/\b\d{6}\b/)[0]);
    },
    close() {},
  });
  testServer = createServer(handler);
  await new Promise((resolve, reject) => {
    testServer.once("error", reject);
    testServer.listen(4881, "127.0.0.1", resolve);
  });
});
after(async () => {
  if (testServer) {
    testServer.closeAllConnections();
    await new Promise((resolve) => testServer.close(resolve));
  }
  nodemailer.createTransport = originalTransport;
  if (originalSMTP === undefined) delete process.env.SMTP_PASS;
  else process.env.SMTP_PASS = originalSMTP;
  if (originalRecovery === undefined) delete process.env.PADHAI_RECOVERY_SECRET;
  else process.env.PADHAI_RECOVERY_SECRET = originalRecovery;
});

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
async function openWorkspace(page, name = "QA Student", url = base) {
  await page.goto(url);
  const email = "qa-" + crypto.randomUUID() + "@example.invalid";
  const password = "A long private test password 123";
  const denied = await page.request.get(base + "/api/account", {
    headers: { Authorization: "Bearer " + "a".repeat(64) },
  });
  assert.equal(denied.status(), 401);
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page.getByLabel("Course or exam name", { exact: true }).fill("GATE CS");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Password", { exact: true }).getAttribute("type"),
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", {
        name: "Continue with my private study key",
        exact: true,
      })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Send verification code", exact: true })
    .click();
  await page.getByLabel("Email verification code", { exact: true }).waitFor();
  assert.ok(
    otpCodes.get(email),
    "Test OTP must be delivered before verification",
  );
  await page
    .getByLabel("Email verification code", { exact: true })
    .fill(otpCodes.get(email));
  await page
    .getByRole("button", {
      name: "Verify email & open my account",
      exact: true,
    })
    .click();
  await page.getByPlaceholder("Enter your name or nickname").fill(name);
  await page
    .getByRole("button", { name: "Open my study space", exact: true })
    .click();
  return { email, password };
}
async function signIn(page, credentials, name) {
  await page.goto(base);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page
    .getByRole("button", { name: "Sign in to my study space", exact: true })
    .click();
  const switchButton = page.getByRole("button", {
    name: "Open my account workspace",
    exact: true,
  });
  await Promise.race([
    switchButton.waitFor().then(() => switchButton.click()),
    page
      .getByRole("button", { name: "Open my study space", exact: true })
      .waitFor(),
  ]);
  await page.getByPlaceholder("Enter your name or nickname").fill(name);
  await page
    .getByRole("button", { name: "Open my study space", exact: true })
    .click();
}
async function navigate(page, name) {
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true })
    .click();
}

test(
  "notebooks, encrypted files, journal goals, planner and calendar persist across recovery",
  { timeout: 120000 },
  async () => {
    const browser = await chromium.launch({
      channel: "msedge",
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const credentials = await openWorkspace(page);
      await navigate(page, "My notes");
      await page
        .getByRole("button", { name: "New notebook", exact: true })
        .click();
      await page
        .getByLabel("Notebook name", { exact: true })
        .fill("GATE CS revision");
      await page
        .getByRole("button", { name: "Save notebook", exact: true })
        .click();
      await page.getByRole("button", { name: "New note", exact: true }).click();
      await page
        .getByLabel("Note title", { exact: true })
        .fill("Operating systems");
      await page
        .getByLabel("Note text", { exact: true })
        .fill("Review processes and threads.");
      await page
        .getByLabel("Choose a file to attach", { exact: true })
        .setInputFiles({
          name: "revision.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("My revision file"),
        });
      await page
        .locator(".attachment-name")
        .filter({ hasText: "revision.txt" })
        .waitFor();
      const downloadPromise = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download revision.txt", exact: true })
        .click();
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      const parts = [];
      for await (const part of stream) parts.push(part);
      assert.equal(Buffer.concat(parts).toString(), "My revision file");
      await navigate(page, "Daily foundations");
      await page
        .getByLabel("New daily goal", { exact: true })
        .fill("Revise graphs");
      await page.getByRole("button", { name: "Add goal", exact: true }).click();
      await page
        .getByRole("button", {
          name: "Complete goal Revise graphs",
          exact: true,
        })
        .click();
      await page
        .getByLabel("My intention for this day", { exact: true })
        .fill("Consistency over perfection");
      await navigate(page, "My planner");
      await page
        .getByRole("button", { name: "Add a task", exact: true })
        .first()
        .click();
      await page
        .getByLabel("What would you like to do?", { exact: true })
        .fill("Practice GATE questions");
      await page
        .getByRole("button", { name: "Add to my plan", exact: true })
        .click();
      assert.match(
        await page
          .getByRole("link", {
            name: /Add Practice GATE questions to Google Calendar/,
          })
          .getAttribute("href"),
        /^https:\/\/calendar.google.com/,
      );
      await navigate(page, "Study calendar");
      await page
        .getByRole("button", { name: "Plan a session", exact: true })
        .click();
      await page
        .getByLabel("Session title", { exact: true })
        .fill("Networks revision");
      await page
        .getByRole("button", { name: "Save session", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Networks revision", exact: true })
        .waitFor();
      await navigate(page, "Settings");
      const personalKey = "personal-browser-test-key-1234567890";
      const usedKeys = [];
      await page.route("**/api/ai", async (route) => {
        usedKeys.push(route.request().headers()["x-padhai-gemini-key"]);
        const input = route.request().postDataJSON();
        await route.fulfill({
          json:
            input.kind === "validate"
              ? { valid: true, using: "personal" }
              : {
                  answer: "A short revision exercise is ready.",
                  tasks: [],
                  schedule: [],
                  using: "personal",
                },
        });
      });
      await page
        .getByLabel("Google Gemini API key", { exact: true })
        .fill(personalKey);
      await page
        .getByRole("button", { name: "Save Gemini API key", exact: true })
        .click();
      await page
        .locator(".ai-key-status")
        .filter({ hasText: "Using your personal Gemini key" })
        .waitFor();
      assert.ok(
        !(await page.evaluate(
          (key) => localStorage.getItem("padhai-ai-settings").includes(key),
          personalKey,
        )),
      );
      await page
        .locator(".module-ai-bar")
        .getByRole("button", { name: "Ask AI", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Ask my AI companion", exact: true })
        .click();
      await page
        .getByText("A short revision exercise is ready.", { exact: true })
        .waitFor();
      assert.deepEqual(usedKeys, [personalKey, personalKey]);
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await page
        .locator(".topbar-cloud")
        .filter({ hasText: "Saved to cloud" })
        .waitFor();
      const studyKey = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("padhai-study-key")),
      );
      const recovered = await browser.newContext();
      const second = await recovered.newPage();
      await signIn(second, credentials, "Recovered Student");
      const stored = await second.evaluate(() => ({
        notes: JSON.parse(localStorage.getItem("padhai-notes")),
        books: JSON.parse(localStorage.getItem("padhai-notebooks")),
        journal: JSON.parse(localStorage.getItem("padhai-journal")),
        events: JSON.parse(localStorage.getItem("padhai-events")),
        tasks: JSON.parse(localStorage.getItem("padhai-tasks")),
      }));
      assert.equal(stored.notes[0].title, "Operating systems");
      assert.equal(stored.notes[0].attachments.length, 1);
      assert.equal(stored.books[0].name, "GATE CS revision");
      assert.ok(
        Object.values(stored.journal.entries).some(
          (entry) => entry.goals?.[0]?.done,
        ),
      );
      assert.equal(stored.events[0].title, "Networks revision");
      assert.equal(stored.tasks[0].title, "Practice GATE questions");
      await recovered.close();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const module of [
          "Study rooms",
          "My exam plan",
          "Study calendar",
          "My progress",
          "My planner",
          "My notes",
          "Daily foundations",
          "A little wisdom",
          "Free resources",
          "Settings",
        ]) {
          await navigate(page, module);
          const sizes = await page.evaluate(() => ({
            content: document.documentElement.scrollWidth,
            viewport: innerWidth,
          }));
          assert.ok(
            sizes.content <= sizes.viewport + 1,
            `${module} overflows at ${width}px: ${JSON.stringify(sizes)}`,
          );
        }
      }
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
      await browser.close();
    }
  },
);

test(
  "desktop and phone-sized study room participants share an embedded kMeet call",
  { timeout: 110000 },
  async () => {
    const browser = await chromium.launch({ channel: "msedge", headless: true });
    const first = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const second = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      permissions: ["clipboard-read", "clipboard-write"],
    });
    try {
      const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
      const policy = vercel.headers.find((route) => route.source === "/(.*)")
        .headers.find(({ key }) => key === "Permissions-Policy").value;
      for (const context of [first, second]) {
        await context.route(base + "/", async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            headers: { ...response.headers(), "permissions-policy": policy },
          });
        });
        await context.route("https://kmeet.infomaniak.com/**", (route) => route.fulfill({
          contentType: "text/html",
          body: "<h1>Test meeting</h1>",
        }));
      }

      const a = await first.newPage();
      const b = await second.newPage();
      await openWorkspace(a, "First Student");
      await a.getByRole("button", { name: "Create a room", exact: true }).first().click();
      await a.getByLabel("Room name", { exact: true }).fill("GATE accountability");
      await a.getByRole("button", { name: "Create & enter room", exact: true }).click();
      await a.getByRole("button", { name: "Invite a friend", exact: true }).click();
      const link = await a.getByLabel("Room invite link", { exact: true }).inputValue();
      await a.getByRole("button", { name: "Copy invite link", exact: true }).click();
      assert.equal(await a.evaluate(() => navigator.clipboard.readText()), link);
      await a.getByRole("button", { name: "Close dialog", exact: true }).click();
      await openWorkspace(b, "Second & Student", link);
      await a.locator(".room-member").filter({ hasText: "Second & Student" }).waitFor();
      await b.locator(".room-member").filter({ hasText: "First Student" }).waitFor();

      await a.getByLabel("Message your study room", { exact: true }).fill("Ready to study GATE CS");
      await a.getByRole("button", { name: "Send message", exact: true }).click();
      await b.locator(".chat-message").filter({ hasText: "Ready to study GATE CS" }).waitFor();
      await a.getByRole("button", { name: "Start together", exact: true }).click();
      await b.getByRole("button", { name: "Pause together", exact: true }).waitFor();
      const rainfall = a.locator(".room-layout").getByRole("button", { name: "Rainfall", exact: true });
      await rainfall.click();
      assert.equal(await rainfall.getAttribute("aria-pressed"), "true");

      const urls = await Promise.all([a, b].map(async (page) => {
        await page.getByRole("button", { name: "Join video call", exact: true }).click();
        const frame = page.frameLocator('iframe[title="kMeet study call"]');
        await frame.getByRole("heading", { name: "Test meeting" }).waitFor();
        assert.deepEqual(await frame.locator("body").evaluate(() => ({
          camera: document.featurePolicy.allowsFeature("camera"),
          microphone: document.featurePolicy.allowsFeature("microphone"),
          screen: document.featurePolicy.allowsFeature("display-capture"),
          speakers: document.featurePolicy.allowsFeature("speaker-selection"),
        })), { camera: true, microphone: true, screen: true, speakers: true });
        assert.equal(page.url(), link);
        assert.equal(page.context().pages().length, 1);
        return new URL(await page.getByTitle("kMeet study call").getAttribute("src"));
      }));
      assert.match(urls[1].href, /^https:\/\/kmeet\.infomaniak\.com\/[a-f0-9]{32}$/);
      assert.equal(urls[0].origin + urls[0].pathname, urls[1].href);
      assert.equal(urls[0].search, "");
      assert.deepEqual([...new URLSearchParams(urls[0].hash.slice(1))], [
        ["userInfo.displayName", JSON.stringify("First Student")],
      ]);
      await b.getByRole("button", { name: "Copy my name", exact: true }).click();
      assert.equal(await b.evaluate(() => navigator.clipboard.readText()), "Second & Student");
      assert.equal(await rainfall.getAttribute("aria-pressed"), "false");
      const desktopFrame = await a.getByTitle("kMeet study call").boundingBox();
      const desktopLayout = await a.locator(".room-layout").boundingBox();
      assert.ok(desktopFrame.width >= desktopLayout.width - 40,
        "The embedded call should span the room on desktop");

      await b.getByRole("button", { name: "Close video call", exact: true }).click();
      await b.getByTitle("kMeet study call").waitFor({ state: "detached" });
      await b.reload();
      await b.getByRole("button", { name: "Join video call", exact: true }).click();
      const embeddedCall = b.getByTitle("kMeet study call");
      await embeddedCall.waitFor();
      assert.equal(await embeddedCall.getAttribute("src"), urls[1].href);

      for (const width of [320, 360, 390]) {
        await b.setViewportSize({ width, height: 680 });
        const frameBounds = await embeddedCall.boundingBox();
        assert.ok(frameBounds.x >= 0 && frameBounds.x + frameBounds.width <= width,
          `The embedded call overflows at ${width}px`);
        const mobileLayout = await b.locator(".room-layout").boundingBox();
        assert.ok(frameBounds.width >= mobileLayout.width - 22,
          `The embedded call should fill the room at ${width}px`);
        const widgets = b.locator(".room-layout .study-widgets");
        const cards = await widgets.evaluate((aside) => {
          const timer = aside.querySelector(".timer-panel").getBoundingClientRect();
          const sound = aside.querySelector(".sound-panel").getBoundingClientRect();
          return { timerRight: timer.right, timerBottom: timer.bottom,
            soundLeft: sound.left, soundRight: sound.right, soundTop: sound.top,
            pageWidth: document.documentElement.scrollWidth };
        });
        assert.ok(cards.timerRight <= width && cards.soundRight <= width &&
          cards.soundLeft >= 0 && cards.soundTop >= cards.timerBottom && cards.pageWidth <= width,
          `The focus and sound cards must stack at ${width}px: ${JSON.stringify(cards)}`);
        await widgets.getByRole("button", { name: "Expand focus timer", exact: true }).click();
        const dialog = b.getByRole("dialog");
        const labelFits = await dialog.locator(".sound-options > button").evaluateAll((buttons) =>
          buttons.every((button) => {
            const range = document.createRange();
            range.selectNodeContents(button.querySelector("span"));
            const label = range.getBoundingClientRect();
            const tile = button.getBoundingClientRect();
            return label.left >= tile.left - 1 && label.right <= tile.right + 1;
          }),
        );
        assert.ok(labelFits, `Sound labels are clipped in Focus at ${width}px`);
        await dialog.getByRole("button", { name: "Back to your study space" }).click();
      }
    } finally {
      await first.close();
      await second.close();
      await browser.close();
    }
  },
);

test(
  "exam subjects, topics, study logs, targets and daily habits can be managed",
  { timeout: 90000 },
  async () => {
    const browser = await chromium.launch({
      channel: "msedge",
      headless: true,
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await openWorkspace(page, "Exam Student");
      await navigate(page, "My exam plan");
      await page.getByRole("button", { name: "Subject", exact: true }).click();
      await page
        .getByLabel("Subject name", { exact: true })
        .fill("QA Algorithms");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const subject = page.locator(".subject-card").filter({
        has: page.getByRole("heading", {
          name: "QA Algorithms",
          exact: true,
        }),
      });
      await subject.locator(".subject-title").click();
      await subject
        .getByRole("button", { name: "Add a topic", exact: true })
        .click();
      await page
        .getByLabel("Topic name", { exact: true })
        .fill("Graph traversal");
      await page
        .getByLabel("Revision notes", { exact: true })
        .fill("Revise BFS and DFS.");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await subject
        .getByRole("button", {
          name: "Mark Graph traversal complete",
          exact: true,
        })
        .click();
      await subject
        .getByRole("button", {
          name: "Edit topic Graph traversal",
          exact: true,
        })
        .click();
      await page.getByLabel("Topic name", { exact: true }).fill("BFS and DFS");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await subject
        .getByRole("button", {
          name: "Mark BFS and DFS incomplete",
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("button", { name: "Log study", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("combobox")
        .selectOption({ label: "QA Algorithms" });
      await page.getByLabel("Minutes studied", { exact: true }).fill("15");
      await page
        .getByRole("button", { name: "Save study log", exact: true })
        .click();
      assert.ok(
        await page.evaluate(() =>
          JSON.parse(localStorage.getItem("padhai-sessions")).some(
            (session) =>
              session.seconds === 900 && session.subject === "QA Algorithms",
          ),
        ),
      );
      await page.locator(".target-card").first().click();
      await page
        .getByLabel("Daily target (minutes)", { exact: true })
        .fill("300");
      await page
        .getByRole("button", { name: "Save targets", exact: true })
        .click();
      await navigate(page, "Daily foundations");
      await page
        .getByRole("button", { name: "New habit", exact: true })
        .click();
      await page
        .getByLabel("Habit name", { exact: true })
        .fill("Read two pages");
      await page
        .getByLabel("The smallest action that counts", { exact: true })
        .fill("Read one paragraph");
      await page
        .getByRole("button", { name: "Save my habit", exact: true })
        .click();
      await page
        .getByRole("button", { name: "I did my minimum", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Done for today · undo", exact: true })
        .waitFor();
      await navigate(page, "My exam plan");
      await page
        .getByRole("button", {
          name: "Delete subject QA Algorithms",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Remove subject", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("heading", { name: "QA Algorithms", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("padhai-profile")).dailyGoal,
        ),
        300,
      );

      await page.route("**/api/ai", (route) =>
        route.fulfill({
          json: {
            examName: "GATE CS",
            subjects: [{ name: "Networks", topics: ["Routing"] }],
          },
        }),
      );
      const importButton = page.getByRole("button", {
        name: "Import syllabus",
        exact: true,
      });
      const saveSyllabus = page.getByRole("button", {
        name: "Save reviewed syllabus",
        exact: true,
      });
      await importButton.click();
      await page.getByLabel("Upload syllabus PDF").setInputFiles({
        name: "gate-cs.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% Test syllabus\n%%EOF\n"),
      });
      await page
        .getByRole("button", { name: "Read PDF with AI", exact: true })
        .click();
      await saveSyllabus.click();
      const originalPdf = page.getByRole("button", {
        name: "Download my original PDF",
        exact: true,
      });
      await originalPdf.waitFor();

      await importButton.click();
      await page
        .getByLabel("Editable import preview")
        .fill("# My outline\n- Review graphs");
      await saveSyllabus.click();
      await originalPdf.waitFor();
      assert.equal(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("padhai-notes")).length,
        ),
        0,
      );

      await page
        .getByRole("combobox", {
          name: "Choose exam subject preset",
          exact: true,
        })
        .selectOption("NEET UG");
      await page
        .getByRole("button", { name: "Use template", exact: true })
        .click();
      await navigate(page, "My notes");
      await page
        .getByText("Saved syllabus · gate-cs.pdf", { exact: true })
        .click();
      await page
        .getByRole("button", { name: "Download gate-cs.pdf", exact: true })
        .waitFor();
    } finally {
      await context.close();
      await browser.close();
    }
  },
);

test(
  "wisdom advances at IST midnight while the tab is open",
  { timeout: 60000 },
  async () => {
    const browser = await chromium.launch({
      channel: "msedge",
      headless: true,
    });
    const context = await browser.newContext({
      timezoneId: "America/Los_Angeles",
    });
    const page = await context.newPage();
    const midnight = Date.parse("2026-12-01T00:00:00+05:30");

    try {
      await page.clock.install({ time: new Date(midnight - 300_000) });
      await openWorkspace(page, "Wisdom Student");
      await page.route("**/api/wisdom/daily?*", async (route) => {
        const kind = new URL(route.request().url()).searchParams.get("kind");
        const current = await page.evaluate(() => Date.now());
        const date = new Date(current + 19800000).toISOString().slice(0, 10);
        await route.fulfill({ json: {
          kind, date, verse: kind + " " + date,
          reference: "Heritage test passage",
          source: "https://heritage.iitk.ac.in/RCM/5.1",
          lang: "sa",
        } });
      });
      await page.route("**/api/ai", async (route) => {
        const { language } = route.request().postDataJSON();
        await route.fulfill({ json: {
          title: language === "hi" ? "हिंदी व्याख्या" : "English explanation",
          meaning: "Meaning", context: "Context", reflection: "Reflection", practice: "Practice",
        } });
      });
      await navigate(page, "A little wisdom");
      await page.getByText("shloka 2026-11-30", { exact: true }).waitFor();
      await page.getByRole("heading", { name: "English explanation" }).waitFor();
      await page.locator(".wisdom-language-tools select").selectOption("hi");
      await page.getByRole("heading", { name: "हिंदी व्याख्या" }).waitFor();
      await page.getByRole("button", { name: "Daily chaupai", exact: true }).click();
      await page.getByText("chaupai 2026-11-30", { exact: true }).waitFor();
      assert.equal(await page.locator(".wisdom-source").getAttribute("href"), "https://heritage.iitk.ac.in/RCM/5.1");

      const now = await page.evaluate(() => Date.now());
      assert.ok(now < midnight);
      await page.clock.fastForward(midnight - now + 1000);
      await page.getByText("chaupai 2026-12-01", { exact: true }).waitFor({ timeout: 5000 });
      await page.getByRole("button", { name: "Daily shloka", exact: true }).click();
      await page.getByText("shloka 2026-12-01", { exact: true }).waitFor();
    } finally {
      await context.close();
      await browser.close();
    }
  },
);

test("notes save, download as PDFs, and import across accounts; login and reset restore the same notes", { timeout: 100000 }, async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const sender = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
    const page = await sender.newPage();
    const credentials = await openWorkspace(page, "Note Author", base + "/?page=notes");
    await page.getByRole("button", { name: "New note", exact: true }).click();
    await page.getByLabel("Note title", { exact: true }).fill("GATE CS · प्रक्रिया");
    const noteText = "यह नोट सही तरह से सहेजा गया है।\n" + "Scheduling and threads. ".repeat(250);
    await page.getByLabel("Note text", { exact: true }).fill(noteText);
    const saved = page.waitForResponse((response) =>
      response.url().endsWith("/api/account") && response.request().method() === "PUT" && response.ok(),
    );
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await saved;
    await page.locator(".note-toolbar [role=status]").getByText("Saved to cloud", { exact: true }).waitFor();

    const exported = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF", exact: true }).click();
    const download = await exported;
    assert.match(download.suggestedFilename(), /\.pdf$/);
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const pdf = Buffer.concat(chunks);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok((await PDFDocument.load(pdf)).getPageCount() > 1);

    await page.getByRole("button", { name: "Share note", exact: true }).click();
    await page.getByRole("button", { name: "Create share link", exact: true }).click();
    const link = await page.getByLabel("Share link", { exact: true }).inputValue();
    await page.getByRole("button", { name: "Copy link", exact: true }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link);
    const unauthenticated = await browser.newContext();
    const noteId = new URL(link).searchParams.get("share");
    assert.equal((await unauthenticated.request.get(base + "/api/note-shares/" + noteId)).status(), 401);
    await unauthenticated.close();

    const recipient = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const friend = await recipient.newPage();
    await openWorkspace(friend, "Note Reader", link);
    await friend.getByRole("button", { name: "Import note", exact: true }).click();
    assert.equal(await friend.getByLabel("Note title", { exact: true }).inputValue(), "GATE CS · प्रक्रिया");
    assert.equal(await friend.getByLabel("Note text", { exact: true }).inputValue(), noteText);
    assert.ok(!new URL(friend.url()).searchParams.has("share"));
    await friend.goto(link);
    await friend.getByRole("button", { name: "Import note", exact: true }).click();
    assert.equal(await friend.locator(".notebook-note-list button").count(), 1);

    const storedBrowser = await sender.storageState();
    const session = storedBrowser.cookies.find((cookie) => cookie.name === "padhai_session");
    assert.equal(session.httpOnly, true);
    assert.ok(session.expires > Date.now() / 1000 + 86400);
    await sender.close();
    const reopened = await browser.newContext({ storageState: storedBrowser });
    const returning = await reopened.newPage();
    await returning.goto(base + "/?page=notes");
    await returning.getByRole("button", { name: "New note", exact: true }).waitFor();
    assert.equal(await returning.getByPlaceholder("Enter your name or nickname").count(), 0);
    assert.equal(await returning.getByRole("button", { name: "Sign in", exact: true }).count(), 0);

    const resetContext = await browser.newContext();
    const reset = await resetContext.newPage();
    await reset.goto(base);
    await reset.getByRole("button", { name: "Sign in", exact: true }).click();
    await reset.getByRole("button", { name: "Forgot password?" }).click();
    await reset.getByLabel("Email address", { exact: true }).fill(credentials.email);
    await reset.getByRole("button", { name: "Email me a reset link", exact: true }).click();
    await reset.getByText(/a reset link will arrive shortly/).waitFor();
    const resetUrl = new URL(resetLinks.get(credentials.email));
    resetUrl.searchParams.set("page", "notes");
    await reset.goto(resetUrl.href);
    await reset.getByLabel("New password", { exact: true }).fill("A changed test password 321");
    await reset.getByRole("button", { name: "Reset password & sign in", exact: true }).click();
    const openCopy = reset.getByRole("button", { name: "Open my account workspace", exact: true });
    await Promise.race([
      openCopy.waitFor().then(() => openCopy.click()),
      reset.getByRole("button", { name: "Open my study space", exact: true }).waitFor(),
    ]);
    await reset.getByRole("button", { name: "Open my study space", exact: true }).click();
    await reset.locator(".notebook-note-list button").filter({ hasText: "GATE CS · प्रक्रिया" }).click();
    assert.equal(await reset.getByLabel("Note text", { exact: true }).inputValue(), noteText);
    assert.equal((await (await reopened.request.get(base + "/api/auth/session")).json()).user, null);
  } finally {
    await browser.close();
  }
});
