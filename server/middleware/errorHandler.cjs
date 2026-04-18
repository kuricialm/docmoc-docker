const multer = require('multer');
const { ApiError } = require('../errors/apiError.cjs');

function asyncHandler(fn) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function errorHandler(err, _req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: err.message,
      ...err.payload,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({
      error: err.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded file exceeds the maximum allowed size'
        : err.message || 'Upload failed',
    });
    return;
  }

  console.error('[api] unhandled error', err);
  res.status(err?.status || 500).json({
    error: err?.message || 'Internal server error',
  });
}

module.exports = {
  asyncHandler,
  errorHandler,
};
