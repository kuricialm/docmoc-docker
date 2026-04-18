class ApiError extends Error {
  constructor(status, message, payload = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function createError(status, message, payload) {
  return new ApiError(status, message, payload);
}

module.exports = {
  ApiError,
  badRequest: (message, payload) => createError(400, message, payload),
  conflict: (message, payload) => createError(409, message, payload),
  createError,
  forbidden: (message, payload) => createError(403, message, payload),
  notFound: (message, payload) => createError(404, message, payload),
  payloadTooLarge: (message, payload) => createError(413, message, payload),
  tooManyRequests: (message, payload) => createError(429, message, payload),
  unauthorized: (message, payload) => createError(401, message, payload),
};
