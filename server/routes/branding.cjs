const express = require('express');
const { badRequest } = require('../errors/apiError.cjs');
const { asyncHandler } = require('../middleware/errorHandler.cjs');
const { extFromMime } = require('../lib/fileMeta.cjs');

function sendNoCacheFile(res, filePath) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(filePath);
}

function createBrandingRoutes({ authMiddleware, brandingService, uploadMiddleware }) {
  const router = express.Router();

  router.post('/api/profile/logo', authMiddleware.auth, authMiddleware.adminOnly, uploadMiddleware.brandingLogo.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No file');
    res.json(brandingService.uploadLogo({
      extension: extFromMime(req.file.mimetype),
      path: req.file.path,
    }));
  }));

  router.delete('/api/profile/logo', authMiddleware.auth, authMiddleware.adminOnly, asyncHandler(async (_req, res) => {
    brandingService.removeLogo();
    res.json({ ok: true });
  }));

  router.get('/api/profile/logo/:filename', asyncHandler(async (req, res) => {
    sendNoCacheFile(res, brandingService.resolveAsset('logo', req.params.filename));
  }));

  router.post('/api/profile/favicon', authMiddleware.auth, authMiddleware.adminOnly, uploadMiddleware.brandingFavicon.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No file');
    res.json(brandingService.uploadFavicon({
      extension: extFromMime(req.file.mimetype),
      path: req.file.path,
    }));
  }));

  router.delete('/api/profile/favicon', authMiddleware.auth, authMiddleware.adminOnly, asyncHandler(async (_req, res) => {
    brandingService.removeFavicon();
    res.json({ ok: true });
  }));

  router.get('/api/profile/favicon/:filename', asyncHandler(async (req, res) => {
    sendNoCacheFile(res, brandingService.resolveAsset('favicon', req.params.filename));
  }));

  return router;
}

module.exports = {
  createBrandingRoutes,
};
