const express = require('express');
const { getSessionCookieOptions } = require('../config/index.cjs');
const { asyncHandler } = require('../middleware/errorHandler.cjs');

function createAuthRoutes({ authMiddleware, authService, config, rateLimiters }) {
  const router = express.Router();

  router.post('/api/auth/login', rateLimiters.login, asyncHandler(async (req, res) => {
    const result = authService.login(req, {
      email: req.body?.email,
      password: req.body?.password,
      rememberMe: req.body?.rememberMe === true,
    });
    res.cookie(result.cookie.name, result.cookie.value, result.cookie.options);
    res.json(result.user);
  }));

  router.post('/api/auth/logout', asyncHandler(async (req, res) => {
    authService.logout(req.cookies.session);
    res.clearCookie('session', getSessionCookieOptions(req, config));
    res.json({ ok: true });
  }));

  router.get('/api/auth/session', asyncHandler(async (req, res) => {
    res.json({
      user: authService.getOptionalAuthenticatedUserBySessionToken(req.cookies.session),
    });
  }));

  router.get('/api/auth/me', authMiddleware.auth, asyncHandler(async (req, res) => {
    res.json(req.user);
  }));

  router.post('/api/auth/register', rateLimiters.register, asyncHandler(async (req, res) => {
    const user = authService.register({
      email: req.body?.email,
      fullName: req.body?.fullName,
      password: req.body?.password,
    });
    res.json(user);
  }));

  return router;
}

module.exports = {
  createAuthRoutes,
};
