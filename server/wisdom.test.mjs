import test from "node:test";
import assert from "node:assert/strict";
import { dailyReference, originalPassage, wisdomDate } from "./wisdom.mjs";

test("daily references advance at midnight in India and draw from Heritage collections", () => {
  const midnight = Date.parse("2026-11-23T00:00:00+05:30");
  const before = wisdomDate(midnight - 1);
  const after = wisdomDate(midnight);
  assert.equal(before, "2026-11-22");
  assert.equal(after, "2026-11-23");
  assert.equal(dailyReference("shloka", before).work, "SBG");
  assert.equal(dailyReference("shloka", after).work, "VRAM");
  assert.equal(dailyReference("chaupai", before).reference, "5.1");
  assert.equal(dailyReference("chaupai", after).reference, "5.2");
});

test("the reader takes only the matching original verse and the first chaupai line", () => {
  const script = (data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  const verse = "मूल पाठ। मूल पद्य।।";
  const html = script({ "@type": "CreativeWork", identifier: "RCM 5.1", text: "आधुनिक अनुवाद।" }) +
    script({ "@type": "Quotation", identifier: "RCM 5.1", text: `चौपाई\n${verse}\n\nदोहा/सोरठा\nदोहा।।` });
  assert.equal(originalPassage(html, "RCM", "5.1"), verse);
  assert.equal(originalPassage(html, "RCM", "5.2"), "");
});
