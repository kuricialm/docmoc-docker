const path = require('path');

const SAFE_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

const DOCUMENT_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  ...SAFE_IMAGE_MIME_TYPES,
]);

const DOCUMENT_UPLOAD_EXTENSIONS = new Set([
  '.pdf',
  '.txt',
  '.csv',
  '.docx',
  '.xlsx',
  '.pptx',
  '.zip',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
]);

const BRANDING_LOGO_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

const BRANDING_LOGO_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
]);

const BRANDING_FAVICON_MIME_TYPES = new Set([
  'image/png',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

const BRANDING_FAVICON_EXTENSIONS = new Set([
  '.png',
  '.ico',
]);

function normalizeMimeType(mimeType) {
  return typeof mimeType === 'string' ? mimeType.trim().toLowerCase() : '';
}

function normalizeExtension(fileName) {
  return path.extname(typeof fileName === 'string' ? fileName : '').toLowerCase();
}

function isAllowedUpload(file, policy) {
  const mimeType = normalizeMimeType(file?.mimetype);
  const extension = normalizeExtension(file?.originalname);
  if (!mimeType || !extension) return false;
  return policy.mimeTypes.has(mimeType) && policy.extensions.has(extension);
}

function isSafePreviewMimeType(mimeType) {
  const normalized = normalizeMimeType(mimeType);
  return normalized === 'application/pdf'
    || normalized === 'text/plain'
    || SAFE_IMAGE_MIME_TYPES.has(normalized);
}

module.exports = {
  BRANDING_FAVICON_EXTENSIONS,
  BRANDING_FAVICON_MIME_TYPES,
  BRANDING_LOGO_EXTENSIONS,
  BRANDING_LOGO_MIME_TYPES,
  DOCUMENT_UPLOAD_EXTENSIONS,
  DOCUMENT_UPLOAD_MIME_TYPES,
  SAFE_IMAGE_MIME_TYPES,
  isAllowedUpload,
  isSafePreviewMimeType,
};
