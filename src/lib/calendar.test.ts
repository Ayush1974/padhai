import test from "node:test";
import assert from "node:assert/strict";
import { calendarFile, eventTimes, googleCalendarUrl } from "./calendar.ts";

const event = {
  id: "test",
  title: "Revise, graphs; then\npractice",
  date: "2026-11-23",
  time: "09:00",
  minutes: 25,
  subjectId: "",
  done: false,
};
test("calendar exports and Google links use the same IST session time", () => {
  assert.equal(
    new Date(eventTimes(event).start).toISOString(),
    "2026-11-23T03:30:00.000Z",
  );
  assert.equal(
    new URL(googleCalendarUrl(event)).searchParams.get("dates"),
    "20261123T033000Z/20261123T035500Z",
  );
  const text = calendarFile([event]);
  assert.match(text, /DTSTART:20261123T033000Z/);
  assert.match(text, /SUMMARY:Revise\\, graphs\\; then\\npractice/);
  assert.match(text, /TRIGGER:-PT10M/);
  assert.ok(text.endsWith("END:VCALENDAR\r\n"));
});
test("calendar lines fold by UTF-8 bytes without breaking Indic characters", () => {
  const text = calendarFile([{ ...event, title: "पढ़ाई का समय ".repeat(15) }]);
  assert.ok(
    text
      .split("\r\n")
      .every((line) => new TextEncoder().encode(line).length <= 75),
  );
  assert.ok(!text.includes("\uFFFD"));
});
