import { resolveDisplayName } from '@/lib/identity';

export function getUploadedByLabel(
  uploadedByName?: string | null,
  fallbackFullName?: string | null,
  fallbackEmail?: string | null,
): string {
  return resolveDisplayName(uploadedByName, fallbackFullName, fallbackEmail);
}
