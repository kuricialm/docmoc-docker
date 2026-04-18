const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
const MOJIBAKE_REGEX = /[ÃØÙÐÑ][\u0080-\u00FF]?/g;

const countMatches = (value: string, regex: RegExp) => (value.match(regex) || []).length;

const hasArabicText = (value: string) => countMatches(value, ARABIC_REGEX) > 0;

function repairUtf8Mojibake(value: string): string {
  const arabicCount = countMatches(value, ARABIC_REGEX);
  const mojibakeCount = countMatches(value, MOJIBAKE_REGEX);
  if (arabicCount > 0 || mojibakeCount < 3) {
    return value;
  }

  const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
  const repaired = new TextDecoder('utf-8').decode(bytes);
  return hasArabicText(repaired) ? repaired : value;
}

function scoreDecodedText(value: string): number {
  const arabicCount = countMatches(value, ARABIC_REGEX);
  const replacementCount = (value.match(/�/g) || []).length;
  const mojibakeCount = countMatches(value, MOJIBAKE_REGEX);
  return arabicCount * 3 - replacementCount * 5 - mojibakeCount;
}

export function decodeDocumentPreviewText(bytes: Uint8Array): { content: string; isArabic: boolean } {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const candidates = [utf8, repairUtf8Mojibake(utf8)];

  try {
    candidates.push(new TextDecoder('windows-1256').decode(bytes));
  } catch {
    // Ignore missing runtime encoding support and keep the safer decodes.
  }

  const content = [...new Set(candidates)].sort((left, right) => scoreDecodedText(right) - scoreDecodedText(left))[0] || utf8;
  return {
    content,
    isArabic: hasArabicText(content),
  };
}
