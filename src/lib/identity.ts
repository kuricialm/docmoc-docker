export function resolveDisplayName(...candidates: Array<string | null | undefined>): string {
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return 'Unknown user';
}
