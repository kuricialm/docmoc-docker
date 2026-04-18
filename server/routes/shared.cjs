const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler.cjs');

function createSharedRoutes({ rateLimiters, sharedService }) {
  const router = express.Router();

  router.get('/api/shared/:token', rateLimiters.sharedPublic, asyncHandler(async (req, res) => {
    res.json(sharedService.getSharedDocument(req.params.token, ''));
  }));

  router.get('/api/shared/:token/download', rateLimiters.sharedPublic, asyncHandler(async (req, res) => {
    const file = sharedService.getSharedDownload(req.params.token, '');
    res.setHeader('Content-Disposition', `attachment; filename="${file.contentDispositionName}"`);
    res.setHeader('Content-Type', file.contentType);
    res.sendFile(file.filePath);
  }));

  router.post('/api/shared/:token/unlock', rateLimiters.sharedUnlock, asyncHandler(async (req, res) => {
    res.json(sharedService.getSharedDocument(req.params.token, typeof req.body?.password === 'string' ? req.body.password : ''));
  }));

  router.post('/api/shared/:token/blob', rateLimiters.sharedBlob, asyncHandler(async (req, res) => {
    const file = sharedService.getSharedBlob(req.params.token, typeof req.body?.password === 'string' ? req.body.password : '');
    if (file.asAttachment) {
      res.setHeader('Content-Disposition', `attachment; filename="${file.contentDispositionName}"`);
    }
    res.setHeader('Content-Type', file.contentType);
    res.sendFile(file.filePath);
  }));

  return router;
}

module.exports = {
  createSharedRoutes,
};
