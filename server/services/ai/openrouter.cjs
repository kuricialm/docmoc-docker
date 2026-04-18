const fs = require('fs');
const Database = require('better-sqlite3');
const { decryptSecret, encryptSecret, getApiKeyLast4 } = require('../../lib/aiSecrets.cjs');
const { parseJsonValue } = require('../../lib/core.cjs');
const { summarizeDocument, DEFAULT_SUMMARY_PROMPT } = require('../summary/index.cjs');
const { getAiProvider } = require('./index.cjs');
const { badRequest, createError, notFound } = require('../../errors/apiError.cjs');

function createOpenRouterService({
  aiCredentialsRepository,
  aiModelCatalogRepository,
  aiPreferencesRepository,
  config,
  documentFilesStorage,
  documentSummariesRepository,
  documentsRepository,
  historyRepository,
  now,
  uid,
}) {
  const openRouterProvider = getAiProvider(config.aiProviderOpenRouter);

  const inflightSummaryRequests = new Map();
  const summaryConcurrencyByUser = new Map();
  const queuedSummaryRequests = new Set();
  const summaryGenerationQueue = [];
  const summaryBatchProgressByUser = new Map();
  let summaryQueueRunning = false;

  function getCredential(userId) {
    return aiCredentialsRepository.getByUserAndProvider(userId, config.aiProviderOpenRouter);
  }

  function getPreferences(userId) {
    return aiPreferencesRepository.getByUserAndProvider(userId, config.aiProviderOpenRouter);
  }

  function getCatalog(userId) {
    return aiModelCatalogRepository.getByUserAndProvider(userId, config.aiProviderOpenRouter);
  }

  function upsertCredential(userId, values) {
    aiCredentialsRepository.upsert(userId, config.aiProviderOpenRouter, values, now());
  }

  function upsertPreferences(userId, values) {
    aiPreferencesRepository.upsert(userId, config.aiProviderOpenRouter, values, now());
  }

  function upsertCatalog(userId, catalog) {
    aiModelCatalogRepository.upsert(userId, config.aiProviderOpenRouter, catalog, now());
  }

  function deleteSetup(userId) {
    aiCredentialsRepository.deleteByUserAndProvider(userId, config.aiProviderOpenRouter);
    aiPreferencesRepository.deleteByUserAndProvider(userId, config.aiProviderOpenRouter);
    aiModelCatalogRepository.deleteByUserAndProvider(userId, config.aiProviderOpenRouter);
  }

  function getDocumentSourceFingerprint(doc) {
    return [
      doc.file_type || 'unknown',
      String(doc.file_size || 0),
      doc.storage_path || 'missing',
    ].join(':');
  }

  function getDocumentSummaryFingerprint(doc) {
    return [
      config.summaryCacheVersion,
      getDocumentSourceFingerprint(doc),
    ].join(':');
  }

  function doesStoredSummaryFingerprintMatch(storedFingerprint, doc) {
    if (typeof storedFingerprint !== 'string' || !storedFingerprint.trim()) return false;
    const currentFingerprint = getDocumentSummaryFingerprint(doc);
    if (storedFingerprint === currentFingerprint) return true;
    return storedFingerprint.startsWith(`${currentFingerprint}:`);
  }

  function normalizeStoredSummaryContent(value) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || null;
    }

    if (value && typeof value === 'object') {
      const parts = [];
      if (typeof value.overview === 'string' && value.overview.trim()) {
        parts.push(value.overview.trim());
      }
      if (Array.isArray(value.key_takeaways)) {
        const bullets = value.key_takeaways
          .map((item) => String(item).trim())
          .filter(Boolean)
          .map((item) => `- ${item}`);
        if (bullets.length > 0) {
          parts.push(bullets.join('\n'));
        }
      }
      const combined = parts.join('\n\n').trim();
      return combined || null;
    }

    return null;
  }

  function getStoredSummary(documentId, userId) {
    return documentSummariesRepository.getByDocumentAndUser(documentId, userId, config.summaryFormatBrief);
  }

  function upsertDocumentSummary(documentId, userId, values) {
    documentSummariesRepository.upsert(documentId, userId, config.summaryFormatBrief, values, now());
  }

  function findModelById(catalog, modelId) {
    if (!modelId) return null;
    return (
      catalog.text.find((model) => model.id === modelId)
      || catalog.vision.find((model) => model.id === modelId)
      || null
    );
  }

  function buildOpenRouterCatalog(models) {
    return {
      text: openRouterProvider.getTextModels(models),
      vision: openRouterProvider.getVisionModels(models),
    };
  }

  function sanitizeProviderErrorMessage(error, fallbackMessage) {
    if (!error?.message) return fallbackMessage;
    const message = String(error.message);
    if (/invalid summary payload|invalid json payload|unterminated string in json|unexpected token/i.test(message)) {
      return 'The model returned an unusable summary response. Regenerate again or choose a different model in Settings.';
    }
    return message.slice(0, 400);
  }

  function sanitizeSummaryRecoveryMessage(error) {
    return sanitizeProviderErrorMessage(error, 'Saved key needs revalidation in Settings before generating summaries.');
  }

  function logDocumentEvent(documentId, userId, action, details = null) {
    historyRepository.create({
      action,
      created_at: now(),
      details: details && typeof details === 'object' ? JSON.stringify(details) : null,
      document_id: documentId,
      id: uid(),
      user_id: userId,
    });
  }

  function getSummaryRequestKey(userId, documentId) {
    return `${userId}:${documentId}:${config.summaryFormatBrief}`;
  }

  function listSummaryCandidateDocuments(userId) {
    return documentsRepository.listSummaryCandidateDocuments(userId);
  }

  function getSummaryBatchState(userId) {
    const existing = summaryBatchProgressByUser.get(userId);
    if (existing) return existing;
    const initial = { missing: null, regenerate: null };
    summaryBatchProgressByUser.set(userId, initial);
    return initial;
  }

  function startSummaryBatch(userId, type, total) {
    const state = getSummaryBatchState(userId);
    state[type] = {
      active: total > 0,
      completed: 0,
      failed: 0,
      finished_at: null,
      started_at: now(),
      total,
    };
  }

  function markSummaryBatchProgress(userId, type, status) {
    if (!type) return;
    const state = getSummaryBatchState(userId);
    const batch = state[type];
    if (!batch) return;
    if (status === 'failed') batch.failed += 1;
    else batch.completed += 1;

    const finishedCount = batch.completed + batch.failed;
    if (finishedCount >= batch.total) {
      batch.active = false;
      batch.finished_at = now();
    }
  }

  function serializeSummaryBatch(batch) {
    if (!batch) return null;
    const pending = Math.max(batch.total - batch.completed - batch.failed, 0);
    const processed = batch.completed + batch.failed;
    const progressPercent = batch.total > 0 ? Math.max(0, Math.min(100, Math.round((processed / batch.total) * 100))) : 0;

    return {
      active: !!batch.active,
      completed: batch.completed,
      failed: batch.failed,
      finished_at: batch.finished_at || null,
      pending,
      progress_percent: progressPercent,
      started_at: batch.started_at || null,
      total: batch.total,
    };
  }

  function beginUserSummaryRequest(userId) {
    const current = summaryConcurrencyByUser.get(userId) || 0;
    if (current >= config.maxConcurrentSummariesPerUser) return false;
    summaryConcurrencyByUser.set(userId, current + 1);
    return true;
  }

  function endUserSummaryRequest(userId) {
    const current = summaryConcurrencyByUser.get(userId) || 0;
    if (current <= 1) {
      summaryConcurrencyByUser.delete(userId);
      return;
    }
    summaryConcurrencyByUser.set(userId, current - 1);
  }

  function buildOpenRouterResponse(userId, options = {}) {
    const { includeSummaryBackfill = true } = options;
    const credential = getCredential(userId);
    const preferences = getPreferences(userId);
    const catalog = getCatalog(userId);

    const textModelId = preferences?.text_model_id || null;
    const visionModelId = preferences?.vision_model_id || null;
    const textModelValid = !textModelId ? false : !!catalog.text.find((model) => model.id === textModelId);
    const visionModelValid = !visionModelId ? false : !!catalog.vision.find((model) => model.id === visionModelId);

    const response = {
      configured: !!credential,
      credential: credential ? {
        expires_at: credential.expires_at || null,
        key_label: credential.key_label || null,
        last4: credential.last4 || null,
        last_error: credential.last_error || null,
        last_model_sync_at: credential.last_model_sync_at || null,
        masked_key: credential.last4 ? `••••${credential.last4}` : null,
        status: credential.status || 'valid',
        validated_at: credential.validated_at || null,
      } : null,
      models: {
        fetched_at: catalog.fetched_at,
        text: catalog.text,
        vision: catalog.vision,
      },
      preferences: {
        summary_prompt: preferences?.summary_prompt || DEFAULT_SUMMARY_PROMPT,
        summary_prompt_default: DEFAULT_SUMMARY_PROMPT,
        text_model_id: textModelId,
        text_model_valid: textModelValid,
        vision_model_id: visionModelId,
        vision_model_valid: visionModelValid,
      },
      provider: config.aiProviderOpenRouter,
    };

    if (includeSummaryBackfill) {
      response.summary_backfill = getOpenRouterSummaryBackfill(userId, response);
    }

    return response;
  }

  function buildSummarySupportState(doc, userId, openRouter = null) {
    const resolvedOpenRouter = openRouter || buildOpenRouterResponse(userId, { includeSummaryBackfill: false });
    if (doc.file_type === 'application/zip') {
      return {
        can_generate: false,
        message: 'ZIP archives are not supported for summaries yet.',
        mode: 'unsupported',
        openRouter: resolvedOpenRouter,
        state: 'unsupported',
      };
    }

    const isImage = typeof doc.file_type === 'string' && doc.file_type.startsWith('image/');
    const mode = isImage ? 'vision' : 'text';

    if (!resolvedOpenRouter.configured) {
      return {
        can_generate: false,
        message: 'Add and validate your OpenRouter key in Settings to enable summaries.',
        mode,
        openRouter: resolvedOpenRouter,
        state: 'no_key',
      };
    }

    if (resolvedOpenRouter.credential?.status && resolvedOpenRouter.credential.status !== 'valid') {
      return {
        can_generate: false,
        message: resolvedOpenRouter.credential.last_error
          ? `Your saved OpenRouter key needs revalidation in Settings before generating summaries. ${resolvedOpenRouter.credential.last_error}`
          : 'Your saved OpenRouter key needs revalidation in Settings before generating summaries.',
        mode,
        openRouter: resolvedOpenRouter,
        state: 'key_invalid',
      };
    }

    if (mode === 'text') {
      if (!resolvedOpenRouter.preferences.text_model_id) {
        return {
          can_generate: false,
          message: 'Choose a text summary model in Settings before summarizing this document.',
          mode,
          openRouter: resolvedOpenRouter,
          state: 'model_missing',
        };
      }
      if (!resolvedOpenRouter.preferences.text_model_valid) {
        return {
          can_generate: false,
          message: 'Your saved text summary model is no longer available. Choose a new one in Settings.',
          mode,
          openRouter: resolvedOpenRouter,
          state: 'model_missing',
        };
      }
    }

    if (mode === 'vision') {
      if (!resolvedOpenRouter.preferences.vision_model_id) {
        return {
          can_generate: false,
          message: 'Choose a vision summary model in Settings before summarizing image documents.',
          mode,
          openRouter: resolvedOpenRouter,
          state: 'model_missing',
        };
      }
      if (!resolvedOpenRouter.preferences.vision_model_valid) {
        return {
          can_generate: false,
          message: 'Your saved vision summary model is no longer available. Choose a new one in Settings.',
          mode,
          openRouter: resolvedOpenRouter,
          state: 'model_missing',
        };
      }
    }

    return {
      can_generate: true,
      message: null,
      mode,
      openRouter: resolvedOpenRouter,
      state: 'missing',
    };
  }

  function isSummaryQueuedOrInflight(userId, documentId) {
    const requestKey = getSummaryRequestKey(userId, documentId);
    return queuedSummaryRequests.has(requestKey) || inflightSummaryRequests.has(requestKey);
  }

  function buildDocumentSummaryResponse(doc, userId, openRouter = null) {
    const baseState = buildSummarySupportState(doc, userId, openRouter);
    const stored = getStoredSummary(doc.id, userId);
    const storedSummaryContent = normalizeStoredSummaryContent(parseJsonValue(stored?.content_json, null));
    const storedMatchesCurrentSettings = !!stored && doesStoredSummaryFingerprintMatch(stored.source_fingerprint, doc);

    if (isSummaryQueuedOrInflight(userId, doc.id) && (!stored || stored.status !== 'completed' || !storedMatchesCurrentSettings)) {
      return {
        ...baseState,
        can_generate: false,
        coverage: null,
        format: config.summaryFormatBrief,
        generated_at: stored?.generated_at || null,
        message: 'Generating summary automatically...',
        model: stored?.model || null,
        provider: config.aiProviderOpenRouter,
        state: 'pending',
        summary: null,
      };
    }

    if (!stored || !storedMatchesCurrentSettings) {
      return {
        ...baseState,
        coverage: null,
        format: config.summaryFormatBrief,
        generated_at: null,
        model: null,
        provider: config.aiProviderOpenRouter,
        summary: null,
      };
    }

    if (stored.status === 'completed') {
      if (!storedSummaryContent) {
        return {
          ...baseState,
          coverage: null,
          format: config.summaryFormatBrief,
          generated_at: null,
          model: null,
          provider: config.aiProviderOpenRouter,
          summary: null,
        };
      }

      return {
        ...baseState,
        can_generate: baseState.can_generate,
        coverage: stored.coverage || null,
        format: config.summaryFormatBrief,
        generated_at: stored.generated_at || null,
        message: null,
        model: stored.model || null,
        provider: stored.provider,
        state: 'ready',
        summary: storedSummaryContent,
      };
    }

    if (stored.status === 'failed') {
      return {
        ...baseState,
        can_generate: baseState.can_generate,
        coverage: null,
        format: config.summaryFormatBrief,
        generated_at: stored.generated_at || null,
        message: stored.error_message || 'Summary generation failed.',
        model: stored.model || null,
        provider: stored.provider,
        state: 'failed',
        summary: null,
      };
    }

    if (stored.status === 'unsupported') {
      return {
        ...baseState,
        can_generate: false,
        coverage: null,
        format: config.summaryFormatBrief,
        generated_at: stored.generated_at || null,
        message: stored.error_message || 'This document cannot be summarized yet.',
        model: null,
        provider: stored.provider || config.aiProviderOpenRouter,
        state: 'unsupported',
        summary: null,
      };
    }

    return {
      ...baseState,
      coverage: null,
      format: config.summaryFormatBrief,
      generated_at: stored.generated_at || null,
      model: stored.model || null,
      provider: config.aiProviderOpenRouter,
      summary: null,
    };
  }

  function getDocumentsNeedingSummary(userId, openRouter = null) {
    const resolvedOpenRouter = openRouter || buildOpenRouterResponse(userId, { includeSummaryBackfill: false });
    return listSummaryCandidateDocuments(userId)
      .map((doc) => ({ doc, summaryState: buildDocumentSummaryResponse(doc, userId, resolvedOpenRouter) }))
      .filter(({ summaryState }) => summaryState.can_generate && (summaryState.state === 'missing' || summaryState.state === 'failed'));
  }

  function getDocumentsEligibleForSummaryRegeneration(userId, openRouter = null) {
    const resolvedOpenRouter = openRouter || buildOpenRouterResponse(userId, { includeSummaryBackfill: false });
    return listSummaryCandidateDocuments(userId)
      .map((doc) => ({ doc, summaryState: buildDocumentSummaryResponse(doc, userId, resolvedOpenRouter) }))
      .filter(({ summaryState }) => summaryState.can_generate && summaryState.state !== 'pending');
  }

  function getOpenRouterSummaryBackfill(userId, openRouter = null) {
    const resolvedOpenRouter = openRouter || buildOpenRouterResponse(userId, { includeSummaryBackfill: false });
    const pendingCount = listSummaryCandidateDocuments(userId)
      .filter((doc) => buildDocumentSummaryResponse(doc, userId, resolvedOpenRouter).state === 'pending')
      .length;
    const regeneratableCount = getDocumentsEligibleForSummaryRegeneration(userId, resolvedOpenRouter).length;
    const batchState = getSummaryBatchState(userId);

    return {
      auto_generate_on_upload: true,
      batches: {
        missing: serializeSummaryBatch(batchState.missing),
        regenerate: serializeSummaryBatch(batchState.regenerate),
      },
      missing_count: getDocumentsNeedingSummary(userId, resolvedOpenRouter).length,
      queue_size: pendingCount,
      regeneratable_count: regeneratableCount,
    };
  }

  async function generateDocumentSummaryForDocument(doc, userId, options = {}) {
    const { force = false } = options;
    const requestKey = getSummaryRequestKey(userId, doc.id);
    const resolvedOpenRouter = buildOpenRouterResponse(userId, { includeSummaryBackfill: false });
    const supportState = buildSummarySupportState(doc, userId, resolvedOpenRouter);
    const current = buildDocumentSummaryResponse(doc, userId, resolvedOpenRouter);

    if (supportState.state === 'no_key' || supportState.state === 'key_invalid' || supportState.state === 'model_missing') {
      throw badRequest(supportState.message || 'OpenRouter setup is required before summaries can be generated.');
    }

    if (!force && (current.state === 'ready' || current.state === 'unsupported' || current.state === 'pending')) {
      return current;
    }

    if (inflightSummaryRequests.has(requestKey)) {
      return inflightSummaryRequests.get(requestKey);
    }

    if (!beginUserSummaryRequest(userId)) {
      throw createError(429, 'Too many summary requests are already running for this account. Please wait and try again.');
    }

    const generationPromise = (async () => {
      const credential = getCredential(userId);
      if (!credential) throw badRequest('Add and validate your OpenRouter key in Settings to enable summaries.');

      const preferences = getPreferences(userId) || {};
      const catalog = getCatalog(userId);
      const fingerprint = getDocumentSummaryFingerprint(doc);
      const filePath = documentFilesStorage.getAbsolutePath(doc.storage_path);
      const existing = getStoredSummary(doc.id, userId);

      try {
        const apiKey = decryptSecret(credential.encrypted_key);
        const result = await summarizeDocument({
          apiKey,
          doc,
          filePath,
          provider: openRouterProvider,
          summaryPrompt: preferences.summary_prompt || DEFAULT_SUMMARY_PROMPT,
          textModelId: preferences.text_model_id || null,
          textModels: catalog.text,
          visionModelId: preferences.vision_model_id || null,
          visionModels: catalog.vision,
        });

        if (result.status === 'completed') {
          upsertDocumentSummary(doc.id, userId, {
            content_json: JSON.stringify(result.content),
            coverage: result.coverage,
            error_message: null,
            generated_at: now(),
            model: result.model,
            provider: config.aiProviderOpenRouter,
            source_fingerprint: fingerprint,
            status: 'completed',
          });

          logDocumentEvent(
            doc.id,
            userId,
            force || existing?.status === 'completed' ? 'summary_regenerated' : 'summary_generated',
            { coverage: result.coverage, mode: result.mode, model: result.model },
          );
        } else if (result.status === 'unsupported') {
          upsertDocumentSummary(doc.id, userId, {
            content_json: null,
            coverage: null,
            error_message: result.reason,
            generated_at: now(),
            model: null,
            provider: config.aiProviderOpenRouter,
            source_fingerprint: fingerprint,
            status: 'unsupported',
          });

          logDocumentEvent(doc.id, userId, 'summary_unsupported', { reason: result.reason });
        }

        return buildDocumentSummaryResponse(doc, userId);
      } catch (error) {
        const message = sanitizeProviderErrorMessage(error, 'Summary generation failed');
        upsertDocumentSummary(doc.id, userId, {
          content_json: null,
          coverage: null,
          error_message: message,
          generated_at: now(),
          model: typeof doc.file_type === 'string' && doc.file_type.startsWith('image/')
            ? preferences.vision_model_id || null
            : preferences.text_model_id || null,
          provider: config.aiProviderOpenRouter,
          source_fingerprint: fingerprint,
          status: 'failed',
        });

        if (error?.status === 401) {
          upsertCredential(userId, {
            encrypted_key: credential.encrypted_key,
            expires_at: credential.expires_at || null,
            key_label: credential.key_label || null,
            last4: credential.last4 || null,
            last_error: sanitizeSummaryRecoveryMessage(error),
            last_model_sync_at: credential.last_model_sync_at || null,
            status: 'invalid',
            validated_at: credential.validated_at || null,
          });
        }

        logDocumentEvent(doc.id, userId, 'summary_failed', { message });
        throw createError(error?.status || 502, message);
      } finally {
        inflightSummaryRequests.delete(requestKey);
        endUserSummaryRequest(userId);
      }
    })();

    inflightSummaryRequests.set(requestKey, generationPromise);
    return generationPromise;
  }

  async function processSummaryGenerationQueue() {
    if (summaryQueueRunning) return;
    summaryQueueRunning = true;

    try {
      while (summaryGenerationQueue.length > 0) {
        const job = summaryGenerationQueue.shift();
        if (!job) continue;

        const requestKey = getSummaryRequestKey(job.userId, job.documentId);
        queuedSummaryRequests.delete(requestKey);

        const doc = documentsRepository.getByIdAndUserId(job.documentId, job.userId);
        if (!doc || doc.trashed) {
          markSummaryBatchProgress(job.userId, job.batchType, 'failed');
          continue;
        }

        try {
          await generateDocumentSummaryForDocument(doc, job.userId, { force: job.force });
          markSummaryBatchProgress(job.userId, job.batchType, 'completed');
        } catch (error) {
          if (error?.status === 429) {
            summaryGenerationQueue.push(job);
            queuedSummaryRequests.add(requestKey);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            markSummaryBatchProgress(job.userId, job.batchType, 'failed');
            console.error(`Summary generation failed for document ${job.documentId}:`, error?.message || error);
          }
        }
      }
    } finally {
      summaryQueueRunning = false;
      if (summaryGenerationQueue.length > 0) {
        processSummaryGenerationQueue().catch((error) => {
          console.error('Summary generation queue failed:', error?.message || error);
        });
      }
    }
  }

  function enqueueDocumentSummaryGeneration(documentId, userId, options = {}) {
    const requestKey = getSummaryRequestKey(userId, documentId);
    if (queuedSummaryRequests.has(requestKey) || inflightSummaryRequests.has(requestKey)) {
      return false;
    }

    queuedSummaryRequests.add(requestKey);
    summaryGenerationQueue.push({
      batchType: options.batchType || null,
      documentId,
      force: options.force === true,
      userId,
    });

    processSummaryGenerationQueue().catch((error) => {
      console.error('Summary generation queue failed:', error?.message || error);
    });

    return true;
  }

  function recoverLegacySummaries(dbPaths = []) {
    const uniquePaths = [...new Set(
      dbPaths
        .filter((dbPath) => typeof dbPath === 'string' && dbPath.trim())
        .map((dbPath) => dbPath.trim())
    )];
    const summary = {
      imported: 0,
      scanned: 0,
      skipped_ambiguous: 0,
      skipped_existing: 0,
      skipped_invalid: 0,
      skipped_missing: 0,
      sources: [],
    };

    for (const dbPath of uniquePaths) {
      const sourceStats = {
        imported: 0,
        path: dbPath,
        scanned: 0,
        skipped_ambiguous: 0,
        skipped_existing: 0,
        skipped_invalid: 0,
        skipped_missing: 0,
      };
      summary.sources.push(sourceStats);

      if (!fs.existsSync(dbPath)) {
        continue;
      }

      let externalDb;
      try {
        externalDb = new Database(dbPath, { readonly: true, fileMustExist: true });
        const rows = externalDb.prepare(`
          SELECT
            s.provider,
            s.model,
            s.coverage,
            s.content_json,
            s.generated_at,
            d.name,
            d.file_type,
            d.file_size
          FROM document_summaries s
          JOIN documents d ON d.id = s.document_id
          WHERE s.status = 'completed'
        `).all();

        for (const row of rows) {
          sourceStats.scanned += 1;
          summary.scanned += 1;

          const normalizedContent = normalizeStoredSummaryContent(parseJsonValue(row.content_json, null));
          if (!normalizedContent) {
            sourceStats.skipped_invalid += 1;
            summary.skipped_invalid += 1;
            continue;
          }

          const matches = documentsRepository.findBySummaryRecoveryKey(row.name, row.file_type || null, row.file_size);
          if (matches.length === 0) {
            sourceStats.skipped_missing += 1;
            summary.skipped_missing += 1;
            continue;
          }

          if (matches.length > 1) {
            sourceStats.skipped_ambiguous += 1;
            summary.skipped_ambiguous += 1;
            continue;
          }

          const targetDoc = matches[0];
          const existing = getStoredSummary(targetDoc.id, targetDoc.user_id);
          if (existing?.status === 'completed') {
            sourceStats.skipped_existing += 1;
            summary.skipped_existing += 1;
            continue;
          }

          upsertDocumentSummary(targetDoc.id, targetDoc.user_id, {
            content_json: row.content_json,
            coverage: row.coverage || null,
            error_message: null,
            generated_at: row.generated_at || now(),
            model: row.model || null,
            provider: row.provider || config.aiProviderOpenRouter,
            source_fingerprint: getDocumentSummaryFingerprint(targetDoc),
            status: 'completed',
          });

          sourceStats.imported += 1;
          summary.imported += 1;
        }
      } catch (error) {
        console.warn(`Legacy summary recovery failed for ${dbPath}:`, error?.message || error);
      } finally {
        if (externalDb) externalDb.close();
      }
    }

    return summary;
  }

  return {
    buildDocumentSummaryResponse(documentId, userId) {
      const doc = documentsRepository.getByIdAndUserId(documentId, userId);
      if (!doc) throw notFound('Not found');
      return buildDocumentSummaryResponse(doc, userId);
    },

    buildOpenRouterResponse,

    getDocumentSummaryState(documentId, userId) {
      const doc = documentsRepository.getByIdAndUserId(documentId, userId);
      if (!doc) throw notFound('Not found');
      return buildDocumentSummaryResponse(doc, userId);
    },

    async generateDocumentSummary(documentId, userId, force = false) {
      const doc = documentsRepository.getByIdAndUserId(documentId, userId);
      if (!doc) throw notFound('Not found');
      return generateDocumentSummaryForDocument(doc, userId, { force });
    },

    async queueMissingSummaries(userId) {
      const openRouter = buildOpenRouterResponse(userId, { includeSummaryBackfill: false });
      const docsNeedingSummary = getDocumentsNeedingSummary(userId, openRouter);
      startSummaryBatch(userId, 'missing', docsNeedingSummary.length);

      let queued = 0;
      for (const { doc, summaryState } of docsNeedingSummary) {
        if (enqueueDocumentSummaryGeneration(doc.id, userId, { batchType: 'missing', force: summaryState.state === 'failed' })) {
          queued += 1;
        }
      }

      return {
        queued,
        settings: buildOpenRouterResponse(userId),
      };
    },

    async refreshModels(userId) {
      const credential = getCredential(userId);
      if (!credential) throw notFound('No OpenRouter key is configured for this account');

      try {
        const apiKey = decryptSecret(credential.encrypted_key);
        const keyInfo = await openRouterProvider.validateApiKey(apiKey);
        const models = await openRouterProvider.listModels(apiKey);
        const catalog = buildOpenRouterCatalog(models);
        const timestamp = now();

        upsertCredential(userId, {
          encrypted_key: credential.encrypted_key,
          expires_at: keyInfo?.expires_at || credential.expires_at || null,
          key_label: keyInfo?.label || credential.key_label || null,
          last4: credential.last4 || getApiKeyLast4(apiKey),
          last_error: null,
          last_model_sync_at: timestamp,
          status: 'valid',
          validated_at: timestamp,
        });
        upsertCatalog(userId, catalog);
        return buildOpenRouterResponse(userId);
      } catch (error) {
        upsertCredential(userId, {
          encrypted_key: credential.encrypted_key,
          expires_at: credential.expires_at || null,
          key_label: credential.key_label || null,
          last4: credential.last4 || null,
          last_error: sanitizeProviderErrorMessage(error, 'Failed to refresh the OpenRouter model list'),
          last_model_sync_at: credential.last_model_sync_at || null,
          status: error?.status === 401 ? 'invalid' : credential.status || 'error',
          validated_at: credential.validated_at || null,
        });

        throw createError(error?.status || 502, sanitizeProviderErrorMessage(error, 'Failed to refresh the OpenRouter model list'));
      }
    },

    regenerateAllSummaries(userId) {
      const openRouter = buildOpenRouterResponse(userId, { includeSummaryBackfill: false });
      const docsForRegeneration = getDocumentsEligibleForSummaryRegeneration(userId, openRouter);
      startSummaryBatch(userId, 'regenerate', docsForRegeneration.length);

      let queued = 0;
      for (const { doc } of docsForRegeneration) {
        if (enqueueDocumentSummaryGeneration(doc.id, userId, { batchType: 'regenerate', force: true })) {
          queued += 1;
        }
      }

      return {
        queued,
        settings: buildOpenRouterResponse(userId),
      };
    },

    recoverLegacySummaries,

    removeKey(userId) {
      deleteSetup(userId);
    },

    savePreferences(userId, input) {
      const catalog = getCatalog(userId);
      const updates = {};

      if (!Object.prototype.hasOwnProperty.call(input || {}, 'textModelId')
        && !Object.prototype.hasOwnProperty.call(input || {}, 'visionModelId')
        && !Object.prototype.hasOwnProperty.call(input || {}, 'summaryPrompt')) {
        throw badRequest('No AI preference changes provided');
      }

      if (Object.prototype.hasOwnProperty.call(input || {}, 'textModelId')) {
        const textModelId = input.textModelId ? String(input.textModelId).trim() : null;
        if (textModelId && !catalog.text.some((model) => model.id === textModelId)) {
          throw badRequest('Choose a valid text summary model from the available list');
        }
        updates.text_model_id = textModelId;
      }

      if (Object.prototype.hasOwnProperty.call(input || {}, 'visionModelId')) {
        const visionModelId = input.visionModelId ? String(input.visionModelId).trim() : null;
        if (visionModelId && !catalog.vision.some((model) => model.id === visionModelId)) {
          throw badRequest('Choose a valid vision summary model from the available list');
        }
        updates.vision_model_id = visionModelId;
      }

      if (Object.prototype.hasOwnProperty.call(input || {}, 'summaryPrompt')) {
        const rawPrompt = typeof input.summaryPrompt === 'string' ? input.summaryPrompt : '';
        const summaryPrompt = rawPrompt.trim();
        if (summaryPrompt && summaryPrompt.length > 4000) {
          throw badRequest('Summary prompt must be 4000 characters or less');
        }
        updates.summary_prompt = summaryPrompt || null;
      }

      upsertPreferences(userId, updates);
      return buildOpenRouterResponse(userId);
    },

    scheduleAutomaticSummaryGeneration(doc, userId) {
      const summaryState = buildDocumentSummaryResponse(doc, userId);
      if (summaryState.state !== 'missing') return false;
      return enqueueDocumentSummaryGeneration(doc.id, userId, { force: false });
    },

    async saveKey(userId, apiKeyInput) {
      const apiKey = typeof apiKeyInput === 'string' ? apiKeyInput.trim() : '';
      if (!apiKey) throw badRequest('OpenRouter API key is required');

      try {
        const keyInfo = await openRouterProvider.validateApiKey(apiKey);
        const models = await openRouterProvider.listModels(apiKey);
        const catalog = buildOpenRouterCatalog(models);
        const timestamp = now();

        upsertCredential(userId, {
          encrypted_key: encryptSecret(apiKey),
          expires_at: keyInfo?.expires_at || null,
          key_label: keyInfo?.label || null,
          last4: getApiKeyLast4(apiKey),
          last_error: null,
          last_model_sync_at: timestamp,
          status: 'valid',
          validated_at: timestamp,
        });
        upsertCatalog(userId, catalog);
        return buildOpenRouterResponse(userId);
      } catch (error) {
        throw createError(error?.status || 502, sanitizeProviderErrorMessage(error, 'Failed to validate the OpenRouter API key'));
      }
    },
  };
}

module.exports = {
  createOpenRouterService,
};
