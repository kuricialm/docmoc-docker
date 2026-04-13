export const ARABIC_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export function hasArabicCharacters(value: string | null | undefined): boolean {
  if (!value) return false;
  return ARABIC_CHAR_REGEX.test(value);
}
