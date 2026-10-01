"use client"

export interface ExportWordDocOptions {
  filename?: string
  title?: string
  orientation?: "portrait" | "landscape"
}

/**
 * Exports an HTML element as an editable Microsoft Word (.doc) document.
 * Includes complete Bengali font fallbacks, table borders, header layouts, and A4 print settings.
 */
export function exportElementToWordDoc(
  element: HTMLElement,
  options: ExportWordDocOptions = {}
): boolean {
  if (typeof window === "undefined" || !element) return false

  try {
    const orientation = options.orientation || "portrait"
    const docTitle = options.title || "Exam Result Sheet"
    const rawFilename = options.filename || `${docTitle}.doc`
    const safeFilename = rawFilename
      .replace(/[/\\?%*:|"<>]/g, "-")
      .trim()
      .replace(/\.doc$/i, "") + ".doc"

    // 1. Clone the element to safely sanitize without affecting UI
    const clone = element.cloneNode(true) as HTMLElement

    // 2. Remove interactive UI controls, buttons, or no-print elements
    clone
      .querySelectorAll('button, [data-no-print="true"], .no-print, .print-controls, script, style')
      .forEach((el) => el.remove())

    // 3. Replace inputs/textareas with their text values
    clone.querySelectorAll("input, textarea").forEach((inp) => {
      const inputEl = inp as HTMLInputElement | HTMLTextAreaElement
      const text = inputEl.value || inputEl.placeholder || ""
      const span = document.createElement("span")
      span.textContent = text
      span.className = inputEl.className
      inputEl.replaceWith(span)
    })

    // 4. Resolve image URLs to absolute URLs so Word can load them
    clone.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src")
      if (src && !src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("data:")) {
        try {
          img.src = new URL(src, window.location.origin).href
        } catch {}
      }
      img.style.maxWidth = "80px"
      img.style.maxHeight = "80px"
      img.style.objectFit = "contain"
    })

    // 5. Enhance tables with explicit Word HTML border and spacing attributes
    clone.querySelectorAll("table").forEach((tbl) => {
      tbl.setAttribute("border", "1")
      tbl.setAttribute("cellspacing", "0")
      tbl.setAttribute("cellpadding", "4")
      tbl.style.width = "100%"
      tbl.style.borderCollapse = "collapse"
      tbl.style.border = "1pt solid #000000"
      tbl.style.marginTop = "8pt"
      tbl.style.marginBottom = "8pt"
      tbl.style.fontFamily = "'SolaimanLipi', 'Kalpurush', 'Nikosh', 'Vrinda', 'Arial', sans-serif"
    })

    clone.querySelectorAll("th").forEach((th) => {
      th.style.border = "1pt solid #000000"
      th.style.backgroundColor = "#f1f5f9"
      th.style.padding = "4pt 6pt"
      th.style.fontWeight = "bold"
      th.style.fontSize = "10.5pt"
      th.style.color = "#000000"
    })

    clone.querySelectorAll("td").forEach((td) => {
      td.style.border = "1pt solid #000000"
      td.style.padding = "4pt 6pt"
      td.style.fontSize = "10pt"
      td.style.color = "#000000"
    })

    const bodyHtml = clone.innerHTML

    // 6. Build Word XML Wrapper with A4 page specs & high-fidelity styling
    const wordHtml = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns:v='urn:schemas-microsoft-com:vml'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: ${orientation === "landscape" ? "29.7cm 21.0cm" : "21.0cm 29.7cm"};
      margin: 1.2cm 1.2cm 1.2cm 1.2cm;
      mso-page-orientation: ${orientation};
    }
    @page Section1 {
      size: ${orientation === "landscape" ? "29.7cm 21.0cm" : "21.0cm 29.7cm"};
      margin: 1.2cm 1.2cm 1.2cm 1.2cm;
      mso-header-margin: 36.0pt;
      mso-footer-margin: 36.0pt;
      mso-paper-source: 0;
    }
    div.Section1 {
      page: Section1;
    }
    body {
      font-family: 'SolaimanLipi', 'Kalpurush', 'Nikosh', 'Vrinda', 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.35;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    th, td {
      border: 1pt solid #000000;
      padding: 4pt 6pt;
      font-size: 10pt;
    }
    th {
      background-color: #f1f5f9;
      font-weight: bold;
      text-align: center;
    }
    h1, h2, h3, h4, p {
      margin: 3pt 0;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .font-black, .font-extrabold { font-weight: 900; }
    .font-semibold { font-weight: 600; }
    .font-mono { font-family: 'Courier New', Courier, monospace; }
    .uppercase { text-transform: uppercase; }
    .underline { text-decoration: underline; }
    .bg-slate-50 { background-color: #f8fafc; }
    .bg-slate-100 { background-color: #f1f5f9; }
    .border { border: 1pt solid #000000; }
    .border-b { border-bottom: 1pt solid #000000; }
    .border-b-2 { border-bottom: 2pt solid #000000; }
    .border-t { border-top: 1pt solid #000000; }
    .border-r { border-right: 1pt solid #000000; }
    .border-black { border-color: #000000; }

    /* Word-compatible layout conversions for flex and grid headers */
    .flex, .grid {
      display: table !important;
      width: 100% !important;
    }
    .flex > *, .grid > * {
      display: table-cell !important;
      vertical-align: middle !important;
    }
    .justify-between > *:last-child {
      text-align: right !important;
    }
    .grid-cols-12 > div {
      border-right: 1pt solid #000000 !important;
      padding: 3pt 6pt !important;
    }
    .grid-cols-3 > div {
      width: 33.33% !important;
      text-align: center !important;
    }
    .page-break {
      page-break-before: always;
      mso-special-character: line-break;
    }
  </style>
</head>
<body>
  <div class="Section1">
    ${bodyHtml}
  </div>
</body>
</html>`

    // 7. Create Blob and trigger instant download
    const blob = new Blob(["\ufeff", wordHtml], {
      type: "application/msword;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = safeFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    return true
  } catch (err) {
    console.error("Failed to export Word document:", err)
    return false
  }
}
