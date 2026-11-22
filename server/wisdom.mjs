import { database } from "./db.mjs";

const heritage = "https://heritage.iitk.ac.in";
const dayMs = 86400000;
const indiaOffset = 19800000;
const launchDay = Date.parse("2026-11-22");
const gitaCounts = [47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 35, 27, 20, 24, 28, 78];
const manasCounts = [361, 326, 46, 30, 60, 121, 130];
const gita = gitaCounts.flatMap((count, chapter) =>
  Array.from({ length: count }, (_, verse) => `${chapter + 1}.${verse + 1}`),
);
const manas = manasCounts.flatMap((count, kanda) =>
  Array.from({ length: count }, (_, verse) => `${kanda + 1}.${verse + 1}`),
);

export function wisdomDate(now = Date.now()) {
  return new Date(now + indiaOffset).toISOString().slice(0, 10);
}

function cycle(index, size) {
  return ((index % size) + size) % size;
}

export function dailyReference(kind, date, alternate = 0) {
  const day = (Date.parse(date) - launchDay) / dayMs;
  if (kind === "chaupai") {
    const reference = manas[cycle(day + 763 + alternate, manas.length)];
    return { work: "RCM", reference, book: "Ramcharitmanas", lang: "awa-Deva" };
  }
  const index = cycle(day + alternate, gita.length + 100);
  if (index % 2 === 1 && index < 200)
    return { work: "VRAM", reference: `1.1.${Math.floor(index / 2) + 1}`, book: "Valmiki Ramayana", lang: "sa" };
  const gitaIndex = index - Math.min(100, Math.floor(index / 2));
  const reference = gita[(gitaIndex + 49) % gita.length];
  return { work: "SBG", reference, book: "Mahabharata · Bhagavad Gita", lang: "sa" };
}

export function originalPassage(html, work, reference, alternate = 0) {
  for (const block of html.matchAll(/<script\b[^>]*\btype=(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    let record;
    try {
      record = JSON.parse(block[2]);
    } catch {
      continue;
    }
    if (
      record?.["@type"] !== "Quotation" ||
      record.identifier !== `${work} ${reference}` ||
      typeof record.text !== "string" ||
      !/[\u0900-\u097f]/.test(record.text) ||
      record.text.length > 24000
    )
      continue;
    if (work !== "RCM") return record.text.trim();
    const lines = record.text.match(/(?:^|\n)चौपाई[ \t]*\n([^\n]+(?:\n[^\n]+)*)/)?.[1]
      .split("\n").filter((line) => /[।॥]/.test(line)) || [];
    return lines[alternate]?.trim() || lines[0]?.trim() || "";
  }
  return "";
}

export async function dailyWisdom(kind, date = wisdomDate()) {
  const id = `wisdom-heritage:${date}:${kind}`;
  const sql = "SELECT content FROM syllabus_cache WHERE id = ?";
  const [saved] = await database(sql, [id]);
  if (saved) return JSON.parse(saved.content);

  for (let alternate = 0; alternate < 3; alternate++) {
    const { work, reference, book, lang } = dailyReference(kind, date, alternate);
    const source = `${heritage}/${work}/${reference}`;
    const response = await fetch(source, {
      redirect: "error",
      headers: { Accept: "text/html", "User-Agent": "Padhai/1.0 (daily public verse reader)" },
      signal: AbortSignal.timeout(12000),
    }).catch((error) => {
      console.warn("Heritage source connection failed:", work, reference, error.cause?.code || error.name);
      return null;
    });
    if (!response) break;
    if (response.status === 404) continue;
    if (!response.ok) {
      console.warn("Heritage source returned:", work, reference, response.status);
      break;
    }
    const verse = originalPassage(await response.text(), work, reference, alternate);
    if (!verse) {
      console.warn("Heritage source omitted its original quotation:", work, reference);
      continue;
    }
    const passage = { date, kind, reference: `${book} ${reference}`, source, lang, verse };
    await database(
      "INSERT INTO syllabus_cache (id, content, fetched_at) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING",
      [id, JSON.stringify(passage), Date.now()],
    );
    const [stored] = await database(sql, [id]);
    return JSON.parse(stored.content);
  }
  throw Object.assign(new Error("Today's Heritage passage could not be loaded. Please try again."), { status: 503 });
}

export function prepareDailyWisdom() {
  const tomorrow = wisdomDate(Date.now() + dayMs);
  return Promise.all([dailyWisdom("shloka", tomorrow), dailyWisdom("chaupai", tomorrow)]);
}
