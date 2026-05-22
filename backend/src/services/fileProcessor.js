const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule.default || pdfParseModule;

const MAX_PDF_CHARS = 80_000;

async function extractPdfText(fileUrl) {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const data = await pdfParse(buffer);
  let text = (data.text || '').trim();
  if (text.length > MAX_PDF_CHARS) {
    text = text.slice(0, MAX_PDF_CHARS) +
      '\n\n[Note: Document truncated to fit processing limits]';
  }
  return text;
}

async function getImageData(fileUrl) {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  return { data: buffer, mimeType };
}

module.exports = { extractPdfText, getImageData };