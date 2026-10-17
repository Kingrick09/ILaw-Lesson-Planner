/**
 * Professional Microsoft Word Exporter with UTF-8 BOM, Symbol Sanitization,
 * and Full Table Layout Preservation.
 */

export interface WordExportOptions {
  contentHtml: string;
  subject: string;
  grade: string;
  filename?: string;
}

/**
 * Remove unnecessary markdown symbols, orphan asterisks, escape backslashes,
 * and normalize characters so Word doesn't display stray symbols.
 */
export function sanitizeContentForWord(rawHtml: string): string {
  if (!rawHtml) return "";

  let cleaned = rawHtml
    // Convert markdown bold to standard HTML bold
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // Convert markdown italic to standard HTML italic
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Remove escaping backslashes from markdown
    .replace(/\\([-_*.#\[\]()\\/])/g, "$1")
    // Remove markdown headers that might be in raw text
    .replace(/(^|\s)#{1,6}\s+/gm, "$1")
    // Strip orphan markdown asterisks
    .replace(/\*\*/g, "")
    // Normalize non-breaking spaces and unicode spaces that Word turns into "Â"
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00A0/g, " ")
    // Clean up unnecessary unicode control characters
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Ensure words separated by slashes have spaces so they don't look crowded
    .replace(/([a-zA-Z])\/([a-zA-Z])/g, "$1 / $2");

  // Enhance tables with inline attributes for 100% Microsoft Word rendering
  cleaned = cleaned
    .replace(
      /<table([^>]*)>/gi,
      `<table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse; border:1.5pt solid #475569; font-family:Calibri,Arial,sans-serif; font-size:10.5pt; margin:12pt 0;"$1>`
    )
    .replace(
      /<tr([^>]*class="[^"]*bg-slate-(200|300)[^"]*"[^>]*)>/gi,
      `<tr bgcolor="#e2e8f0" style="background-color:#e2e8f0; font-weight:bold;"$1>`
    )
    .replace(
      /<th([^>]*)>/gi,
      `<th bgcolor="#e2e8f0" style="border:1.5pt solid #475569; padding:7pt 9pt; background-color:#e2e8f0; font-weight:bold; vertical-align:top; text-align:left;"$1>`
    )
    .replace(
      /<td([^>]*class="[^"]*bg-slate-100[^"]*"[^>]*)>/gi,
      `<td bgcolor="#f8fafc" style="background-color:#f8fafc; font-weight:bold; width:28%; border:1pt solid #475569; padding:6pt 8pt; vertical-align:top;"$1>`
    )
    .replace(/<td([^>]*)>/gi, (match) => {
      if (match.includes("style=")) return match;
      return `<td style="border:1pt solid #475569; padding:6pt 8pt; vertical-align:top;"${match.slice(3)}`;
    });

  return cleaned;
}

/**
 * Export HTML content as a formatted Microsoft Word document (.doc)
 * Preserves exact arrangement, table format, and strips stray symbols.
 */
export function exportToWord(options: WordExportOptions): void {
  const {
    contentHtml,
    subject,
    grade,
    filename = `ILAW_Lesson_${subject || "Curriculum"}_${grade || "Standard"}.doc`,
  } = options;

  const sanitizedBody = sanitizeContentForWord(contentHtml);

  // Microsoft Word Office HTML template with UTF-8 metadata
  const wordDocumentHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="Microsoft Word 15">
  <meta name="Originator" content="Microsoft Word 15">
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <title>${subject} - ${grade}</title>
  <style>
    @page Section1 {
      size: 8.5in 11.0in;
      margin: 0.8in 0.8in 0.8in 0.8in;
      mso-header-margin: 0.5in;
      mso-footer-margin: 0.5in;
      mso-paper-source: 0;
    }
    div.Section1 {
      page: Section1;
    }
    body {
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      margin: 10pt 0 15pt 0;
    }
    th, td {
      border: 1pt solid #475569 !important;
      padding: 6pt 8pt !important;
      vertical-align: top;
      font-size: 10pt;
    }
    th, tr.bg-slate-200, tr.bg-slate-300, td.bg-slate-200, td.bg-slate-300 {
      background-color: #e2e8f0 !important;
      font-weight: bold !important;
    }
    td.bg-slate-100 {
      background-color: #f8fafc !important;
      font-weight: bold !important;
      width: 28% !important;
    }
    p {
      margin: 3pt 0 4pt 0;
    }
    ul, ol {
      margin: 3pt 0 4pt 18pt;
      padding: 0;
    }
    li {
      margin-bottom: 2pt;
    }
    strong, b {
      color: #0f172a;
    }
    .slide {
      background-color: #1e293b;
      color: #ffffff;
      padding: 20pt;
      border-radius: 8pt;
      margin-bottom: 16pt;
      border: 2pt solid #334155;
      page-break-inside: avoid;
    }
    .slide h2, .slide h3 {
      color: #fde047;
      margin-top: 0;
    }
    .flashcard {
      background-color: #fefce8;
      border: 1.5pt solid #fde047;
      padding: 14pt;
      margin-bottom: 12pt;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="Section1">
    ${sanitizedBody}
  </div>
</body>
</html>`;

  // Prepend \uFEFF (UTF-8 Byte Order Mark) so Word on Windows/Mac opens as UTF-8 without mojibake
  const blob = new Blob(["\uFEFF", wordDocumentHtml], {
    type: "application/msword;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}
