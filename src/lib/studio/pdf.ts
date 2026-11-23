export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  const count = Math.min(doc.numPages, 30);
  for (let number = 1; number <= count; number += 1) {
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) pages.push(line);
  }
  const text = pages.join("\n\n");
  if (!text) throw new Error("No text found. If this is a scan, paste the story instead.");
  return text;
}
