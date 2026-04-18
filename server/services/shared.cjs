const bcrypt = require('bcryptjs');
const { normalizeUploadedFilename } = require('../lib/fileMeta.cjs');
const { isSafePreviewMimeType } = require('../lib/uploadPolicy.cjs');
const { badRequest, notFound, unauthorized } = require('../errors/apiError.cjs');
const { MIN_PASSWORD_LENGTH } = require('../validators/common.cjs');

function createSharedService({
  documentFilesStorage,
  documentPresenter,
  documentsRepository,
  historyRepository,
  sharesRepository,
  now,
  uid,
}) {
  function getActiveSharedDocument(shareToken) {
    const doc = sharesRepository.getSharedByToken(shareToken);
    if (!doc) throw notFound('Not found');
    if (doc.share_expires_at && new Date(doc.share_expires_at).getTime() <= Date.now()) {
      sharesRepository.expireSharedDocument(doc.id, now());
      throw notFound('Not found');
    }
    return doc;
  }

  function assertPassword(doc, suppliedPassword) {
    if (!doc.share_password_hash) return;
    if (!suppliedPassword || !bcrypt.compareSync(suppliedPassword, doc.share_password_hash)) {
      throw unauthorized('Password required');
    }
  }

  return {
    cleanupExpiredSharesForAll() {
      const isoNow = now();
      sharesRepository.clearExpiredForAll(isoNow, isoNow);
    },

    cleanupExpiredSharesForUser(userId) {
      const isoNow = now();
      sharesRepository.clearExpiredForUser(userId, isoNow, isoNow);
    },

    disableShare(documentId, userId) {
      sharesRepository.disableShare(documentId, userId, now());
    },

    getSharedDocument(shareToken, suppliedPassword) {
      const doc = getActiveSharedDocument(shareToken);
      assertPassword(doc, suppliedPassword);
      return documentPresenter.presentSharedDocument(doc);
    },

    getSharedDownload(shareToken, suppliedPassword) {
      const doc = getActiveSharedDocument(shareToken);
      assertPassword(doc, suppliedPassword);
      return {
        contentDispositionName: normalizeUploadedFilename(doc.name),
        contentType: doc.file_type,
        filePath: documentFilesStorage.getAbsolutePath(doc.storage_path),
      };
    },

    getSharedBlob(shareToken, suppliedPassword) {
      const doc = getActiveSharedDocument(shareToken);
      assertPassword(doc, suppliedPassword);
      return {
        asAttachment: !isSafePreviewMimeType(doc.file_type),
        contentDispositionName: normalizeUploadedFilename(doc.name),
        contentType: doc.file_type,
        filePath: documentFilesStorage.getAbsolutePath(doc.storage_path),
      };
    },

    updateShare(documentId, userId, shared, config) {
      const existing = documentsRepository.getByIdAndUserId(documentId, userId);
      if (!existing) throw notFound('Not found');

      if (!shared) {
        if (!existing.shared) return { ok: true, share_token: null };
        sharesRepository.disableShare(documentId, userId, now());
        historyRepository.create({
          action: 'share_disabled',
          created_at: now(),
          details: null,
          document_id: documentId,
          id: uid(),
          user_id: userId,
        });
        return { ok: true, share_token: null };
      }

      let shareExpiresAt = existing.share_expires_at || null;
      let sharePasswordHash = existing.share_password_hash || null;
      let passwordAction = null;
      let expiryChanged = false;

      if (config && Object.prototype.hasOwnProperty.call(config, 'expiresAt')) {
        if (config.expiresAt) {
          const parsedDate = new Date(config.expiresAt);
          if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
            throw badRequest('Expiration must be a future date/time');
          }
          shareExpiresAt = parsedDate.toISOString();
        } else {
          shareExpiresAt = null;
        }
        expiryChanged = (existing.share_expires_at || null) !== shareExpiresAt;
      }

      if (config && Object.prototype.hasOwnProperty.call(config, 'password')) {
        if (config.password) {
          if (typeof config.password !== 'string' || config.password.length < MIN_PASSWORD_LENGTH) {
            throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
          }
          sharePasswordHash = bcrypt.hashSync(config.password, 10);
          passwordAction = existing.share_password_hash ? 'share_password_changed' : 'share_password_added';
        } else if (config.password === '') {
          sharePasswordHash = null;
          if (existing.share_password_hash) passwordAction = 'share_password_removed';
        }
      }

      const shareToken = existing.share_token || uid();
      sharesRepository.updateShareState({
        documentId,
        shareExpiresAt,
        sharePasswordHash,
        shareToken,
        updatedAt: now(),
        userId,
      });

      historyRepository.create({
        action: existing.share_token ? 'share_updated' : 'share_enabled',
        created_at: now(),
        details: JSON.stringify({ expiresAt: shareExpiresAt }),
        document_id: documentId,
        id: uid(),
        user_id: userId,
      });

      if (expiryChanged) {
        historyRepository.create({
          action: 'share_expiry_changed',
          created_at: now(),
          details: JSON.stringify({ from: existing.share_expires_at || null, to: shareExpiresAt }),
          document_id: documentId,
          id: uid(),
          user_id: userId,
        });
      }

      if (passwordAction) {
        historyRepository.create({
          action: passwordAction,
          created_at: now(),
          details: null,
          document_id: documentId,
          id: uid(),
          user_id: userId,
        });
      }

      return { ok: true, share_token: shareToken };
    },
  };
}

module.exports = {
  createSharedService,
};
