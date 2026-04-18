// @vitest-environment node
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  discoverSummaryRecoveryPaths,
  loadConfig,
  parseAllowedOrigins,
  resolveProjectPaths,
} = require('./index.cjs');

const tempDirs = [];

function makeTempDir(prefix = 'docmoc-config-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeFile(filePath, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { force: true, recursive: true });
  }
});

describe('resolveProjectPaths', () => {
  it('uses the local repo data directory for a normal checkout', () => {
    const repoDir = makeTempDir();
    fs.mkdirSync(path.join(repoDir, '.git'));

    const resolved = resolveProjectPaths(repoDir, {});

    expect(resolved.repoRoot).toBe(repoDir);
    expect(resolved.dataDir).toBe(path.join(repoDir, 'data'));
    expect(resolved.distDir).toBe(path.join(repoDir, 'dist'));
  });

  it('uses the primary repo data directory for a git worktree checkout', () => {
    const primaryRepoDir = makeTempDir();
    const worktreeDir = makeTempDir();
    const worktreeAdminDir = path.join(primaryRepoDir, '.git', 'worktrees', 'feature-branch');

    fs.mkdirSync(worktreeAdminDir, { recursive: true });
    writeFile(path.join(worktreeDir, '.git'), `gitdir: ${worktreeAdminDir}\n`);
    writeFile(path.join(worktreeAdminDir, 'commondir'), '../..\n');

    const resolved = resolveProjectPaths(worktreeDir, {});

    expect(resolved.repoRoot).toBe(primaryRepoDir);
    expect(resolved.dataDir).toBe(path.join(primaryRepoDir, 'data'));
    expect(resolved.distDir).toBe(path.join(worktreeDir, 'dist'));
  });

  it('honors an explicit DATA_DIR override', () => {
    const repoDir = makeTempDir();
    const customDataDir = makeTempDir('docmoc-custom-data-');
    fs.mkdirSync(path.join(repoDir, '.git'));

    const resolved = resolveProjectPaths(repoDir, { DATA_DIR: customDataDir });

    expect(resolved.dataDir).toBe(customDataDir);
    expect(resolved.currentDatabasePath).toBe(path.join(customDataDir, 'docmoc.db'));
  });
});

describe('discoverSummaryRecoveryPaths', () => {
  it('finds legacy Codex worktree databases and excludes the current database', () => {
    const homeDir = makeTempDir('docmoc-home-');
    const repoName = 'docmoc';
    const currentDatabasePath = path.join(homeDir, 'current', 'docmoc.db');
    const legacyA = path.join(homeDir, '.codex', 'worktrees', '7951', repoName, 'data', 'docmoc.db');
    const legacyB = path.join(homeDir, '.codex', 'worktrees', '7f6a', repoName, 'data', 'docmoc.db');

    writeFile(currentDatabasePath);
    writeFile(legacyA);
    writeFile(legacyB);

    const resolved = discoverSummaryRecoveryPaths(homeDir, repoName, currentDatabasePath);

    expect(resolved).toEqual([legacyA, legacyB].sort((left, right) => left.localeCompare(right)));
  });
});

describe('loadConfig', () => {
  it('rejects placeholder secrets in production', () => {
    expect(() => loadConfig({
      AI_SECRETS_MASTER_KEY: 'change-me-for-ai-secrets',
      COOKIE_SECRET: 'change-me-in-production',
      NODE_ENV: 'production',
      PORT: '3001',
    })).toThrow(/must be set to a non-default value/);
  });
});

describe('parseAllowedOrigins', () => {
  it('adds local development origins automatically outside production', () => {
    const origins = parseAllowedOrigins('', 'development');
    expect(origins).toContain('http://localhost:8080');
    expect(origins).toContain('http://127.0.0.1:3001');
  });

  it('keeps production origins explicit', () => {
    expect(parseAllowedOrigins('https://docmoc.example.com', 'production')).toEqual([
      'https://docmoc.example.com',
    ]);
  });
});
