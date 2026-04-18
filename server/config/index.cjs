const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_MAX_BRANDING_UPLOAD_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function readTrimmedFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return null;
  }
}

function resolveCanonicalRepoRoot(projectDir) {
  const dotGitPath = path.join(projectDir, '.git');

  try {
    if (fs.statSync(dotGitPath).isDirectory()) {
      return projectDir;
    }
  } catch {
    return projectDir;
  }

  const gitPointer = readTrimmedFile(dotGitPath);
  const gitDirMatch = gitPointer?.match(/^gitdir:\s*(.+)$/i);
  if (!gitDirMatch) return projectDir;

  const gitDir = path.resolve(projectDir, gitDirMatch[1].trim());
  const commonDirValue = readTrimmedFile(path.join(gitDir, 'commondir'));
  if (!commonDirValue) return projectDir;

  const commonGitDir = path.resolve(gitDir, commonDirValue);
  return path.basename(commonGitDir) === '.git'
    ? path.dirname(commonGitDir)
    : projectDir;
}

function discoverSummaryRecoveryPaths(homeDir, repoName, currentDatabasePath) {
  if (!homeDir || !repoName) return [];

  const worktreesDir = path.join(homeDir, '.codex', 'worktrees');
  let entries = [];

  try {
    entries = fs.readdirSync(worktreesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const currentDatabasePathResolved = path.resolve(currentDatabasePath);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(worktreesDir, entry.name, repoName, 'data', 'docmoc.db'))
    .filter((candidatePath) => {
      try {
        return fs.statSync(candidatePath).isFile()
          && path.resolve(candidatePath) !== currentDatabasePathResolved;
      } catch {
        return false;
      }
    })
    .sort((left, right) => left.localeCompare(right));
}

function resolveProjectPaths(projectDir, env = process.env) {
  const repoRoot = resolveCanonicalRepoRoot(projectDir);
  const explicitDataDir = typeof env.DATA_DIR === 'string' && env.DATA_DIR.trim()
    ? path.resolve(env.DATA_DIR.trim())
    : null;
  const dataDir = explicitDataDir || path.join(repoRoot, 'data');
  const currentDatabasePath = path.join(dataDir, 'docmoc.db');
  const homeDir = env.HOME || os.homedir();

  return {
    currentDatabasePath,
    dataDir,
    distDir: path.join(projectDir, 'dist'),
    projectDir,
    repoRoot,
    summaryRecoveryPaths: discoverSummaryRecoveryPaths(homeDir, path.basename(repoRoot), currentDatabasePath),
  };
}

function resolveTrustProxySetting(rawValue, nodeEnv) {
  if (rawValue === undefined) return nodeEnv === 'production' ? 1 : false;
  const normalized = String(rawValue).trim().toLowerCase();
  if (normalized === 'true') return 1;
  if (normalized === 'false') return false;
  const asNumber = Number.parseInt(normalized, 10);
  if (!Number.isNaN(asNumber)) return asNumber;
  return rawValue;
}

function parsePositiveInteger(rawValue, fallbackValue, label) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return fallbackValue;
  }

  const parsed = Number.parseInt(String(rawValue).trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseAllowedOrigins(rawValue, nodeEnv) {
  const configuredOrigins = String(rawValue || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new URL(value).origin);

  if (nodeEnv !== 'production') {
    configuredOrigins.push(
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    );
  }

  return [...new Set(configuredOrigins)];
}

function validateProductionConfig(config) {
  if (config.nodeEnv !== 'production') return;

  const placeholderValues = {
    AI_SECRETS_MASTER_KEY: new Set(['', 'change-me-for-ai-secrets']),
    ADMIN_PASSWORD: new Set(['', 'admin']),
    COOKIE_SECRET: new Set(['', 'change-me-in-production', 'docmoc-secret-change-me']),
  };

  if (placeholderValues.ADMIN_PASSWORD.has(config.adminPassword)) {
    throw new Error('ADMIN_PASSWORD must be set to a non-default value in production');
  }

  if (placeholderValues.COOKIE_SECRET.has(config.cookieSecret)) {
    throw new Error('COOKIE_SECRET must be set to a non-default value in production');
  }

  if (placeholderValues.AI_SECRETS_MASTER_KEY.has(config.aiSecretsMasterKey)) {
    throw new Error('AI_SECRETS_MASTER_KEY must be set to a non-default value in production');
  }
}

function loadConfig(env = process.env) {
  const projectDir = path.resolve(__dirname, '../..');
  const resolvedPaths = resolveProjectPaths(projectDir, env);
  const nodeEnv = env.NODE_ENV || 'development';

  const config = {
    aiSecretsMasterKey: typeof env.AI_SECRETS_MASTER_KEY === 'string' ? env.AI_SECRETS_MASTER_KEY.trim() : '',
    adminEmail: env.ADMIN_EMAIL || 'admin@docmoc.local',
    adminPassword: env.ADMIN_PASSWORD || 'admin',
    allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS, nodeEnv),
    aiProviderOpenRouter: 'openrouter',
    cookieDomain: env.COOKIE_DOMAIN || undefined,
    cookieSecret: env.COOKIE_SECRET || 'docmoc-secret-change-me',
    cookieSecureMode: env.COOKIE_SECURE_MODE || 'auto',
    currentDatabasePath: resolvedPaths.currentDatabasePath,
    dataDir: resolvedPaths.dataDir,
    distDir: resolvedPaths.distDir,
    maxBrandingUploadBytes: parsePositiveInteger(env.MAX_BRANDING_UPLOAD_BYTES, DEFAULT_MAX_BRANDING_UPLOAD_BYTES, 'MAX_BRANDING_UPLOAD_BYTES'),
    maxConcurrentSummariesPerUser: parseInt(env.MAX_CONCURRENT_SUMMARIES_PER_USER || '2', 10),
    maxUploadBytes: parsePositiveInteger(env.MAX_UPLOAD_BYTES, DEFAULT_MAX_UPLOAD_BYTES, 'MAX_UPLOAD_BYTES'),
    nodeEnv,
    port: parseInt(env.PORT || '3001', 10),
    projectDir: resolvedPaths.projectDir,
    repoRoot: resolvedPaths.repoRoot,
    rootDir: resolvedPaths.repoRoot,
    summaryRecoveryPaths: resolvedPaths.summaryRecoveryPaths,
    summaryCacheVersion: 'summary-text-v1',
    summaryFormatBrief: 'brief',
    tmpDir: path.join(resolvedPaths.dataDir, 'tmp'),
    trustProxy: resolveTrustProxySetting(env.TRUST_PROXY, nodeEnv),
    uploadsDir: path.join(resolvedPaths.dataDir, 'uploads'),
  };

  validateProductionConfig(config);
  return config;
}

function getSessionCookieOptions(req, config, maxAge) {
  const isSecure = config.cookieSecureMode === 'always'
    ? true
    : config.cookieSecureMode === 'never'
      ? false
      : req.secure;

  const options = {
    httpOnly: true,
    path: '/',
  };

  if (isSecure) {
    options.secure = true;
    options.sameSite = 'none';
  } else {
    options.sameSite = 'lax';
  }

  if (config.cookieDomain) options.domain = config.cookieDomain;
  if (maxAge) options.maxAge = maxAge;
  return options;
}

module.exports = {
  discoverSummaryRecoveryPaths,
  getSessionCookieOptions,
  loadConfig,
  parseAllowedOrigins,
  resolveCanonicalRepoRoot,
  resolveProjectPaths,
  resolveTrustProxySetting,
  validateProductionConfig,
};
