import { createHash } from "node:crypto";
import { chromium, devices } from "@playwright/test";

const commit = process.env.KMEET_SMOKE_COMMIT || process.env.GITHUB_SHA;
const room = createHash("sha256").update("padhai-rtc-smoke:" + commit).digest("hex").slice(0, 32);
const mobile = process.env.KMEET_MOBILE === "1";
const label = mobile ? "Padhai Android test" : "Padhai desktop test";
const kmeet = "https://kmeet.infomaniak.com";
const parent = "http://127.0.0.1:4173/kmeet-network-test";
const browser = await chromium.launch({
  channel: process.env.KMEET_BROWSER,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
try {
  const context = await browser.newContext({
    ...(mobile ? devices["Pixel 7"] : { viewport: { width: 1280, height: 900 } }),
    locale: "en-US",
    permissions: ["camera", "microphone"],
  });
  await context.addInitScript(() => {
    if (location.origin !== "https://kmeet.infomaniak.com") return;
    const NativePeer = window.RTCPeerConnection;
    window.kmeetTestPeers = [];
    window.RTCPeerConnection = class extends NativePeer {
      constructor(...args) {
        super(...args);
        window.kmeetTestPeers.push(this);
      }
    };
  });
  const page = await context.newPage();
  let network = "unavailable";
  try {
    await page.goto("https://www.cloudflare.com/cdn-cgi/trace", { timeout: 8000 });
    const trace = await page.locator("body").innerText({ timeout: 5000 });
    const ip = /^ip=(\S+)/m.exec(trace)?.[1];
    if (ip) network = createHash("sha256").update(room + ":" + ip).digest("hex").slice(0, 16);
  } catch {}
  console.log(JSON.stringify({ label, network }));
  await context.route(parent, route => route.fulfill({
    contentType: "text/html",
    headers: { "Permissions-Policy": 'camera=(self "https://kmeet.infomaniak.com"), microphone=(self "https://kmeet.infomaniak.com"), screen-wake-lock=(self "https://kmeet.infomaniak.com")' },
    body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><iframe allow="autoplay; camera; microphone; display-capture; fullscreen; screen-wake-lock" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-presentation" style="width:100%;height:760px;border:none" src="' + kmeet + "/" + room + '"></iframe>',
  }));
  await page.goto(parent, { waitUntil: "domcontentloaded", timeout: 35000 });
  const frame = page.frameLocator("iframe");
  await frame.getByRole("button", { name: mobile ? "Join in browser" : "From the browser" }).click({ timeout: 35000 });
  await frame.getByPlaceholder("Enter your name", { exact: true }).fill(label, { timeout: 35000 });
  await frame.getByText("Join meeting", { exact: true }).last().click({ timeout: 35000 });
  console.log("Joined in the browser frame. Waiting for the other test participant.");
  const stats = await frame.locator("body").evaluate(async () => {
    const deadline = Date.now() + 185000;
    let audio = 0;
    let video = 0;
    while (Date.now() < deadline && (audio < 15 || video < 10)) {
      const peers = window.kmeetTestPeers || [];
      for (const peer of peers) {
        const reports = await peer.getStats().catch(() => null);
        for (const report of reports?.values() || []) {
          if (report.type !== "inbound-rtp") continue;
          if (report.kind === "audio") audio = Math.max(audio, report.packetsReceived || 0);
          if (report.kind === "video") video = Math.max(video, report.framesDecoded || 0);
        }
      }
      if (audio < 15 || video < 10) await new Promise(resolve => setTimeout(resolve, 750));
    }
    return { audio, video };
  }, undefined, { timeout: 15000 });
  console.log(JSON.stringify({ ...stats, stayedInPage: page.url() === parent, tabs: context.pages().length }));
  if (stats.audio < 15 || stats.video < 10 || page.url() !== parent || context.pages().length !== 1) {
    throw new Error("The embedded call did not receive both media streams.");
  }
  await page.waitForTimeout(15000);
} finally { await browser.close(); }
