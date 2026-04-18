// @vitest-environment node
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { createOpenRouterService } = require('./openrouter.cjs');

const tempDirs = [];

function makeTempDir(prefix = 'docmoc-openrouter-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createSummaryStore(initialRows = []) {
  const store = new Map();
  initialRows.forEach((row) => {
    store.set(`${row.document_id}:${row.user_id}:${row.summary_format}`, { ...row });
  });
  return store;
}

function createService({
  catalog = { fetched_at: null, text: [], vision: [] },
  credential = null,
  docs = [],
  preferences = null,
  summaries = [],
} = {}) {
  const summaryStore = createSummaryStore(summaries);
  let credentialRow = credential ? { ...credential } : null;
  let preferencesRow = preferences ? { ...preferences } : null;

  const aiCredentialsRepository = {
    deleteByUserAndProvider() {
      credentialRow = null;
    },
    getByUserAndProvider() {
      return credentialRow;
    },
    upsert(userId, provider, values) {
      credentialRow = {
        ...(credentialRow || { user_id: userId, provider }),
        ...values,
      };
    },
  };

  const aiModelCatalogRepository = {
    deleteByUserAndProvider() {},
    getByUserAndProvider() {
      return catalog;
    },
    upsert() {},
  };

  const aiPreferencesRepository = {
    deleteByUserAndProvider() {
      preferencesRow = null;
    },
    getByUserAndProvider() {
      return preferencesRow;
    },
    upsert(userId, provider, values) {
      preferencesRow = {
        ...(preferencesRow || { user_id: userId, provider }),
        ...values,
      };
    },
  };

  const documentSummariesRepository = {
    getByDocumentAndUser(documentId, userId, summaryFormat) {
      return summaryStore.get(`${documentId}:${userId}:${summaryFormat}`) || null;
    },
    upsert(documentId, userId, summaryFormat, values, timestamp) {
      const existing = summaryStore.get(`${documentId}:${userId}:${summaryFormat}`);
      summaryStore.set(`${documentId}:${userId}:${summaryFormat}`, {
        ...(existing || { created_at: timestamp }),
        document_id: documentId,
        user_id: userId,
        summary_format: summaryFormat,
        ...values,
        updated_at: timestamp,
      });
    },
  };

  const documentsRepository = {
    findBySummaryRecoveryKey(name, fileType, fileSize) {
      return docs.filter((doc) => doc.name === name && doc.file_type === fileType && doc.file_size === fileSize);
    },
    getByIdAndUserId(documentId, userId) {
      return docs.find((doc) => doc.id === documentId && doc.user_id === userId) || null;
    },
    listSummaryCandidateDocuments(userId) {
      return docs.filter((doc) => doc.user_id === userId && !doc.trashed);
    },
  };

  const service = createOpenRouterService({
    aiCredentialsRepository,
    aiModelCatalogRepository,
    aiPreferencesRepository,
    config: {
      aiProviderOpenRouter: 'openrouter',
      maxConcurrentSummariesPerUser: 2,
      summaryCacheVersion: 'summary-text-v1',
      summaryFormatBrief: 'brief',
    },
    documentFilesStorage: {
      getAbsolutePath(storagePath) {
        return storagePath;
      },
    },
    documentSummariesRepository,
    documentsRepository,
    historyRepository: {
      create() {},
    },
    now() {
      return '2026-04-18T00:00:00.000Z';
    },
    uid() {
      return 'history-id';
    },
  });

  return {
    getCredential() {
      return credentialRow;
    },
    service,
    summaryStore,
  };
}

function createLegacySummaryDatabase(rows) {
  const dir = makeTempDir('docmoc-legacy-db-');
  const dbPath = path.join(dir, 'docmoc.db');
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      storage_path TEXT
    );
    CREATE TABLE document_summaries (
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      summary_format TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT,
      status TEXT NOT NULL,
      source_fingerprint TEXT NOT NULL,
      coverage TEXT,
      content_json TEXT,
      error_message TEXT,
      generated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const insertDocument = db.prepare(`
    INSERT INTO documents (id, user_id, name, file_type, file_size, storage_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertSummary = db.prepare(`
    INSERT INTO document_summaries (
      document_id,
      user_id,
      summary_format,
      provider,
      model,
      status,
      source_fingerprint,
      coverage,
      content_json,
      error_message,
      generated_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  rows.forEach((row, index) => {
    insertDocument.run(
      row.document_id,
      row.user_id || 'legacy-user',
      row.name,
      row.file_type,
      row.file_size,
      row.storage_path || `uploads/legacy/${row.document_id}`,
    );
    insertSummary.run(
      row.document_id,
      row.user_id || 'legacy-user',
      'brief',
      row.provider || 'openrouter',
      row.model || 'openai/gpt-5.4-mini',
      row.status || 'completed',
      row.source_fingerprint || `summary-text-v1:${row.file_type}:${row.file_size}:uploads/legacy/${row.document_id}`,
      row.coverage || 'full',
      row.content_json,
      null,
      row.generated_at || `2026-04-17T00:00:0${index}.000Z`,
      '2026-04-17T00:00:00.000Z',
      '2026-04-17T00:00:00.000Z',
    );
  });

  db.close();
  return dbPath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { force: true, recursive: true });
  }
});

describe('createOpenRouterService', () => {
  it('returns a cached summary even when the saved key is invalid', () => {
    const userId = 'user-1';
    const doc = {
      file_size: 136749,
      file_type: 'application/pdf',
      id: 'doc-1',
      name: 'bill.pdf',
      storage_path: 'uploads/user-1/doc-1.pdf',
      trashed: 0,
      user_id: userId,
    };
    const { service } = createService({
      credential: {
        encrypted_key: 'encrypted',
        last4: 'b048',
        last_error: 'OpenRouter key validation failed',
        status: 'invalid',
        user_id: userId,
      },
      docs: [doc],
      summaries: [{
        content_json: JSON.stringify('Existing summary'),
        coverage: 'full',
        document_id: doc.id,
        generated_at: '2026-04-18T00:00:00.000Z',
        model: 'openai/gpt-5.4-mini',
        provider: 'openrouter',
        source_fingerprint: 'summary-text-v1:application/pdf:136749:uploads/user-1/doc-1.pdf',
        status: 'completed',
        summary_format: 'brief',
        updated_at: '2026-04-18T00:00:00.000Z',
        user_id: userId,
      }],
    });

    const summary = service.getDocumentSummaryState(doc.id, userId);

    expect(summary.state).toBe('ready');
    expect(summary.summary).toBe('Existing summary');
    expect(summary.can_generate).toBe(false);
    expect(summary.openRouter.configured).toBe(true);
    expect(summary.openRouter.credential?.status).toBe('invalid');
  });

  it('returns no_key when no credential is stored', () => {
    const userId = 'user-1';
    const doc = {
      file_size: 136749,
      file_type: 'application/pdf',
      id: 'doc-1',
      name: 'bill.pdf',
      storage_path: 'uploads/user-1/doc-1.pdf',
      trashed: 0,
      user_id: userId,
    };
    const { service } = createService({ docs: [doc] });

    const summary = service.getDocumentSummaryState(doc.id, userId);

    expect(summary.state).toBe('no_key');
    expect(summary.summary).toBeNull();
    expect(summary.openRouter.configured).toBe(false);
  });

  it('recovers only uniquely matched completed legacy summaries', () => {
    const userId = 'user-main';
    const targetDoc = {
      file_size: 136749,
      file_type: 'application/pdf',
      id: 'target-doc',
      name: 'bill.pdf',
      storage_path: 'uploads/user-main/target-doc.pdf',
      trashed: 0,
      user_id: userId,
    };
    const existingCompletedDoc = {
      file_size: 500,
      file_type: 'text/plain',
      id: 'existing-doc',
      name: 'done.txt',
      storage_path: 'uploads/user-main/existing-doc.txt',
      trashed: 0,
      user_id: userId,
    };
    const ambiguousA = {
      file_size: 42,
      file_type: 'application/pdf',
      id: 'ambiguous-a',
      name: 'duplicate.pdf',
      storage_path: 'uploads/user-main/ambiguous-a.pdf',
      trashed: 0,
      user_id: userId,
    };
    const ambiguousB = {
      ...ambiguousA,
      id: 'ambiguous-b',
      storage_path: 'uploads/user-main/ambiguous-b.pdf',
    };
    const { service, summaryStore } = createService({
      docs: [targetDoc, existingCompletedDoc, ambiguousA, ambiguousB],
      summaries: [{
        content_json: JSON.stringify('Already stored'),
        coverage: 'full',
        document_id: existingCompletedDoc.id,
        generated_at: '2026-04-18T00:00:00.000Z',
        model: 'openai/gpt-5.4-mini',
        provider: 'openrouter',
        source_fingerprint: 'summary-text-v1:text/plain:500:uploads/user-main/existing-doc.txt',
        status: 'completed',
        summary_format: 'brief',
        updated_at: '2026-04-18T00:00:00.000Z',
        user_id: userId,
      }],
    });
    const legacyDbPath = createLegacySummaryDatabase([
      {
        content_json: JSON.stringify('Recovered summary'),
        document_id: 'legacy-target',
        file_size: 136749,
        file_type: 'application/pdf',
        name: 'bill.pdf',
      },
      {
        content_json: JSON.stringify('Ambiguous summary'),
        document_id: 'legacy-ambiguous',
        file_size: 42,
        file_type: 'application/pdf',
        name: 'duplicate.pdf',
      },
      {
        content_json: JSON.stringify('Missing summary'),
        document_id: 'legacy-missing',
        file_size: 77,
        file_type: 'application/pdf',
        name: 'missing.pdf',
      },
      {
        content_json: JSON.stringify('Should not replace'),
        document_id: 'legacy-existing',
        file_size: 500,
        file_type: 'text/plain',
        name: 'done.txt',
      },
      {
        content_json: '{"not":"a displayable summary"}',
        document_id: 'legacy-invalid',
        file_size: 25,
        file_type: 'application/pdf',
        name: 'invalid.pdf',
      },
    ]);

    const recovery = service.recoverLegacySummaries([legacyDbPath]);
    const imported = summaryStore.get(`${targetDoc.id}:${userId}:brief`);
    const preserved = summaryStore.get(`${existingCompletedDoc.id}:${userId}:brief`);

    expect(recovery.imported).toBe(1);
    expect(recovery.scanned).toBe(5);
    expect(recovery.skipped_ambiguous).toBe(1);
    expect(recovery.skipped_invalid).toBe(1);
    expect(recovery.skipped_missing).toBe(1);
    expect(recovery.skipped_existing).toBe(1);
    expect(imported).toMatchObject({
      document_id: targetDoc.id,
      status: 'completed',
      summary_format: 'brief',
      user_id: userId,
    });
    expect(imported?.source_fingerprint).toBe('summary-text-v1:application/pdf:136749:uploads/user-main/target-doc.pdf');
    expect(imported?.content_json).toBe(JSON.stringify('Recovered summary'));
    expect(preserved?.content_json).toBe(JSON.stringify('Already stored'));
  });
});
