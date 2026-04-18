const { badRequest, notFound, payloadTooLarge } = require('../errors/apiError.cjs');
const { extFromMime, normalizeUploadedFilename } = require('../lib/fileMeta.cjs');
const { isSafePreviewMimeType } = require('../lib/uploadPolicy.cjs');

function createDocumentsService({
  config,
  documentFilesStorage,
  documentPresenter,
  documentsRepository,
  historyRepository,
  sharesRepository,
  summaryService,
  now,
  uid,
  formatBytes,
  resolveDisplayName,
}) {
  return {
    deleteDocument(documentId, userId) {
      const doc = documentsRepository.getByIdAndUserId(documentId, userId);
      if (!doc) throw notFound('Not found');
      historyRepository.create({
        action: 'permanently_deleted',
        created_at: now(),
        details: null,
        document_id: documentId,
        id: uid(),
        user_id: userId,
      });
      documentFilesStorage.deleteStoredFile(doc.storage_path);
      documentsRepository.deleteById(documentId);
    },

    getBlob(documentId, userId) {
      const doc = documentsRepository.getByIdAndUserId(documentId, userId);
      if (!doc) throw notFound('Not found');
      if (!isSafePreviewMimeType(doc.file_type)) throw badRequest('Preview is not available for this file type');
      return {
        contentType: doc.file_type,
        filePath: documentFilesStorage.getAbsolutePath(doc.storage_path),
      };
    },

    getDownload(documentId, userId) {
      const doc = documentsRepository.getByIdAndUserId(documentId, userId);
      if (!doc) throw notFound('Not found');
      return {
        contentDispositionName: normalizeUploadedFilename(doc.name),
        contentType: doc.file_type,
        filePath: documentFilesStorage.getAbsolutePath(doc.storage_path),
      };
    },

    getOwnedDocument(documentId, userId) {
      return documentsRepository.getByIdAndUserId(documentId, userId);
    },

    listDocuments(user, query) {
      sharesRepository.clearExpiredForUser(user.id, now(), now());
      const docs = documentsRepository.listByUser(user.id, {
        recent: query.recent === 'true',
        recentLimit: query.recentLimit,
        shared: query.shared === 'true',
        sortBy: query.sortBy,
        starred: query.starred === 'true',
        tagId: query.tagId,
        trashed: query.trashed === undefined ? undefined : query.trashed === 'true',
      });
      return docs.map((doc) => documentPresenter.presentOwnedDocument(doc, user));
    },

    renameDocument(documentId, userId, name) {
      const existing = documentsRepository.getByIdAndUserId(documentId, userId);
      if (!existing) throw notFound('Not found');
      if (existing.name === name) return;
      documentsRepository.updateName(documentId, userId, name, now());
      historyRepository.create({
        action: 'renamed',
        created_at: now(),
        details: JSON.stringify({ from: existing.name, to: name }),
        document_id: documentId,
        id: uid(),
        user_id: userId,
      });
    },

    restoreDocument(documentId, userId) {
      const existing = documentsRepository.getByIdAndUserId(documentId, userId);
      if (!existing) throw notFound('Not found');
      if (!existing.trashed) return;
      documentsRepository.restore(documentId, userId, now());
      historyRepository.create({
        action: 'restored',
        created_at: now(),
        details: null,
        document_id: documentId,
        id: uid(),
        user_id: userId,
      });
    },

    toggleStar(documentId, userId, starred) {
      const existing = documentsRepository.getByIdAndUserId(documentId, userId);
      if (!existing) throw notFound('Not found');
      const nextStarred = starred ? 1 : 0;
      if (existing.starred === nextStarred) return;
      documentsRepository.updateStarred(documentId, userId, starred, now());
      historyRepository.create({
        action: starred ? 'starred' : 'unstarred',
        created_at: now(),
        details: null,
        document_id: documentId,
        id: uid(),
        user_id: userId,
      });
    },

    trashDocument(documentId, userId) {
      const existing = documentsRepository.getByIdAndUserId(documentId, userId);
      if (!existing) throw notFound('Not found');
      if (existing.trashed) return;
      const timestamp = now();
      documentsRepository.trash(documentId, userId, timestamp, timestamp);
      historyRepository.create({
        action: 'deleted',
        created_at: now(),
        details: null,
        document_id: documentId,
        id: uid(),
        user_id: userId,
      });
    },

    uploadDocument(user, file) {
      if (!file) throw badRequest('No file');

      const quotaBytes = typeof user.upload_quota_bytes === 'number' ? user.upload_quota_bytes : null;
      if (quotaBytes !== null) {
        const currentUsage = documentsRepository.getStorageUsageByUser(user.id);
        if (currentUsage + file.size > quotaBytes) {
          documentFilesStorage.deleteStoredFile(file.path);
          const remaining = Math.max(0, quotaBytes - currentUsage);
          throw payloadTooLarge(`Upload quota exceeded. Remaining storage: ${formatBytes(remaining)} of ${formatBytes(quotaBytes)}.`);
        }
      }

      const id = uid();
      const extension = extFromMime(file.mimetype);
      const storedFile = documentFilesStorage.saveUploadedFile(user.id, id, file.path, extension);
      const timestamp = now();

      const doc = documentsRepository.createDocument({
        created_at: timestamp,
        file_size: file.size,
        file_type: file.mimetype || 'application/octet-stream',
        id,
        name: normalizeUploadedFilename(file.originalname),
        share_token: null,
        shared: 0,
        starred: 0,
        storage_path: storedFile.storagePath,
        trashed: 0,
        trashed_at: null,
        updated_at: timestamp,
        uploaded_by_name_snapshot: resolveDisplayName(user.full_name, user.email),
        user_id: user.id,
      });

      historyRepository.create({
        action: 'uploaded',
        created_at: timestamp,
        details: JSON.stringify({ name: doc.name }),
        document_id: doc.id,
        id: uid(),
        user_id: user.id,
      });

      const summaryAutoStarted = summaryService.scheduleAutomaticSummaryGeneration(doc, user.id);
      return {
        ...documentPresenter.presentOwnedDocument(doc, user),
        summary_auto_started: summaryAutoStarted,
      };
    },
  };
}

module.exports = {
  createDocumentsService,
};
