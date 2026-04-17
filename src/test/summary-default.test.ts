import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { DEFAULT_SUMMARY_PROMPT } = require('../../server/services/summary/index.cjs');

describe('default summary prompt', () => {
  it('uses the canonical starter text', () => {
    expect(DEFAULT_SUMMARY_PROMPT).toBe(`Summarize the file in its original language.

Output only:
* a short summary of 1 to 2 sentences
* one blank line
* then takeaways bullet points

Strict output rules:
* do not print any headings, labels, or section names
* the first part must be the summary text itself
* after the blank line begins the bullet points of takeaways.
* every new line of a takeaway bullet must begin exactly with "-" then a space.
* use only the normal hyphen bullet format: "-", never use dots, Arabic bullets, numbering, symbols, or decorative characters
* do not output "Summary", "Key points", "الملخص", or "أهم النقاط"
* do not add introductions, conclusions, notes, or any extra text
* do not add introductions, conclusions, notes, or any extra text
* return only the final output block, with no reasoning or dialogue in any language before or after it

Content rules:
* keep it factual, brief, and consistent
* include as many bullet points as needed, but only when they add important supported information
* keep each bullet short and clean
* parse and normalize the source before writing so the final text is free of OCR noise, broken punctuation, malformed RTL text, repeated symbols, or messy extraction artifacts
* if the source is mixed-language, use the dominant language of the document`);
  });
});
