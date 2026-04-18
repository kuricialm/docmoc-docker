const { forbidden, tooManyRequests } = require('../errors/apiError.cjs');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function securityHeadersMiddleware() {
  return function applySecurityHeaders(_req, res, next) {
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  };
}

function getRequestOrigin(req) {
  const candidates = [req.get('origin'), req.get('referer')];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      continue;
    }
  }
  return null;
}

function createAuthenticatedOriginGuard(config) {
  const allowedOrigins = new Set(config.allowedOrigins || []);

  return function authenticatedOriginGuard(req, _res, next) {
    if (SAFE_METHODS.has(req.method) || !req.path.startsWith('/api') || !req.cookies?.session) {
      next();
      return;
    }

    const requestOrigin = getRequestOrigin(req);
    const host = req.get('host');
    const hostOrigin = host ? `${req.protocol}://${host}` : null;
    const isAllowed = Boolean(
      requestOrigin
      && (allowedOrigins.has(requestOrigin) || (hostOrigin && requestOrigin === hostOrigin)),
    );

    if (!isAllowed) {
      next(forbidden('Cross-origin requests are not allowed'));
      return;
    }

    next();
  };
}

function createRateLimitMiddleware({
  keyPrefix,
  keySelector = (req) => req.ip || 'unknown',
  maxRequests,
  windowMs,
  message,
}) {
  const buckets = new Map();

  return function rateLimit(req, _res, next) {
    const now = Date.now();
    const key = `${keyPrefix}:${keySelector(req)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;
    if (current.count > maxRequests) {
      next(tooManyRequests(message || 'Too many requests. Please try again later.'));
      return;
    }

    next();
  };
}

module.exports = {
  createAuthenticatedOriginGuard,
  createRateLimitMiddleware,
  securityHeadersMiddleware,
};
