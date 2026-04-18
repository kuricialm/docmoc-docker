const fs = require('fs');
const os = require('os');
const path = require('path');

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

function loadConfig(env = process.env) {
  const projectDir = path.resolve(__dirname, '../..');
  const resolvedPaths = resolveProjectPaths(projectDir, env);
  const nodeEnv = env.NODE_ENV || 'development';

  return {
    adminEmail: env.ADMIN_EMAIL || 'admin@docmoc.local',
    adminPassword: env.ADMIN_PASSWORD || 'admin',
    aiProviderOpenRouter: 'openrouter',
    cookieDomain: env.COOKIE_DOMAIN || undefined,
    cookieSecret: env.COOKIE_SECRET || 'docmoc-secret-change-me',
    cookieSecureMode: env.COOKIE_SECURE_MODE || 'auto',
    currentDatabasePath: resolvedPaths.currentDatabasePath,
    dataDir: resolvedPaths.dataDir,
    distDir: resolvedPaths.distDir,
    maxConcurrentSummariesPerUser: parseInt(env.MAX_CONCURRENT_SUMMARIES_PER_USER || '2', 10),
    nodeEnv,
    port: parseInt(env.PORT || '3001', 10),
    projectDir: resolvedPaths.projectDir,
    repoRoot: resolvedPaths.repoRoot,
    rootDir: resolvedPaths.repoRoot,
    summaryRecoveryPaths: resolvedPaths.summaryRecoveryPaths,
    summaryCacheVersion: 'summary-text-v1',
    summaryFormatBrief: 'brief',
    tmpDir: path.join(resolvedPaths.dataDir, 'tmp'),
    trashRetentionDays: parseInt(env.TRASH_RETENTION_DAYS || '30', 10),
    trustProxy: resolveTrustProxySetting(env.TRUST_PROXY, nodeEnv),
    uploadsDir: path.join(resolvedPaths.dataDir, 'uploads'),
  };
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
  resolveCanonicalRepoRoot,
  resolveProjectPaths,
  resolveTrustProxySetting,
};
