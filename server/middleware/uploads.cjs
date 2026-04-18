const multer = require('multer');
const { badRequest } = require('../errors/apiError.cjs');
const {
  BRANDING_FAVICON_EXTENSIONS,
  BRANDING_FAVICON_MIME_TYPES,
  BRANDING_LOGO_EXTENSIONS,
  BRANDING_LOGO_MIME_TYPES,
  DOCUMENT_UPLOAD_EXTENSIONS,
  DOCUMENT_UPLOAD_MIME_TYPES,
  isAllowedUpload,
} = require('../lib/uploadPolicy.cjs');

function createUploader(config, { allowedExtensions, allowedMimeTypes, maxBytes, label }) {
  return multer({
    dest: config.tmpDir,
    fileFilter(_req, file, callback) {
      const allowed = isAllowedUpload(file, {
        extensions: allowedExtensions,
        mimeTypes: allowedMimeTypes,
      });

      if (!allowed) {
        callback(badRequest(`Unsupported ${label} file type`));
        return;
      }

      callback(null, true);
    },
    limits: {
      files: 1,
      fileSize: maxBytes,
    },
  });
}

function createUploadMiddleware(config) {
  return {
    brandingFavicon: createUploader(config, {
      allowedExtensions: BRANDING_FAVICON_EXTENSIONS,
      allowedMimeTypes: BRANDING_FAVICON_MIME_TYPES,
      label: 'branding',
      maxBytes: config.maxBrandingUploadBytes,
    }),
    brandingLogo: createUploader(config, {
      allowedExtensions: BRANDING_LOGO_EXTENSIONS,
      allowedMimeTypes: BRANDING_LOGO_MIME_TYPES,
      label: 'branding',
      maxBytes: config.maxBrandingUploadBytes,
    }),
    documents: createUploader(config, {
      allowedExtensions: DOCUMENT_UPLOAD_EXTENSIONS,
      allowedMimeTypes: DOCUMENT_UPLOAD_MIME_TYPES,
      label: 'document',
      maxBytes: config.maxUploadBytes,
    }),
  };
}

module.exports = {
  createUploadMiddleware,
};
