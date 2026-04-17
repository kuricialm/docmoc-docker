const fs = require('fs');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const JSZip = require('jszip');

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
const MOJIBAKE_REGEX = /[ÃØÙÐÑ][\u0080-\u00FF]?/g;

function countMatches(value, regex) {
  return (value.match(regex) || []).length;
}

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function normalizeWhitespace(value) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function scoreDecodedText(value) {
  const arabicCount = countMatches(value, ARABIC_REGEX);
  const replacementCount = (value.match(/�/g) || []).length;
  const mojibakeCount = countMatches(value, MOJIBAKE_REGEX);
  return arabicCount * 3 - replacementCount * 5 - mojibakeCount;
}

function decodeTextBuffer(buffer) {
  const candidates = [];

  try {
    candidates.push(new TextDecoder('utf-8').decode(buffer));
  } catch (_) {
    // Ignore decode failures and keep trying fallbacks.
  }

  for (const encoding of ['windows-1256', 'windows-1252']) {
    try {
      candidates.push(new TextDecoder(encoding).decode(buffer));
    } catch (_) {
      // Some runtimes may not support all legacy encodings.
    }
  }

  const best = candidates
    .filter(Boolean)
    .sort((left, right) => scoreDecodedText(right) - scoreDecodedText(left))[0];

  return normalizeWhitespace(best || buffer.toString('utf8'));
}

async function extractPdfText(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const document = await pdfjs.getDocument({
    data,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => (typeof item?.str === 'string' ? item.str : ''))
      .filter(Boolean)
      .join(' ')
      .trim();
    if (pageText) {
      pages.push(`Page ${pageNumber}\n${pageText}`);
    }
  }

  if (typeof document.destroy === 'function') {
    document.destroy();
  }

  return normalizeWhitespace(pages.join('\n\n'));
}

async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return normalizeWhitespace(result?.value || '');
}

function extractXlsxText(filePath) {
  const workbook = XLSX.readFile(filePath, {
    dense: true,
    cellHTML: false,
    cellFormula: false,
    cellNF: false,
    cellStyles: false,
    cellText: true,
  });

  const sections = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
      raw: false,
    });
    const lines = rows
      .map((row) => (Array.isArray(row) ? row.join('\t').trim() : ''))
      .filter(Boolean);
    if (lines.length) {
      sections.push(`Sheet: ${sheetName}\n${lines.join('\n')}`);
    }
  }

  return normalizeWhitespace(sections.join('\n\n'));
}

async function extractPptxText(filePath) {
  const archive = await JSZip.loadAsync(fs.readFileSync(filePath));
  const slideEntries = Object.keys(archive.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => {
      const leftNumber = Number(left.match(/slide(\d+)\.xml$/)?.[1] || 0);
      const rightNumber = Number(right.match(/slide(\d+)\.xml$/)?.[1] || 0);
      return leftNumber - rightNumber;
    });

  const slides = [];

  for (const entryName of slideEntries) {
    const xml = await archive.file(entryName)?.async('string');
    if (!xml) continue;

    const texts = [];
    const textRegex = /<a:t[^>]*>(.*?)<\/a:t>/g;
    let match = textRegex.exec(xml);
    while (match) {
      const decoded = decodeXmlEntities(match[1] || '').trim();
      if (decoded) texts.push(decoded);
      match = textRegex.exec(xml);
    }

    if (texts.length) {
      const slideNumber = Number(entryName.match(/slide(\d+)\.xml$/)?.[1] || slides.length + 1);
      slides.push(`Slide ${slideNumber}\n${texts.join('\n')}`);
    }
  }

  return normalizeWhitespace(slides.join('\n\n'));
}

function buildImageDataUrl(filePath, mimeType) {
  const buffer = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function extractDocumentInput(doc, filePath) {
  switch (doc.file_type) {
    case 'text/plain':
    case 'text/csv':
      return {
        mode: 'text',
        content: decodeTextBuffer(fs.readFileSync(filePath)),
      };

    case 'application/pdf':
      return {
        mode: 'text',
        content: await extractPdfText(filePath),
      };

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return {
        mode: 'text',
        content: await extractDocxText(filePath),
      };

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return {
        mode: 'text',
        content: extractXlsxText(filePath),
      };

    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return {
        mode: 'text',
        content: await extractPptxText(filePath),
      };

    case 'application/zip':
      return {
        mode: 'unsupported',
        reason: 'ZIP archives are not supported for summaries yet.',
      };

    default:
      if (typeof doc.file_type === 'string' && doc.file_type.startsWith('image/')) {
        return {
          mode: 'vision',
          imageDataUrl: buildImageDataUrl(filePath, doc.file_type),
        };
      }

      return {
        mode: 'unsupported',
        reason: `This file type is not supported for summaries: ${doc.file_type || 'unknown'}.`,
      };
  }
}

module.exports = {
  extractDocumentInput,
};
