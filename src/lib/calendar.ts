import type { CalendarEvent, Task } from "../types";

function timestamp(time: number) {
  return new Date(time)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
function fold(line: string) {
  let result = "",
    size = 0;
  for (const character of line) {
    const bytes = new TextEncoder().encode(character).length;
    if (size + bytes > 73) {
      result += "\r\n ";
      size = 1;
    }
    result += character;
    size += bytes;
  }
  return result;
}

export function eventTimes(event: CalendarEvent) {
  const start = Date.parse(`${event.date}T${event.time}:00+05:30`);
  return { start, end: start + event.minutes * 60000 };
}
export function googleCalendarUrl(event: CalendarEvent) {
  const { start, end } = eventTimes(event);
  const parameters = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${timestamp(start)}/${timestamp(end)}`,
    ctz: "Asia/Kolkata",
    details:
      "Study session planned in Padhai. Review your reminder settings before saving.",
  });
  return `https://calendar.google.com/calendar/render?${parameters}`;
}
export function calendarFile(events: CalendarEvent[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Padhai//Study Planner//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const event of events) {
    const { start, end } = eventTimes(event);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id.replace(/[^a-zA-Z0-9-]/g, "")}@padhai`,
      `DTSTAMP:${timestamp(Date.now())}`,
      `DTSTART:${timestamp(start)}`,
      `DTEND:${timestamp(end)}`,
      `SUMMARY:${escapeText(event.title)}`,
      "DESCRIPTION:Study session planned in Padhai.",
      "BEGIN:VALARM",
      "TRIGGER:-PT10M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
export function taskAsEvent(task: Task): CalendarEvent {
  return {
    id: task.id,
    title: task.title,
    date: task.date,
    time: "09:00",
    minutes: 25,
    subjectId: "",
    done: task.done,
  };
}
