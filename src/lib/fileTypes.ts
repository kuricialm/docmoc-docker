export const FILE_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'application/pdf': { label: 'PDF', color: 'hsl(0, 72%, 51%)', bgColor: 'hsl(0, 72%, 96%)' },
  'text/plain': { label: 'TXT', color: 'hsl(215, 16%, 47%)', bgColor: 'hsl(215, 20%, 95%)' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'DOCX', color: 'hsl(217, 91%, 50%)', bgColor: 'hsl(217, 91%, 95%)' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { label: 'XLSX', color: 'hsl(142, 71%, 35%)', bgColor: 'hsl(142, 71%, 95%)' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { label: 'PPTX', color: 'hsl(25, 95%, 53%)', bgColor: 'hsl(25, 95%, 95%)' },
  'image/png': { label: 'PNG', color: 'hsl(271, 91%, 55%)', bgColor: 'hsl(271, 91%, 95%)' },
  'image/jpeg': { label: 'JPG', color: 'hsl(271, 91%, 55%)', bgColor: 'hsl(271, 91%, 95%)' },
  'image/gif': { label: 'GIF', color: 'hsl(271, 91%, 55%)', bgColor: 'hsl(271, 91%, 95%)' },
  'image/webp': { label: 'WEBP', color: 'hsl(271, 91%, 55%)', bgColor: 'hsl(271, 91%, 95%)' },
  'image/svg+xml': { label: 'SVG', color: 'hsl(271, 91%, 55%)', bgColor: 'hsl(271, 91%, 95%)' },
};

export const ACCEPTED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/zip',
] as const;

export const ACCEPTED_UPLOAD_EXTENSIONS = [
  '.pdf',
  '.txt',
  '.csv',
  '.docx',
  '.xlsx',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.zip',
] as const;

export const ACCEPTED_UPLOAD_ATTR = [
  ...ACCEPTED_UPLOAD_MIME_TYPES,
  ...ACCEPTED_UPLOAD_EXTENSIONS,
].join(',');

export function isAcceptedUploadFile(file: Pick<File, 'name' | 'type'>): boolean {
  const fileType = (file.type || '').toLowerCase();
  if (ACCEPTED_UPLOAD_MIME_TYPES.includes(fileType as (typeof ACCEPTED_UPLOAD_MIME_TYPES)[number])) return true;

  const dotIndex = file.name.lastIndexOf('.');
  if (dotIndex < 0) return false;
  const ext = file.name.slice(dotIndex).toLowerCase();
  return ACCEPTED_UPLOAD_EXTENSIONS.includes(ext as (typeof ACCEPTED_UPLOAD_EXTENSIONS)[number]);
}

export function getFileTypeInfo(mimeType: string) {
  return FILE_TYPE_CONFIG[mimeType] || { label: mimeType.split('/').pop()?.toUpperCase() || 'FILE', color: 'hsl(215, 16%, 47%)', bgColor: 'hsl(215, 20%, 95%)' };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function isPreviewable(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType === 'text/plain' || mimeType.startsWith('image/');
}

export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
