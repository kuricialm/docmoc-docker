#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = new Set(process.argv.slice(2));

const protectedPathRules = [
  {
    message: 'Environment files must stay local and untracked',
    pattern: /^\.env(\..+)?$/i,
    skip: (filePath) => filePath === '.env.example',
  },
  {
    message: 'Runtime data must never be committed',
    pattern: /^data\//i,
  },
  {
    message: 'Playwright screenshots and media artifacts are blocked from pushes',
    pattern: /^output\/playwright\/.*\.(png|jpe?g|webp|webm|zip)$/i,
  },
  {
    message: 'Local uploads or storage exports must never be committed',
    pattern: /^uploads?\//i,
  },
  {
    message: 'Database files must never be committed',
    pattern: /\.(db|db-shm|db-wal|sqlite|sqlite3)$/i,
  },
  {
    message: 'Private key material must never be committed',
    pattern: /\.(pem|key|p12|pfx|kdbx)$/i,
  },
];

const placeholderValuePattern = /(replace(?:_|-)with|change(?:_|-)me|your(?:_|-)|example|dummy|test-|docmoc\.example|localhost)/i;

const secretContentRules = [
  {
    message: 'Private key material detected',
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    message: 'OpenAI-style API key detected',
    pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/,
  },
  {
    message: 'GitHub personal access token detected',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  },
];

function runGit(argsList) {
  return execFileSync('git', argsList, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function getRepoRoot() {
  return runGit(['rev-parse', '--show-toplevel']).trim();
}

function getTrackedFiles() {
  return runGit(['ls-files', '-z'])
    .split('\0')
    .filter(Boolean);
}

function getStagedFiles() {
  return runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
    .split('\0')
    .filter(Boolean);
}

function isTextFile(buffer) {
  return !buffer.includes(0);
}

function collectCandidateFiles() {
  const files = new Set();
  if (args.has('--repo') || (!args.has('--repo') && !args.has('--staged'))) {
    for (const filePath of getTrackedFiles()) files.add(filePath);
  }
  if (args.has('--staged')) {
    for (const filePath of getStagedFiles()) files.add(filePath);
  }
  return [...files].sort((left, right) => left.localeCompare(right));
}

function findSensitiveAssignments(content) {
  const matches = [];
  const assignmentRegex = /\b(OPENAI_API_KEY|ANTHROPIC_API_KEY|SUPABASE_SERVICE_ROLE_KEY|COOKIE_SECRET|AI_SECRETS_MASTER_KEY|AWS_SECRET_ACCESS_KEY|DATABASE_URL|MONGODB_URI|GITHUB_TOKEN|GH_TOKEN)\b\s*[:=]\s*['"]?([^\s'",}]+)/gi;
  let match = assignmentRegex.exec(content);
  while (match) {
    const value = match[2] || '';
    if (value.startsWith('${')) {
      match = assignmentRegex.exec(content);
      continue;
    }
    if (value.length >= 8 && !placeholderValuePattern.test(value)) {
      matches.push(match[1]);
    }
    match = assignmentRegex.exec(content);
  }
  return matches;
}

function main() {
  const repoRoot = getRepoRoot();
  const violations = [];

  for (const relativePath of collectCandidateFiles()) {
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
      continue;
    }

    for (const rule of protectedPathRules) {
      if (rule.pattern.test(normalizedPath) && !rule.skip?.(normalizedPath)) {
        violations.push(`${normalizedPath}: ${rule.message}`);
      }
    }

    let buffer;
    try {
      buffer = fs.readFileSync(absolutePath);
    } catch {
      continue;
    }

    if (!isTextFile(buffer)) continue;

    const content = buffer.toString('utf8');
    const sensitiveAssignments = findSensitiveAssignments(content);
    if (sensitiveAssignments.length > 0) {
      violations.push(`${normalizedPath}: Sensitive secret assignment detected (${[...new Set(sensitiveAssignments)].join(', ')})`);
    }

    for (const rule of secretContentRules) {
      if (rule.pattern.test(content)) {
        violations.push(`${normalizedPath}: ${rule.message}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error('Sensitive content scan failed. Resolve these items before pushing:\n');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log('Sensitive content scan passed.');
}

if (require.main === module) {
  main();
}

module.exports = {
  findSensitiveAssignments,
};
