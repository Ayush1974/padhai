import { extractText, getDocumentProxy } from "unpdf";
// PDF.js uses Promise.try; this keeps local Node 22 installations compatible.
if (!Promise.try)
  Promise.try = (callback, ...args) =>
    new Promise((resolve) => resolve(callback(...args)));

export const officialSources = {
  gatecs: {
    title: "GATE 2027 CS · official IIT Madras syllabus",
    url: "https://gate2027.iitm.ac.in/static/doc/GATE2027_Syllabus/CS_GATE2027_Syllabus.pdf",
  },
  jee: {
    title: "JEE Main · official NTA syllabus",
    url: "https://jeemain.nta.nic.in/documents/",
  },
  neet: {
    title: "NEET UG · official NTA syllabus",
    url: "https://neet.nta.nic.in/document/syllabus-for-neet-ug-2026-examination/",
  },
  upsc: {
    title: "UPSC CSE · official 2026 examination notice",
    url: "https://www.upsc.gov.in/uploads/2026/05/Civil-Services-Preliminary-Examination-2026-Notice-E.pdf",
  },
  ssc: {
    title: "SSC CGL · official 2026 examination notice",
    url: "https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf",
  },
};

export function isOfficialUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      [
        "gate2027.iitm.ac.in",
        "jeemain.nta.nic.in",
        "neet.nta.nic.in",
        "www.upsc.gov.in",
        "upsc.gov.in",
        "cms.upsc.gov.in",
        "ssc.gov.in",
        "cdnbbsr.s3waas.gov.in",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

async function officialFetch(url, depth = 0) {
  if (!isOfficialUrl(url) || depth > 4)
    throw new Error(
      "The source redirected outside the supported official websites.",
    );
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(18000),
    headers: {
      "User-Agent": "PadhaiStudy/1.0 (educational syllabus reader)",
      Accept: "text/html,application/pdf",
    },
  });
  if ([301, 302, 303, 307, 308].includes(response.status))
    return officialFetch(
      new URL(response.headers.get("location"), url).href,
      depth + 1,
    );
  if (!response.ok)
    throw new Error(
      `The official website returned ${response.status}. Open the source and paste its outline instead.`,
    );
  if (Number(response.headers.get("content-length") || 0) > 10_000_000)
    throw new Error(
      "This official document is too large to import automatically.",
    );
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 10_000_000) {
      await reader.cancel();
      throw new Error(
        "This official document is too large to import automatically.",
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  });
  return { bytes, type: response.headers.get("content-type") || "", url };
}

export function outlineFromText(text) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const gateSections = [
    ...text.matchAll(
      /Section\s+\d+\s*:\s*([^\n]+)\n([\s\S]*?)(?=\nSection\s+\d+\s*:|$)/gi,
    ),
  ];
  if (gateSections.length)
    return gateSections.map((section) => ({
      name: section[1].trim(),
      topics: section[2]
        .replace(/GATE 2027[^\n]*|IIT Madras[^\n]*/g, "")
        .split(/\n|(?<=\.)\s+(?=[A-Z])/)
        .map((value) => value.replace(/\s+/g, " ").trim())
        .filter((value) => value.length > 5 && !/^CS\s+Computer/i.test(value))
        .map((value) => value.slice(0, 200)),
    }));
  const result = [];
  let subject = "Official syllabus";
  const headings =
    /^(?:PHYSICS|CHEMISTRY|MATHEMATICS|BIOLOGY|BOTANY|ZOOLOGY|GENERAL STUDIES(?:[ -]+[IVX]+)?|GENERAL APTITUDE|GENERAL INTELLIGENCE(?: &| AND)? REASONING|ENGLISH(?: LANGUAGE| COMPREHENSION)?|QUANTITATIVE APTITUDE|GENERAL AWARENESS)$/i;
  for (const line of lines) {
    const plain = line
      .replace(/^(?:SYLLABUS FOR|SYLLABUS OF|SECTION\s+[A-Z]:?)\s*/i, "")
      .trim();
    if (headings.test(plain)) {
      subject = plain;
      result.push({ subject, title: null });
      continue;
    }
    const unit = line.match(
      /^(?:UNIT|CHAPTER|TOPIC)\s*[-:]?\s*\d+\s*[:.\-–]?\s*(.{3,180})$/i,
    );
    const numbered = line.match(
      /^(?:\d{1,2}(?:\.\d{1,2}){0,2})[.) :]+(.{8,170})$/,
    );
    const bullet = line.match(/^[•●▪\-]\s*(.{8,180})$/);
    const title = unit?.[1] || numbered?.[1] || bullet?.[1];
    if (
      title &&
      !/^(?:page |note |https?:|www\.)/i.test(title) &&
      !result.some((item) => item.subject === subject && item.title === title)
    )
      result.push({ subject, title });
  }
  const subjects = [];
  for (const item of result) {
    let section = subjects.find((value) => value.name === item.subject);
    if (!section) {
      section = { name: item.subject, topics: [] };
      subjects.push(section);
    }
    if (item.title) section.topics.push(item.title);
  }
  return subjects
    .filter((item) => item.topics.length)
    .slice(0, 50)
    .map((item) => ({ ...item, topics: item.topics.slice(0, 250) }));
}

export async function fetchSyllabus(exam) {
  const source = officialSources[exam];
  if (!source)
    throw Object.assign(new Error("Choose a supported exam."), { status: 400 });
  try {
    let document = await officialFetch(source.url);
    for (
      let depth = 0;
      depth < 3 &&
      !document.type.includes("pdf") &&
      !document.url.toLowerCase().endsWith(".pdf");
      depth++
    ) {
      const html = new TextDecoder().decode(document.bytes);
      const links = [
        ...html.matchAll(
          /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        ),
      ]
        .map((match) => ({
          url: new URL(match[1].replace(/&amp;/g, "&"), document.url).href,
          label: match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " "),
        }))
        .filter((link) => isOfficialUrl(link.url));
      const candidate =
        links.find(
          (link) =>
            /syllabus/i.test(link.label + " " + link.url) &&
            /\.pdf(?:$|\?)/i.test(link.url),
        ) ||
        links.find(
          (link) =>
            /syllabus/i.test(link.label + " " + link.url) &&
            link.url !== document.url,
        ) ||
        links.find(
          (link) =>
            /\.pdf(?:$|\?)/i.test(link.url) &&
            /view|download/i.test(link.label),
        );
      if (!candidate)
        throw new Error(
          "No downloadable syllabus was found on the official page.",
        );
      document = await officialFetch(candidate.url);
    }
    if (
      !document.type.includes("pdf") &&
      !document.url.toLowerCase().endsWith(".pdf")
    )
      throw new Error("The official document is not a readable PDF.");
    const pdf = await getDocumentProxy(document.bytes, {
      isEvalSupported: false,
      maxImageSize: 1_000_000,
    });
    let text;
    try {
      if (pdf.numPages > 180)
        throw new Error("This document has too many pages to import safely.");
      ({ text } = await extractText(pdf, { mergePages: true }));
    } finally {
      await pdf.destroy();
    }
    if (text.trim().length < 100)
      throw new Error(
        "This PDF appears to be scanned. Paste an outline from the official source instead.",
      );
    if (exam === "upsc") {
      const start = text.search(/SECTION\s+III\s*[:.\-–]?\s*SYLLABI/i);
      if (start >= 0) text = text.slice(start);
    }
    if (exam === "ssc") {
      const start = text.search(/13\.10\s+Indicative Syllabus/i);
      if (start >= 0) text = text.slice(start, start + 60000);
    }
    return {
      title: source.title,
      url: document.url,
      fetchedAt: new Date().toISOString(),
      text: text.slice(0, 180000),
      outline: outlineFromText(text),
      warning:
        "This is an automatically extracted outline. Check the source PDF and exam year before importing. Editing your copy does not change the official syllabus.",
    };
  } catch (error) {
    throw Object.assign(
      new Error(
        error.message ||
          "The official source could not be read. Try again or paste its outline.",
      ),
      { status: 502 },
    );
  }
}
