function normalizeUploadedFilename(filename) {
  if (typeof filename !== 'string') return 'document';
  const trimmed = filename.trim();
  if (!trimmed) return 'document';

  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
  const mojibakeRegex = /[ÃØÙÐÑ][\u0080-\u00FF]?/g;
  const matchCount = (value, regex) => (value.match(regex) || []).length;
  const replacementCount = (value) => (value.match(/�/g) || []).length;
  const printableCount = (value) => (value.match(/[\p{L}\p{N}\s._\-()[\]]/gu) || []).length;
  const decodeLatin1ToUtf8 = (value) => Buffer.from(value, 'latin1').toString('utf8');
  const hasMojibakeHints = (value) => matchCount(value, mojibakeRegex) >= 3;

  const candidates = [trimmed];
  const firstPass = decodeLatin1ToUtf8(trimmed);
  candidates.push(firstPass);
  const secondPass = decodeLatin1ToUtf8(firstPass);
  if (secondPass !== firstPass) candidates.push(secondPass);
  if (hasMojibakeHints(trimmed) && /[\r\n]/.test(trimmed)) {
    const controlRecovered = trimmed.replace(/\r\n|\r|\n/g, '\x85');
    candidates.push(decodeLatin1ToUtf8(controlRecovered));
  }

  const score = (value) => (
    matchCount(value, arabicRegex) * 4 +
    printableCount(value) -
    matchCount(value, mojibakeRegex) * 3 -
    replacementCount(value) * 6
  );

  const best = candidates.sort((a, b) => score(b) - score(a))[0];
  return best || 'document';
}

function extFromMime(mime) {
  const map = {
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
    'application/zip': 'zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  };
  if (map[mime]) return map[mime];
  const parts = (mime || '').split('/');
  return parts[1] || 'bin';
}

module.exports = {
  extFromMime,
  normalizeUploadedFilename,
};
