function createDocumentsRepository(db) {
  return {
    createDocument(doc) {
      db.prepare(`
        INSERT INTO documents (
          id,
          user_id,
          name,
          file_type,
          file_size,
          storage_path,
          starred,
          trashed,
          trashed_at,
          shared,
          share_token,
          uploaded_by_name_snapshot,
          created_at,
          updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        doc.id,
        doc.user_id,
        doc.name,
        doc.file_type,
        doc.file_size,
        doc.storage_path,
        doc.starred,
        doc.trashed,
        doc.trashed_at,
        doc.shared,
        doc.share_token,
        doc.uploaded_by_name_snapshot,
        doc.created_at,
        doc.updated_at,
      );
      return this.getByIdAndUserId(doc.id, doc.user_id);
    },

    deleteById(documentId) {
      db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
    },

    findExpiredTrash(cutoff) {
      return db.prepare('SELECT id, storage_path FROM documents WHERE trashed = 1 AND trashed_at < ?').all(cutoff);
    },

    findBySummaryRecoveryKey(name, fileType, fileSize) {
      return db.prepare(`
        SELECT *
        FROM documents
        WHERE name = ?
          AND ((file_type = ?) OR (file_type IS NULL AND ? IS NULL))
          AND file_size = ?
      `).all(name, fileType, fileType, fileSize);
    },

    getByIdAndUserId(documentId, userId) {
      return db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(documentId, userId) || null;
    },

    getStorageUsageByUser(userId) {
      const row = db.prepare('SELECT COALESCE(SUM(file_size), 0) AS total FROM documents WHERE user_id = ?').get(userId);
      return Number(row?.total || 0);
    },

    listByUser(userId, options = {}) {
      const { recent, recentLimit, shared, sortBy, starred, tagId, trashed } = options;
      let sql = 'SELECT d.* FROM documents d WHERE d.user_id = ?';
      const params = [userId];

      if (trashed !== undefined) {
        sql += ' AND d.trashed = ?';
        params.push(trashed ? 1 : 0);
      } else {
        sql += ' AND d.trashed = 0';
      }

      if (starred) sql += ' AND d.starred = 1';
      if (shared) sql += ' AND d.shared = 1';

      const orderBy = sortBy === 'updated' ? 'updated_at' : 'created_at';
      sql += ` ORDER BY d.${orderBy} DESC`;

      if (recent) {
        if (recentLimit !== undefined) {
          const parsedLimit = Number.parseInt(String(recentLimit), 10);
          if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
            sql += ' LIMIT ?';
            params.push(Math.min(parsedLimit, 1000));
          }
        } else {
          sql += ' LIMIT 20';
        }
      }

      let docs = db.prepare(sql).all(...params);
      if (tagId) {
        const tagDocIds = new Set(
          db.prepare('SELECT document_id FROM document_tags WHERE tag_id = ?').all(tagId).map((row) => row.document_id)
        );
        docs = docs.filter((doc) => tagDocIds.has(doc.id));
      }
      return docs;
    },

    listSummaryCandidateDocuments(userId) {
      return db.prepare(`
        SELECT *
        FROM documents
        WHERE user_id = ? AND trashed = 0
        ORDER BY created_at DESC
      `).all(userId);
    },

    restore(documentId, userId, updatedAt) {
      db.prepare('UPDATE documents SET trashed = 0, trashed_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(updatedAt, documentId, userId);
    },

    trash(documentId, userId, trashedAt, updatedAt) {
      db.prepare('UPDATE documents SET trashed = 1, trashed_at = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(trashedAt, updatedAt, documentId, userId);
    },

    updateName(documentId, userId, name, updatedAt) {
      db.prepare('UPDATE documents SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(name, updatedAt, documentId, userId);
    },

    updateStarred(documentId, userId, starred, updatedAt) {
      db.prepare('UPDATE documents SET starred = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(starred ? 1 : 0, updatedAt, documentId, userId);
    },

    updateUploadedByNameSnapshot(documentId, uploadedByName) {
      db.prepare('UPDATE documents SET uploaded_by_name_snapshot = ? WHERE id = ?').run(uploadedByName, documentId);
    },

    updateUpdatedAt(documentId, userId, updatedAt) {
      db.prepare('UPDATE documents SET updated_at = ? WHERE id = ? AND user_id = ?')
        .run(updatedAt, documentId, userId);
    },
  };
}

module.exports = {
  createDocumentsRepository,
};
