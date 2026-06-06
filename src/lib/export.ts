import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import jsPDF from "jspdf";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";

type Node = { type?: string; content?: Node[]; text?: string; marks?: { type: string }[]; attrs?: any };

function tiptapToParagraphs(doc: any): Paragraph[] {
  const paras: Paragraph[] = [];
  if (!doc?.content) return [new Paragraph({ children: [new TextRun("")] })];
  for (const block of doc.content as Node[]) {
    const runs: TextRun[] = [];
    const walk = (n: Node) => {
      if (n.type === "text" && n.text) {
        const marks = n.marks ?? [];
        runs.push(new TextRun({
          text: n.text,
          bold: marks.some((m) => m.type === "bold"),
          italics: marks.some((m) => m.type === "italic"),
          underline: marks.some((m) => m.type === "underline") ? {} : undefined,
          strike: marks.some((m) => m.type === "strike"),
        }));
      }
      n.content?.forEach(walk);
    };
    block.content?.forEach(walk);
    if (block.type === "heading") {
      const level = block.attrs?.level ?? 1;
      const heading = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      paras.push(new Paragraph({ heading, children: runs.length ? runs : [new TextRun("")] }));
    } else if (block.type === "bulletList" || block.type === "orderedList") {
      block.content?.forEach((li) => {
        const liRuns: TextRun[] = [];
        const w = (nn: Node) => {
          if (nn.type === "text" && nn.text) liRuns.push(new TextRun(nn.text));
          nn.content?.forEach(w);
        };
        li.content?.forEach(w);
        paras.push(new Paragraph({ bullet: { level: 0 }, children: liRuns }));
      });
    } else {
      const align = block.attrs?.textAlign;
      paras.push(new Paragraph({
        alignment: align === "center" ? AlignmentType.CENTER : align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: runs.length ? runs : [new TextRun("")],
      }));
    }
  }
  return paras;
}

export async function exportDocx(title: string, contentJson: any) {
  const doc = new Document({
    creator: "ASTRA STUDIO",
    title,
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title, bold: true })] }),
        ...tiptapToParagraphs(contentJson),
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${safeName(title)}.docx`);
}

export function exportTxt(title: string, plainText: string) {
  const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
  saveAs(blob, `${safeName(title)}.txt`);
}

/**
 * Render the document as real HTML (so the browser shapes Arabic / mixed
 * text correctly) into an off-screen container, rasterise it with
 * html2canvas, and slice the bitmap across A4 pages. This is the only
 * way to get clean Arabic in jsPDF without bundling a shaping engine.
 *
 * `htmlOrText` may be either rich HTML from the editor (preferred) or a
 * plain-text fallback — both render correctly.
 */
export async function exportPdf(
  title: string,
  htmlOrText: string,
  rtl = false,
) {
  const isHtml = /<[a-z][\s\S]*>/i.test(htmlOrText);
  const bodyHtml = isHtml
    ? htmlOrText
    : `<p>${escapeHtml(htmlOrText).replace(/\n/g, "<br/>")}</p>`;

  // A4 width at 96dpi ≈ 794px. Render at 2x for crisp output.
  const PAGE_W_PX = 794;
  const MARGIN_PX = 56;

  const host = document.createElement("div");
  host.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${PAGE_W_PX}px`,
    "background:#ffffff",
    "color:#000000",
    `padding:${MARGIN_PX}px`,
    "box-sizing:border-box",
    "font-family:'Segoe UI','Noto Naskh Arabic','Noto Sans Arabic',Tahoma,Arial,sans-serif",
    "font-size:14px",
    "line-height:1.7",
    `direction:${rtl ? "rtl" : "ltr"}`,
    `text-align:${rtl ? "right" : "left"}`,
  ].join(";");
  host.innerHTML =
    `<h1 style="font-size:22px;margin:0 0 18px 0;">${escapeHtml(title)}</h1>` +
    `<div>${bodyHtml}</div>`;
  document.body.appendChild(host);

  try {
    const canvas = await html2canvas(host, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let heightLeft = imgH;
    let position = 0;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(dataUrl, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(dataUrl, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(`${safeName(title)}.pdf`);
  } finally {
    host.remove();
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeName(s: string) {
  return s.replace(/[^a-zA-Z0-9\u0600-\u06FF _-]/g, "_").slice(0, 80) || "document";
}
