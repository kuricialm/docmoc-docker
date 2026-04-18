const fs = require('fs');
const bcrypt = require('bcryptjs');
const { loadConfig } = require('../config/index.cjs');
const { createDatabase } = require('../db/createDatabase.cjs');
const { runMigrations } = require('../db/runMigrations.cjs');
const { createUploadMiddleware } = require('../middleware/uploads.cjs');
const { createAuthMiddleware } = require('../middleware/auth.cjs');
const { createAiCredentialsRepository } = require('../repositories/aiCredentials.cjs');
const { createAiModelCatalogRepository } = require('../repositories/aiModelCatalog.cjs');
const { createAiPreferencesRepository } = require('../repositories/aiPreferences.cjs');
const { createDocumentSummariesRepository } = require('../repositories/documentSummaries.cjs');
const { createDocumentsRepository } = require('../repositories/documents.cjs');
const { createDocumentTagsRepository } = require('../repositories/documentTags.cjs');
const { createHistoryRepository } = require('../repositories/history.cjs');
const { createNotesRepository } = require('../repositories/notes.cjs');
const { createSessionsRepository } = require('../repositories/sessions.cjs');
const { createSettingsRepository } = require('../repositories/settings.cjs');
const { createSharesRepository } = require('../repositories/shares.cjs');
const { createTagsRepository } = require('../repositories/tags.cjs');
const { createUsersRepository } = require('../repositories/users.cjs');
const { createBrandingStorage } = require('../storage/brandingAssets.cjs');
const { createDocumentFilesStorage } = require('../storage/documentFiles.cjs');
const { createBrandingService } = require('../services/branding.cjs');
const { createSettingsService } = require('../services/settings.cjs');
const { createAuthService } = require('../services/auth.cjs');
const { createUsersService } = require('../services/users.cjs');
const { createProfileService } = require('../services/profile.cjs');
const { createDocumentPresenter } = require('../services/documentPresenter.cjs');
const { createDocumentsService } = require('../services/documents.cjs');
const { createTagsService } = require('../services/tags.cjs');
const { createNotesHistoryService } = require('../services/notesHistory.cjs');
const { createSharedService } = require('../services/shared.cjs');
const { createOpenRouterService } = require('../services/ai/openrouter.cjs');
const { formatBytes, now, resolveDisplayName, uid } = require('../lib/core.cjs');

function ensureDirectories(config) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.mkdirSync(config.tmpDir, { recursive: true });
}

function seedAdminIfNeeded({ config, usersRepository }) {
  if (usersRepository.count() > 0) return;
  usersRepository.createUser({
    createdAt: now(),
    email: config.adminEmail,
    fullName: 'Admin',
    id: uid(),
    passwordHash: bcrypt.hashSync(config.adminPassword, 10),
    role: 'admin',
  });
  console.log(`Seeded admin user: ${config.adminEmail}`);
}

function createContext(env = process.env) {
  const config = loadConfig(env);
  ensureDirectories(config);

  const db = createDatabase(config);
  runMigrations(db);

  const repositories = {
    aiCredentials: createAiCredentialsRepository(db),
    aiModelCatalog: createAiModelCatalogRepository(db),
    aiPreferences: createAiPreferencesRepository(db),
    documentSummaries: createDocumentSummariesRepository(db),
    documentTags: createDocumentTagsRepository(db),
    documents: createDocumentsRepository(db),
    history: createHistoryRepository(db),
    notes: createNotesRepository(db),
    sessions: createSessionsRepository(db),
    settings: createSettingsRepository(db),
    shares: createSharesRepository(db),
    tags: createTagsRepository(db),
    users: createUsersRepository(db),
  };

  seedAdminIfNeeded({ config, usersRepository: repositories.users });

  const storage = {
    branding: createBrandingStorage(config),
    documentFiles: createDocumentFilesStorage(config),
  };

  const services = {};
  services.branding = createBrandingService({
    brandingStorage: storage.branding,
    settingsRepository: repositories.settings,
  });
  services.settings = createSettingsService({
    brandingService: services.branding,
    settingsRepository: repositories.settings,
  });
  services.auth = createAuthService({
    brandingService: services.branding,
    config,
    now,
    sessionsRepository: repositories.sessions,
    settingsService: services.settings,
    uid,
    usersRepository: repositories.users,
  });
  services.users = createUsersService({
    now,
    sessionsRepository: repositories.sessions,
    uid,
    usersRepository: repositories.users,
  });
  services.profile = createProfileService({
    sessionsRepository: repositories.sessions,
    usersRepository: repositories.users,
  });
  services.documentPresenter = createDocumentPresenter({
    documentTagsRepository: repositories.documentTags,
    documentsRepository: repositories.documents,
    usersRepository: repositories.users,
  });
  services.openRouter = createOpenRouterService({
    aiCredentialsRepository: repositories.aiCredentials,
    aiModelCatalogRepository: repositories.aiModelCatalog,
    aiPreferencesRepository: repositories.aiPreferences,
    config,
    documentFilesStorage: storage.documentFiles,
    documentSummariesRepository: repositories.documentSummaries,
    documentsRepository: repositories.documents,
    historyRepository: repositories.history,
    now,
    uid,
  });
  if (Array.isArray(config.summaryRecoveryPaths) && config.summaryRecoveryPaths.length > 0) {
    const recovery = services.openRouter.recoverLegacySummaries(config.summaryRecoveryPaths);
    if (recovery.scanned > 0) {
      console.log('OpenRouter summary recovery:', JSON.stringify(recovery));
    }
  }
  services.documents = createDocumentsService({
    config,
    documentFilesStorage: storage.documentFiles,
    documentPresenter: services.documentPresenter,
    documentsRepository: repositories.documents,
    formatBytes,
    historyRepository: repositories.history,
    now,
    resolveDisplayName,
    sharesRepository: repositories.shares,
    summaryService: services.openRouter,
    uid,
  });
  services.tags = createTagsService({
    documentTagsRepository: repositories.documentTags,
    documentsRepository: repositories.documents,
    historyRepository: repositories.history,
    now,
    tagsRepository: repositories.tags,
    uid,
  });
  services.notesHistory = createNotesHistoryService({
    documentPresenter: services.documentPresenter,
    documentsRepository: repositories.documents,
    historyRepository: repositories.history,
    notesRepository: repositories.notes,
    now,
    uid,
  });
  services.shared = createSharedService({
    documentFilesStorage: storage.documentFiles,
    documentPresenter: services.documentPresenter,
    documentsRepository: repositories.documents,
    historyRepository: repositories.history,
    now,
    sharesRepository: repositories.shares,
    uid,
  });

  const uploadMiddleware = createUploadMiddleware(config);
  const authMiddleware = createAuthMiddleware({ authService: services.auth });

  return {
    authMiddleware,
    config,
    db,
    repositories,
    services,
    storage,
    uploadMiddleware,
  };
}

module.exports = {
  createContext,
};
