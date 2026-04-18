const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler.cjs');

function createDocumentsRoutes({ authMiddleware, documentsService, openRouterService, uploadMiddleware }) {
  const router = express.Router();

  router.get('/api/documents', authMiddleware.auth, asyncHandler(async (req, res) => {
    res.json(documentsService.listDocuments(req.user, req.query || {}));
  }));

  router.post('/api/documents/upload', authMiddleware.auth, uploadMiddleware.documents.single('file'), asyncHandler(async (req, res) => {
    res.json(documentsService.uploadDocument(req.user, req.file));
  }));

  router.patch('/api/documents/:id/rename', authMiddleware.auth, asyncHandler(async (req, res) => {
    documentsService.renameDocument(req.params.id, req.user.id, req.body?.name);
    res.json({ ok: true });
  }));

  router.patch('/api/documents/:id/star', authMiddleware.auth, asyncHandler(async (req, res) => {
    documentsService.toggleStar(req.params.id, req.user.id, req.body?.starred);
    res.json({ ok: true });
  }));

  router.patch('/api/documents/:id/trash', authMiddleware.auth, asyncHandler(async (req, res) => {
    documentsService.trashDocument(req.params.id, req.user.id);
    res.json({ ok: true });
  }));

  router.patch('/api/documents/:id/restore', authMiddleware.auth, asyncHandler(async (req, res) => {
    documentsService.restoreDocument(req.params.id, req.user.id);
    res.json({ ok: true });
  }));

  router.delete('/api/documents/:id', authMiddleware.auth, asyncHandler(async (req, res) => {
    documentsService.deleteDocument(req.params.id, req.user.id);
    res.json({ ok: true });
  }));

  router.get('/api/documents/:id/download', authMiddleware.auth, asyncHandler(async (req, res) => {
    const file = documentsService.getDownload(req.params.id, req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename="${file.contentDispositionName}"`);
    res.setHeader('Content-Type', file.contentType);
    res.sendFile(file.filePath);
  }));

  router.get('/api/documents/:id/blob', authMiddleware.auth, asyncHandler(async (req, res) => {
    const file = documentsService.getBlob(req.params.id, req.user.id);
    res.setHeader('Content-Type', file.contentType);
    res.sendFile(file.filePath);
  }));

  router.get('/api/documents/:id/summary', authMiddleware.auth, asyncHandler(async (req, res) => {
    res.json(openRouterService.getDocumentSummaryState(req.params.id, req.user.id));
  }));

  router.post('/api/documents/:id/summary', authMiddleware.auth, asyncHandler(async (req, res) => {
    try {
      res.json(await openRouterService.generateDocumentSummary(req.params.id, req.user.id, req.body?.force === true));
    } catch (error) {
      res.status(error?.status || 502).json({
        error: error?.message || 'Summary generation failed',
        state: openRouterService.getDocumentSummaryState(req.params.id, req.user.id).state,
      });
    }
  }));

  return router;
}

module.exports = {
  createDocumentsRoutes,
};
