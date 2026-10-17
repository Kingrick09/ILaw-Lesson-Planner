import { jsPDF } from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";

export interface PdfExportOptions {
  contentHtml: string;
  subject: string;
  grade: string;
  teacherName?: string;
  duration?: string;
  competency?: string;
  filename?: string;
}

/**
 * Clean HTML text into plain text with line breaks preserved,
 * slashes spaced for proper word wrapping, and symbols sanitized.
 */
function cleanCellText(html: string): string {
  if (!html) return "";

  return html
    // Replace breaks with newlines
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    // Format list items cleanly
    .replace(/<li[^>]*>/gi, "  •  ")
    .replace(/<\/li>/gi, "\n")
    // Strip bold/italic tags while preserving text
    .replace(/<\/?(strong|b)>/gi, "")
    .replace(/<\/?(em|i)>/gi, "")
    // Remove other HTML tags
    .replace(/<[^>]+>/g, "")
    // Unescape common HTML entities
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Sanitize unnecessary markdown symbols and backslashes
    .replace(/\\([-_*.#\[\]()\\/])/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/(^|\s)#{1,6}\s+/gm, "$1")
    // Space words separated by slashes so jsPDF can wrap them cleanly without overflowing cells
    .replace(/([a-zA-Z0-9])\/([a-zA-Z0-9])/g, "$1 / $2")
    // Normalize lines
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Export Lesson Plan preserving the exact generated DepEd table layout.
 * Fixed column widths guarantee words NEVER overflow the table.
 */
export async function exportLessonPlanToPdf(options: PdfExportOptions): Promise<void> {
  const {
    contentHtml,
    subject,
    grade,
    filename = `ILAW_Lesson_${subject || "Plan"}_${grade || "Standard"}.pdf`,
  } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter", // 612 x 792 pt
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 612 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 792 pt
  const margin = 36; // 0.5 inch margins
  const contentWidth = pageWidth - margin * 2; // Exactly 540 pt

  // Parse HTML table
  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(contentHtml, "text/html");
  const tableEl = parsedDoc.querySelector("table");

  if (tableEl) {
    const tableRows: RowInput[] = [];
    const rawRows = Array.from(tableEl.querySelectorAll("tr"));

    rawRows.forEach((tr, rowIndex) => {
      const cells = Array.from(tr.querySelectorAll("th, td"));
      if (cells.length === 0) return;

      const isBannerHeader = rowIndex === 0 || tr.parentElement?.tagName.toLowerCase() === "thead";
      const isSectionHeader =
        tr.classList.contains("bg-slate-300") ||
        tr.classList.contains("bg-slate-200") ||
        cells.some((c) => c.tagName.toLowerCase() === "th" && parseInt(c.getAttribute("colspan") || "1", 10) >= 2);

      const rowData = cells.map((cell, cellIdx) => {
        const text = cleanCellText(cell.innerHTML);
        const colSpan = parseInt(cell.getAttribute("colspan") || "1", 10);
        const rowSpan = parseInt(cell.getAttribute("rowspan") || "1", 10);
        const isFirstCol = cellIdx === 0 && cells.length > 1;

        let fillColor: [number, number, number] = [255, 255, 255];
        let textColor: [number, number, number] = [15, 23, 42];
        let fontStyle: "normal" | "bold" = "normal";
        let halign: "left" | "center" | "right" = "left";
        let fontSize = 8.5;

        if (isBannerHeader) {
          // Official Header (Republic of the Philippines / DepEd)
          fillColor = [241, 245, 249]; // Slate 100
          textColor = [15, 23, 42]; // Slate 900
          fontStyle = "bold";
          halign = "center";
          fontSize = 9.5;
        } else if (isSectionHeader) {
          // Section header (INTENTIONS, LEARNING EXPERIENCE, ASSESSMENT)
          fillColor = [226, 232, 240]; // Slate 200
          textColor = [15, 23, 42];
          fontStyle = "bold";
          halign = "left";
          fontSize = 9;
        } else if (isFirstCol) {
          // Left label column
          fillColor = [248, 250, 252]; // Slate 50
          textColor = [30, 41, 59];
          fontStyle = "bold";
          fontSize = 8.5;
        } else {
          // Right content column
          fillColor = [255, 255, 255];
          textColor = [30, 41, 59];
          fontStyle = "normal";
          fontSize = 8.5;
        }

        return {
          content: text,
          colSpan,
          rowSpan,
          styles: {
            fillColor,
            textColor,
            fontStyle,
            halign,
            fontSize,
            cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
          },
        };
      });

      tableRows.push(rowData);
    });

    // Render table with fixed column widths that match the page exactly
    autoTable(doc, {
      body: tableRows,
      startY: margin,
      margin: { left: margin, right: margin, top: margin, bottom: 36 },
      tableWidth: contentWidth, // Exactly 540 pt
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        lineColor: [71, 85, 105], // Slate 600 crisp border
        lineWidth: 0.75,
        overflow: "linebreak",
      },
      columnStyles: {
        0: { cellWidth: 150 },
        1: { cellWidth: 390 },
      },
      didDrawPage: (data) => {
        const totalPages = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Page ${data.pageNumber} of ${totalPages}   •   ILAW Master Curriculum Engine (DepEd Matatag Aligned)`,
          pageWidth / 2,
          pageHeight - 16,
          { align: "center" }
        );
      },
    });
  } else {
    // If no table, format structured paragraphs with word wrapping
    const text = cleanCellText(contentHtml);
    const splitLines = doc.splitTextToSize(text, contentWidth);

    autoTable(doc, {
      body: [[splitLines.join("\n")]],
      startY: margin,
      margin: { left: margin, right: margin, top: margin, bottom: 36 },
      tableWidth: contentWidth,
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 9.5,
        cellPadding: 8,
        overflow: "linebreak",
      },
      didDrawPage: (data) => {
        const totalPages = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Page ${data.pageNumber} of ${totalPages}   •   ILAW Master Curriculum Engine`,
          pageWidth / 2,
          pageHeight - 16,
          { align: "center" }
        );
      },
    });
  }

  doc.save(filename);
}

/**
 * Export Presentation Slides as a cleanly paginated PDF deck
 */
export async function exportPresentationToPdf(options: PdfExportOptions): Promise<void> {
  const {
    contentHtml,
    subject,
    grade,
    teacherName = "Teacher",
    filename = `ILAW_Presentation_Slides_${subject || "Deck"}_${grade || "Standard"}.pdf`,
  } = options;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter", // 792 x 612 pt
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 792 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 612 pt
  const margin = 40;
  const contentWidth = pageWidth - margin * 2; // 712 pt

  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(contentHtml, "text/html");
  const slideEls = Array.from(parsedDoc.querySelectorAll(".slide"));

  if (slideEls.length === 0) {
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(subject ? `${subject} (${grade})` : "Presentation Deck", pageWidth / 2, 200, { align: "center" });
    doc.save(filename);
    return;
  }

  // 1. Title Cover Slide
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Emerald Accent bar
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.rect(margin, 60, 8, 80, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(subject ? subject.toUpperCase() : "CURRICULUM LESSON", margin + 25, 95);

  doc.setFontSize(16);
  doc.setTextColor(253, 224, 71); // Amber 300
  doc.text(`${grade || "DepEd Standard"}  •  Instructional Presentation Deck`, margin + 25, 125);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(`Educator: ${teacherName}   |   Generated via ILAW Master Curriculum`, margin + 25, 155);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Instructional Visual Deck & Classroom Discussion Modules", margin + 25, pageHeight - 50);

  // 2. Content Slides
  slideEls.forEach((slide, idx) => {
    doc.addPage("letter", "landscape");

    // Background
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // Top Header Banner
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, pageWidth, 56, "F");

    const rawTitle = slide.querySelector("h2")?.textContent || `Slide ${idx + 1}`;
    const title = cleanCellText(rawTitle);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, margin, 36);

    // Slide Counter Tag
    doc.setFillColor(234, 179, 8); // Yellow 500
    doc.rect(pageWidth - margin - 70, 16, 70, 24, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9.5);
    doc.text(`Slide ${idx + 1}/${slideEls.length}`, pageWidth - margin - 35, 32, { align: "center" });

    // Slide Body Content
    const bodyItems: string[] = [];
    const listItems = Array.from(slide.querySelectorAll("li"));
    const paragraphs = Array.from(slide.querySelectorAll("p"));

    if (listItems.length > 0) {
      listItems.forEach((li) => {
        bodyItems.push(`•  ${cleanCellText(li.innerHTML)}`);
      });
    } else if (paragraphs.length > 0) {
      paragraphs.forEach((p) => {
        bodyItems.push(cleanCellText(p.innerHTML));
      });
    } else {
      bodyItems.push(cleanCellText(slide.innerHTML));
    }

    let currentY = 85;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);

    bodyItems.forEach((item) => {
      const wrapped = doc.splitTextToSize(item, contentWidth - 40);
      if (currentY + wrapped.length * 17 > pageHeight - 50) return;

      // Card container for item
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, wrapped.length * 17 + 14, 6, 6, "FD");

      doc.text(wrapped, margin + 16, currentY + 16);
      currentY += wrapped.length * 17 + 22;
    });

    // Footer
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`ILAW Instructional Deck   •   ${subject} (${grade})`, margin, pageHeight - 18);
  });

  doc.save(filename);
}

/**
 * Export Flashcards as printable study cards
 */
export async function exportFlashcardsToPdf(options: PdfExportOptions): Promise<void> {
  const {
    contentHtml,
    subject,
    grade,
    filename = `ILAW_Flashcards_${subject || "Cards"}_${grade || "Standard"}.pdf`,
  } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter", // 612 x 792 pt
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;

  // Header Banner
  doc.setFillColor(6, 78, 59);
  doc.rect(margin, margin, pageWidth - margin * 2, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("STUDENT FLASHCARDS & REVIEW SYSTEM", pageWidth / 2, margin + 18, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(253, 224, 71);
  doc.text(`${subject || "Curriculum"}  •  ${grade || "Formative Review Questions"}`, pageWidth / 2, margin + 31, {
    align: "center",
  });

  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(contentHtml, "text/html");
  const cardEls = Array.from(parsedDoc.querySelectorAll(".flashcard"));

  if (cardEls.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text("No flashcards found in current presentation.", margin, margin + 70);
    doc.save(filename);
    return;
  }

  // Render cards in a 2-column grid
  const cardWidth = (pageWidth - margin * 2 - 16) / 2; // ~262 pt
  const cardHeight = 145; // pt
  const startY = margin + 55;
  let currentY = startY;

  cardEls.forEach((card, idx) => {
    const col = idx % 2;
    if (idx > 0 && col === 0) {
      currentY += cardHeight + 14;
      if (currentY + cardHeight > pageHeight - 36) {
        doc.addPage("letter", "portrait");
        currentY = margin + 20;
      }
    }

    const cardX = margin + col * (cardWidth + 16);

    // Card background
    doc.setFillColor(254, 252, 232); // Amber 50
    doc.setDrawColor(253, 230, 138); // Amber 200
    doc.setLineWidth(1);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 6, 6, "FD");

    // Card Header Tag
    doc.setFillColor(253, 224, 71); // Amber 300
    doc.rect(cardX + cardWidth - 60, currentY, 60, 18, "F");
    doc.setTextColor(120, 53, 15); // Amber 900
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`Card ${idx + 1}`, cardX + cardWidth - 30, currentY + 12, { align: "center" });

    // Parse Card Text
    const lines = (card.textContent || "").split("\n").map((l) => cleanCellText(l)).filter(Boolean);
    const title = lines[0] || `Flashcard #${idx + 1}`;
    const rest = lines.slice(1).join("\n");

    doc.setTextColor(120, 53, 15);
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    const wrappedTitle = doc.splitTextToSize(title, cardWidth - 75);
    doc.text(wrappedTitle, cardX + 10, currentY + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const wrappedBody = doc.splitTextToSize(rest, cardWidth - 20);
    doc.text(wrappedBody.slice(0, 7), cardX + 10, currentY + 42);

    // Bottom Badge
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text("ILAW Active Review Module", cardX + 10, currentY + cardHeight - 8);
  });

  doc.save(filename);
}

/**
 * Print / Save as PDF via native browser dialog
 */
export function printContent(contentHtml: string, title: string): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(getPrintableHtml(contentHtml, title));
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 500);
    }
    return;
  }

  printWindow.document.open();
  printWindow.document.write(getPrintableHtml(contentHtml, title));
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

function getPrintableHtml(contentHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      margin: 15mm;
      size: letter portrait;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 15px;
      line-height: 1.5;
      font-size: 11pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th, td {
      border: 1px solid #64748b;
      padding: 7px 10px;
      text-align: left;
      vertical-align: top;
      font-size: 9.5pt;
    }
    th, .bg-slate-200, .bg-slate-300 {
      background-color: #e2e8f0 !important;
      font-weight: bold !important;
    }
    .bg-slate-100 {
      background-color: #f8fafc !important;
      font-weight: 600 !important;
    }
    ul, ol {
      margin: 4px 0 4px 18px;
      padding: 0;
    }
    li {
      margin-bottom: 3px;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>`;
}
