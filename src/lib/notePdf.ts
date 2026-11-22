import { PDFDocument } from "pdf-lib";
import type { Note } from "../types";
import { downloadFile } from "./storage";

export async function downloadNotePdf(note: Note, untitled: string) {
  const pdf = await PDFDocument.create();
  const canvas = document.createElement("canvas");
  canvas.width = 1190;
  canvas.height = 1684;
  const ink = canvas.getContext("2d");
  if (!ink) throw new Error("PDF export is unavailable in this browser.");

  const title = note.title.trim() || untitled;
  const margin = 84;
  const textWidth = canvas.width - margin * 2;
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let y = margin;

  function clearPage() {
    ink!.fillStyle = "#ffffff";
    ink!.fillRect(0, 0, canvas.width, canvas.height);
    ink!.fillStyle = "#172033";
    ink!.textBaseline = "top";
    y = margin;
  }

  async function addPage() {
    // Canvas preserves Indic shaping and makes the PDF independent of the viewer's fonts.
    const image = await pdf.embedJpg(canvas.toDataURL("image/jpeg", 0.94));
    pdf.addPage([595, 842]).drawImage(image, { x: 0, y: 0, width: 595, height: 842 });
    clearPage();
  }

  function wrap(paragraph: string) {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.match(/\S+\s*|\s+/g) || []) {
      if (line && ink!.measureText(line + word.trimEnd()).width > textWidth) {
        lines.push(line.trimEnd());
        line = "";
      }
      if (ink!.measureText(word.trimEnd()).width <= textWidth) {
        line += word;
        continue;
      }
      for (const { segment } of segmenter.segment(word)) {
        if (ink!.measureText(line + segment).width > textWidth && line) {
          lines.push(line);
          line = "";
        }
        line += segment;
      }
    }
    lines.push(line.trimEnd());
    return lines;
  }

  async function write(text: string, font: string, lineHeight: number) {
    ink!.font = font;
    for (const paragraph of text.split(/\r?\n/)) {
      for (const line of wrap(paragraph)) {
        if (y + lineHeight > canvas.height - margin) await addPage();
        // Position right-to-left paragraphs at the right margin and let Canvas shape runs.
        const rtl = /^\s*\p{Script=Arabic}/u.test(paragraph);
        ink!.direction = rtl ? "rtl" : "ltr";
        ink!.textAlign = "start";
        ink!.fillText(line, rtl ? canvas.width - margin : margin, y);
        y += lineHeight;
      }
    }
  }

  clearPage();
  pdf.setTitle(title);
  await write(title, 'bold 54px "Times New Roman", serif', 78);
  y += 24;
  await write(note.body, '36px "Times New Roman", serif', 55);
  await addPage();
  const bytes = await pdf.save();
  const filename = title.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 90);
  downloadFile(`${filename}.pdf`, new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
}
