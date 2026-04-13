const express = require('express');
const multer = require('multer');
const Database = require('better-sqlite3');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ── Config ──
const PORT = parseInt(process.env.PORT || '3001', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@docmoc.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const TRASH_RETENTION_DAYS = parseInt(process.env.TRASH_RETENTION_DAYS || '30', 10);
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'docmoc-secret-change-me';

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Database ──
const db = new Database(path.join(DATA_DIR, 'docmoc.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, full_name TEXT,
    role TEXT DEFAULT 'user', password_hash TEXT NOT NULL, accent_color TEXT,
    avatar_url TEXT, workspace_logo_url TEXT, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
    file_type TEXT, file_size INTEGER, storage_path TEXT,
    starred INTEGER DEFAULT 0, trashed INTEGER DEFAULT 0, trashed_at TEXT,
    shared INTEGER DEFAULT 0, share_token TEXT, created_at TEXT, updated_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
    color TEXT, created_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS document_tags (
    document_id TEXT NOT NULL, tag_id TEXT NOT NULL,
    PRIMARY KEY(document_id, tag_id),
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY, document_id TEXT NOT NULL, user_id TEXT NOT NULL,
    content TEXT, created_at TEXT, updated_at TEXT,
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS document_history (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE INDEX IF NOT EXISTS idx_document_history_document_created
    ON document_history (document_id, created_at DESC);
`);

function ensureDocumentColumn(columnName, sqlDefinition) {
  const cols = db.prepare('PRAGMA table_info(documents)').all();
  if (!cols.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE documents ADD COLUMN ${sqlDefinition}`);
  }
}

ensureDocumentColumn('share_expires_at', 'share_expires_at TEXT');
ensureDocumentColumn('share_password_hash', 'share_password_hash TEXT');

// Seed admin
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.prepare('INSERT INTO users (id, email, full_name, role, password_hash, created_at) VALUES (?,?,?,?,?,?)')
    .run(uid(), ADMIN_EMAIL, 'Admin', 'admin', hash, now());
  console.log(`Seeded admin user: ${ADMIN_EMAIL}`);
}

// Seed default settings
const regSetting = db.prepare("SELECT value FROM settings WHERE key='registration_enabled'").get();
if (!regSetting) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('registration_enabled', 'true')").run();
}

// ── Helpers ──
function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }
function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function normalizeUploadedFilename(filename) {
  if (typeof filename !== 'string') return 'document';
  const trimmed = filename.trim();
  if (!trimmed) return 'document';

  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
  const mojibakeRegex = /[ÃØÙÐÑ][\u0080-\u00FF]?/g;
  const matchCount = (value, regex) => (value.match(regex) || []).length;
  const replacementCount = (value) => (value.match(/�/g) || []).length;
  const printableCount = (value) => (value.match(/[\p{L}\p{N}\s._\-()[\]]/gu) || []).length;
  const decodeLatin1ToUtf8 = (value) => Buffer.from(value, 'latin1').toString('utf8');
  const hasMojibakeHints = (value) => matchCount(value, mojibakeRegex) >= 3;

  const candidates = [trimmed];
  const firstPass = decodeLatin1ToUtf8(trimmed);
  candidates.push(firstPass);
  const secondPass = decodeLatin1ToUtf8(firstPass);
  if (secondPass !== firstPass) candidates.push(secondPass);
  if (hasMojibakeHints(trimmed) && /[\r\n]/.test(trimmed)) {
    const controlRecovered = trimmed.replace(/\r\n|\r|\n/g, '\x85');
    candidates.push(decodeLatin1ToUtf8(controlRecovered));
  }

  const score = (value) => (
    matchCount(value, arabicRegex) * 4 +
    printableCount(value) -
    matchCount(value, mojibakeRegex) * 3 -
    replacementCount(value) * 6
  );

  const best = candidates.sort((a, b) => score(b) - score(a))[0];
  return best || 'document';
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 4;
}

function getWorkspaceLogoUrl() {
  const row = db.prepare("SELECT value FROM settings WHERE key='workspace_logo_url'").get();
  return row ? row.value : null;
}

function getWorkspaceFaviconUrl() {
  const row = db.prepare("SELECT value FROM settings WHERE key='workspace_favicon_url'").get();
  return row ? row.value : null;
}

function extFromMime(mime) {
  const map = {
    'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv',
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/svg+xml': 'svg', 'application/zip': 'zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  };
  if (map[mime]) return map[mime];
  const parts = (mime || '').split('/');
  return parts[1] || 'bin';
}

function logDocumentEvent(documentId, userId, action, details = null) {
  const serializedDetails = details && typeof details === 'object' ? JSON.stringify(details) : null;
  db.prepare('INSERT INTO document_history (id, document_id, user_id, action, details, created_at) VALUES (?,?,?,?,?,?)')
    .run(uid(), documentId, userId, action, serializedDetails, now());
}

function getOwnedDocument(documentId, userId) {
  return db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(documentId, userId);
}

function ensureUploadHistoryEntry(documentId, userId) {
  const existing = db.prepare(`
    SELECT id FROM document_history
    WHERE document_id = ? AND user_id = ? AND action = 'uploaded'
    LIMIT 1
  `).get(documentId, userId);
  if (existing) return;

  const doc = db.prepare('SELECT name, created_at FROM documents WHERE id = ? AND user_id = ?').get(documentId, userId);
  if (!doc) return;
  db.prepare('INSERT INTO document_history (id, document_id, user_id, action, details, created_at) VALUES (?,?,?,?,?,?)')
    .run(uid(), documentId, userId, 'uploaded', JSON.stringify({ name: doc.name }), doc.created_at || now());
}

// ── Trash cleanup ──
function cleanupTrash() {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86400000).toISOString();
  const rows = db.prepare('SELECT id, storage_path FROM documents WHERE trashed = 1 AND trashed_at < ?').all(cutoff);
  for (const row of rows) {
    const filePath = path.join(DATA_DIR, row.storage_path);
    try { fs.unlinkSync(filePath); } catch (_) {}
    // Clean empty parent dir
    try { fs.rmdirSync(path.dirname(filePath)); } catch (_) {}
    db.prepare('DELETE FROM documents WHERE id = ?').run(row.id);
  }
  if (rows.length) console.log(`Trash cleanup: removed ${rows.length} expired documents`);
}
cleanupTrash();
setInterval(cleanupTrash, 3600000);

function cleanupExpiredShares(userId) {
  const isoNow = now();
  if (userId) {
    db.prepare(`
      UPDATE documents
      SET shared = 0, share_token = NULL, share_expires_at = NULL, share_password_hash = NULL, updated_at = ?
      WHERE user_id = ? AND shared = 1 AND share_expires_at IS NOT NULL AND share_expires_at <= ?
    `).run(isoNow, userId, isoNow);
    return;
  }
  db.prepare(`
    UPDATE documents
    SET shared = 0, share_token = NULL, share_expires_at = NULL, share_password_hash = NULL, updated_at = ?
    WHERE shared = 1 AND share_expires_at IS NOT NULL AND share_expires_at <= ?
  `).run(isoNow, isoNow);
}

// ── Express app ──
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

// Cookie helper — adapts to secure (HTTPS / proxy) contexts for iframe/preview compat
function sessionCookieOpts(req, maxAge) {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const opts = { httpOnly: true, path: '/' };
  if (isSecure) {
    opts.secure = true;
    opts.sameSite = 'none';
  } else {
    opts.sameSite = 'lax';
  }
  if (maxAge) opts.maxAge = maxAge;
  return opts;
}

const upload = multer({ dest: path.join(DATA_DIR, 'tmp') });

// ── Auth middleware ──
function auth(req, res, next) {
  const token = req.cookies.session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'Invalid session' });
  const user = db.prepare('SELECT id, email, full_name, role, accent_color, avatar_url, workspace_logo_url, created_at FROM users WHERE id = ?').get(session.user_id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  user.workspace_logo_url = getWorkspaceLogoUrl();
  req.user = user;
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ── Auth routes ──
app.post('/api/auth/login', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const rememberMe = req.body?.rememberMe === true;
  if (!email || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = uid();
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)').run(token, user.id, now());
  const maxAge = rememberMe ? 30 * 86400000 : undefined; // 30 days or session-only
  res.cookie('session', token, sessionCookieOpts(req, maxAge));
  res.json({ id: user.id, email: user.email, fullName: user.full_name, role: user.role, accentColor: user.accent_color, avatarUrl: user.avatar_url, workspaceLogoUrl: getWorkspaceLogoUrl() });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.session;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie('session', sessionCookieOpts(req));
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json(req.user);
});

// ── Users (admin) ──
app.get('/api/users', auth, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id, email, full_name, role, created_at FROM users').all();
  res.json(users);
});

app.post('/api/users', auth, adminOnly, (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const fullName = req.body?.fullName;
  const role = req.body?.role;
  if (!email || !isValidPassword(password)) {
    return res.status(400).json({ error: 'Valid email and password are required' });
  }
  if (role && role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email already exists' });
  const hash = bcrypt.hashSync(password, 10);
  const id = uid();
  db.prepare('INSERT INTO users (id, email, full_name, role, password_hash, created_at) VALUES (?,?,?,?,?,?)')
    .run(id, email, fullName || email, role || 'user', hash, now());
  res.json({ id, email, fullName: fullName || email, role: role || 'user' });
});

app.patch('/api/users/:id/role', auth, adminOnly, (req, res) => {
  const { role } = req.body;
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ ok: true });
});

// ── Profile ──
app.patch('/api/profile', auth, (req, res) => {
  const { accentColor, fullName, workspaceLogoUrl } = req.body;
  const sets = [];
  const vals = [];
  if (accentColor !== undefined) { sets.push('accent_color = ?'); vals.push(accentColor); }
  if (fullName !== undefined) { sets.push('full_name = ?'); vals.push(fullName); }
  if (workspaceLogoUrl !== undefined) { sets.push('workspace_logo_url = ?'); vals.push(workspaceLogoUrl); }
  if (sets.length) {
    vals.push(req.user.id);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
  const updated = db.prepare('SELECT id, email, full_name, role, accent_color, avatar_url, workspace_logo_url FROM users WHERE id = ?').get(req.user.id);
  res.json(updated);
});

app.patch('/api/profile/password', auth, (req, res) => {
  const { newPassword } = req.body;
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  // Clear all sessions for this user (force re-login)
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
  res.clearCookie('session', sessionCookieOpts(req));
  res.json({ ok: true });
});

app.patch('/api/profile/email', auth, (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email is required' });
  const nextEmail = email.trim().toLowerCase();
  if (!nextEmail.includes('@')) return res.status(400).json({ error: 'Invalid email address' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(nextEmail);
  if (existing && existing.id !== req.user.id) {
    return res.status(409).json({ error: 'Email is already in use' });
  }

  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(nextEmail, req.user.id);
  res.json({ ok: true });
});

app.post('/api/profile/logo', auth, adminOnly, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const ext = extFromMime(req.file.mimetype);
  const logoDir = path.join(DATA_DIR, 'logos');
  fs.mkdirSync(logoDir, { recursive: true });
  for (const file of fs.readdirSync(logoDir)) {
    fs.rmSync(path.join(logoDir, file), { force: true });
  }
  const logoPath = path.join(logoDir, `workspace.${ext}`);
  fs.renameSync(req.file.path, logoPath);
  const url = `/api/profile/logo/workspace.${ext}`;
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('workspace_logo_url', ?)").run(url);
  res.json({ url });
});

app.delete('/api/profile/logo', auth, adminOnly, (req, res) => {
  const logoDir = path.join(DATA_DIR, 'logos');
  if (fs.existsSync(logoDir)) {
    for (const file of fs.readdirSync(logoDir)) {
      fs.rmSync(path.join(logoDir, file), { force: true });
    }
  }
  db.prepare("DELETE FROM settings WHERE key = 'workspace_logo_url'").run();
  res.json({ ok: true });
});

app.get('/api/profile/logo/:filename', (req, res) => {
  const logoPath = path.join(DATA_DIR, 'logos', req.params.filename);
  if (!fs.existsSync(logoPath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(logoPath);
});

app.post('/api/profile/favicon', auth, adminOnly, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const ext = extFromMime(req.file.mimetype);
  const faviconDir = path.join(DATA_DIR, 'favicons');
  fs.mkdirSync(faviconDir, { recursive: true });
  for (const file of fs.readdirSync(faviconDir)) {
    fs.rmSync(path.join(faviconDir, file), { force: true });
  }
  const faviconPath = path.join(faviconDir, `workspace.${ext}`);
  fs.renameSync(req.file.path, faviconPath);
  const url = `/api/profile/favicon/workspace.${ext}`;
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('workspace_favicon_url', ?)").run(url);
  res.json({ url });
});

app.delete('/api/profile/favicon', auth, adminOnly, (req, res) => {
  const faviconDir = path.join(DATA_DIR, 'favicons');
  if (fs.existsSync(faviconDir)) {
    for (const file of fs.readdirSync(faviconDir)) {
      fs.rmSync(path.join(faviconDir, file), { force: true });
    }
  }
  db.prepare("DELETE FROM settings WHERE key = 'workspace_favicon_url'").run();
  res.json({ ok: true });
});

app.get('/api/profile/favicon/:filename', (req, res) => {
  const faviconPath = path.join(DATA_DIR, 'favicons', req.params.filename);
  if (!fs.existsSync(faviconPath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(faviconPath);
});

// ── Settings ──
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value === 'true' ? true : r.value === 'false' ? false : r.value === 'null' ? null : r.value;
  settings.workspace_favicon_url = getWorkspaceFaviconUrl();
  res.json(settings);
});

app.patch('/api/settings', auth, adminOnly, (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
  }
  res.json({ ok: true });
});

// ── Registration (public) ──
app.post('/api/auth/register', (req, res) => {
  const regEnabled = db.prepare("SELECT value FROM settings WHERE key='registration_enabled'").get();
  if (!regEnabled || regEnabled.value !== 'true') {
    return res.status(403).json({ error: 'Registration is disabled' });
  }
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const fullName = req.body?.fullName;
  if (!email || !isValidPassword(password)) {
    return res.status(400).json({ error: 'Valid email and password are required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email already exists' });
  const hash = bcrypt.hashSync(password, 10);
  const id = uid();
  db.prepare('INSERT INTO users (id, email, full_name, role, password_hash, created_at) VALUES (?,?,?,?,?,?)')
    .run(id, email, fullName || email, 'user', hash, now());
  res.json({ id, email, fullName: fullName || email, role: 'user' });
});

// ── Documents ──
app.get('/api/documents', auth, (req, res) => {
  cleanupExpiredShares(req.user.id);
  const { trashed, starred, shared, tagId, recent, recentLimit, sortBy } = req.query;
  let sql = 'SELECT * FROM documents WHERE user_id = ?';
  const params = [req.user.id];

  if (trashed !== undefined) {
    sql += ' AND trashed = ?';
    params.push(trashed === 'true' ? 1 : 0);
  } else {
    sql += ' AND trashed = 0';
  }
  if (starred === 'true') { sql += ' AND starred = 1'; }
  if (shared === 'true') { sql += ' AND shared = 1'; }

  const orderBy = sortBy === 'updated' ? 'updated_at' : 'created_at';
  sql += ` ORDER BY ${orderBy} DESC`;
  if (recent === 'true') {
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

  // Attach tags
  const tagStmt = db.prepare(`
    SELECT t.id, t.name, t.color FROM tags t
    JOIN document_tags dt ON dt.tag_id = t.id
    WHERE dt.document_id = ?
  `);
  docs = docs.map(d => {
    const { share_password_hash, ...rest } = d;
    return ({
    ...rest,
    name: normalizeUploadedFilename(rest.name),
    starred: !!d.starred,
    trashed: !!d.trashed,
    shared: !!d.shared,
    share_has_password: !!share_password_hash,
    tag_ids: [],
    tags: tagStmt.all(d.id),
  });
  });

  if (tagId) {
    docs = docs.filter(d => d.tags.some(t => t.id === tagId));
  }

  res.json(docs);
});

app.post('/api/documents/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const id = uid();
  const ext = extFromMime(req.file.mimetype);
  const userDir = path.join(UPLOADS_DIR, req.user.id);
  fs.mkdirSync(userDir, { recursive: true });
  const storagePath = `uploads/${req.user.id}/${id}.${ext}`;
  fs.renameSync(req.file.path, path.join(DATA_DIR, storagePath));

  const doc = {
    id, user_id: req.user.id, name: normalizeUploadedFilename(req.file.originalname),
    file_type: req.file.mimetype || 'application/octet-stream',
    file_size: req.file.size, storage_path: storagePath,
    starred: 0, trashed: 0, trashed_at: null, shared: 0, share_token: null,
    created_at: now(), updated_at: now(),
  };
  db.prepare(`INSERT INTO documents (id, user_id, name, file_type, file_size, storage_path,
    starred, trashed, trashed_at, shared, share_token, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(doc.id, doc.user_id, doc.name, doc.file_type, doc.file_size, doc.storage_path,
      doc.starred, doc.trashed, doc.trashed_at, doc.shared, doc.share_token, doc.created_at, doc.updated_at);
  logDocumentEvent(doc.id, req.user.id, 'uploaded', { name: doc.name });

  res.json({ ...doc, name: normalizeUploadedFilename(doc.name), starred: false, trashed: false, shared: false, tags: [], tag_ids: [] });
});

app.patch('/api/documents/:id/rename', auth, (req, res) => {
  const { name } = req.body;
  const existing = getOwnedDocument(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.name === name) return res.json({ ok: true });
  db.prepare('UPDATE documents SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .run(name, now(), req.params.id, req.user.id);
  logDocumentEvent(req.params.id, req.user.id, 'renamed', { from: existing.name, to: name });
  res.json({ ok: true });
});

app.patch('/api/documents/:id/star', auth, (req, res) => {
  const { starred } = req.body;
  const existing = getOwnedDocument(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const nextStarred = starred ? 1 : 0;
  if (existing.starred === nextStarred) return res.json({ ok: true });
  db.prepare('UPDATE documents SET starred = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .run(nextStarred, now(), req.params.id, req.user.id);
  logDocumentEvent(req.params.id, req.user.id, starred ? 'starred' : 'unstarred');
  res.json({ ok: true });
});

app.patch('/api/documents/:id/trash', auth, (req, res) => {
  const existing = getOwnedDocument(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.trashed) return res.json({ ok: true });
  db.prepare('UPDATE documents SET trashed = 1, trashed_at = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .run(now(), now(), req.params.id, req.user.id);
  logDocumentEvent(req.params.id, req.user.id, 'deleted');
  res.json({ ok: true });
});

app.patch('/api/documents/:id/restore', auth, (req, res) => {
  const existing = getOwnedDocument(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (!existing.trashed) return res.json({ ok: true });
  db.prepare('UPDATE documents SET trashed = 0, trashed_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?')
    .run(now(), req.params.id, req.user.id);
  logDocumentEvent(req.params.id, req.user.id, 'restored');
  res.json({ ok: true });
});

app.delete('/api/documents/:id', auth, (req, res) => {
  const doc = db.prepare('SELECT storage_path FROM documents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  logDocumentEvent(req.params.id, req.user.id, 'permanently_deleted');
  const filePath = path.join(DATA_DIR, doc.storage_path);
  try { fs.unlinkSync(filePath); } catch (_) {}
  try { fs.rmdirSync(path.dirname(filePath)); } catch (_) {}
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.patch('/api/documents/:id/share', auth, (req, res) => {
  const { shared, config } = req.body;
  const existing = getOwnedDocument(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (!shared) {
    if (!existing.shared) return res.json({ ok: true, share_token: null });
    db.prepare('UPDATE documents SET shared = 0, share_token = NULL, share_expires_at = NULL, share_password_hash = NULL, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(now(), req.params.id, req.user.id);
    logDocumentEvent(req.params.id, req.user.id, 'share_disabled');
    return res.json({ ok: true, share_token: null });
  }

  let shareExpiresAt = existing.share_expires_at || null;
  let sharePasswordHash = existing.share_password_hash || null;
  let passwordAction = null;
  let expiryChanged = false;

  if (config && Object.prototype.hasOwnProperty.call(config, 'expiresAt')) {
    if (config.expiresAt) {
      const parsedDate = new Date(config.expiresAt);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Expiration must be a future date/time' });
      }
      shareExpiresAt = parsedDate.toISOString();
    } else {
      shareExpiresAt = null;
    }
    expiryChanged = (existing.share_expires_at || null) !== shareExpiresAt;
  }

  if (config && Object.prototype.hasOwnProperty.call(config, 'password')) {
    if (config.password) {
      if (typeof config.password !== 'string' || config.password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }
      sharePasswordHash = bcrypt.hashSync(config.password, 10);
      passwordAction = existing.share_password_hash ? 'share_password_changed' : 'share_password_added';
    } else if (config.password === '') {
      sharePasswordHash = null;
      if (existing.share_password_hash) passwordAction = 'share_password_removed';
    }
  }

  const shareToken = existing.share_token || uid();
  db.prepare('UPDATE documents SET shared = 1, share_token = ?, share_expires_at = ?, share_password_hash = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .run(shareToken, shareExpiresAt, sharePasswordHash, now(), req.params.id, req.user.id);
  logDocumentEvent(req.params.id, req.user.id, existing.share_token ? 'share_updated' : 'share_enabled', { expiresAt: shareExpiresAt });
  if (expiryChanged) {
    logDocumentEvent(req.params.id, req.user.id, 'share_expiry_changed', {
      from: existing.share_expires_at || null,
      to: shareExpiresAt,
    });
  }
  if (passwordAction) logDocumentEvent(req.params.id, req.user.id, passwordAction);
  res.json({ ok: true, share_token: shareToken });
});

app.get('/api/documents/:id/download', auth, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(DATA_DIR, doc.storage_path);
  const safeName = normalizeUploadedFilename(doc.name);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Content-Type', doc.file_type);
  res.sendFile(filePath);
});

app.get('/api/documents/:id/blob', auth, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(DATA_DIR, doc.storage_path);
  res.setHeader('Content-Type', doc.file_type);
  res.sendFile(filePath);
});

// ── Tags ──
app.get('/api/tags', auth, (req, res) => {
  const tags = db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name').all(req.user.id);
  res.json(tags);
});

app.post('/api/tags', auth, (req, res) => {
  const { name, color } = req.body;
  const id = uid();
  db.prepare('INSERT INTO tags (id, user_id, name, color, created_at) VALUES (?,?,?,?,?)')
    .run(id, req.user.id, name, color, now());
  res.json({ id, user_id: req.user.id, name, color, created_at: now() });
});

app.patch('/api/tags/:id', auth, (req, res) => {
  const { name, color } = req.body;
  db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?')
    .run(name, color, req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/tags/:id', auth, (req, res) => {
  db.prepare('DELETE FROM document_tags WHERE tag_id = ?').run(req.params.id);
  db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.post('/api/documents/:docId/tags/:tagId', auth, (req, res) => {
  const owned = getOwnedDocument(req.params.docId, req.user.id);
  if (!owned) return res.status(404).json({ error: 'Not found' });
  let result;
  try {
    result = db.prepare('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?,?)')
      .run(req.params.docId, req.params.tagId);
  } catch (_) {}
  if (!result || result.changes === 0) return res.json({ ok: true });
  db.prepare('UPDATE documents SET updated_at = ? WHERE id = ? AND user_id = ?').run(now(), req.params.docId, req.user.id);
  const tag = db.prepare('SELECT name FROM tags WHERE id = ? AND user_id = ?').get(req.params.tagId, req.user.id);
  logDocumentEvent(req.params.docId, req.user.id, 'tag_added', { tagName: tag?.name || req.params.tagId });
  res.json({ ok: true });
});

app.delete('/api/documents/:docId/tags/:tagId', auth, (req, res) => {
  const owned = getOwnedDocument(req.params.docId, req.user.id);
  if (!owned) return res.status(404).json({ error: 'Not found' });
  const tag = db.prepare('SELECT name FROM tags WHERE id = ? AND user_id = ?').get(req.params.tagId, req.user.id);
  const result = db.prepare('DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?')
    .run(req.params.docId, req.params.tagId);
  if (result.changes === 0) return res.json({ ok: true });
  db.prepare('UPDATE documents SET updated_at = ? WHERE id = ? AND user_id = ?').run(now(), req.params.docId, req.user.id);
  logDocumentEvent(req.params.docId, req.user.id, 'tag_removed', { tagName: tag?.name || req.params.tagId });
  res.json({ ok: true });
});

// ── Notes ──
app.get('/api/documents/:id/note', auth, (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE document_id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  res.json(note || null);
});

app.put('/api/documents/:id/note', auth, (req, res) => {
  const { content } = req.body;
  const owned = getOwnedDocument(req.params.id, req.user.id);
  if (!owned) return res.status(404).json({ error: 'Not found' });
  const existing = db.prepare('SELECT id FROM notes WHERE document_id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (existing) {
    db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?')
      .run(content, now(), existing.id);
  } else {
    db.prepare('INSERT INTO notes (id, document_id, user_id, content, created_at, updated_at) VALUES (?,?,?,?,?,?)')
      .run(uid(), req.params.id, req.user.id, content, now(), now());
  }
  db.prepare('UPDATE documents SET updated_at = ? WHERE id = ? AND user_id = ?')
    .run(now(), req.params.id, req.user.id);
  logDocumentEvent(req.params.id, req.user.id, existing ? 'comment_edited' : 'comment_added');
  res.json({ ok: true });
});

app.get('/api/documents/:id/history', auth, (req, res) => {
  const startedAt = Date.now();
  try {
    const owned = db.prepare('SELECT id, name, created_at FROM documents WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!owned) {
      return res.status(404).json({ error: 'Not found' });
    }

    const rows = db.prepare(`
      SELECT h.id, h.document_id, h.user_id, h.action, h.details, h.created_at,
             COALESCE(u.full_name, u.email, 'Unknown user') AS actor_name
      FROM document_history h
      LEFT JOIN users u ON u.id = h.user_id
      WHERE h.document_id = ?
      ORDER BY h.created_at DESC
      LIMIT 200
    `).all(req.params.id);

    const mapped = rows.map((r) => {
      let parsedDetails = null;
      if (r.details && r.details.startsWith('{')) {
        try { parsedDetails = JSON.parse(r.details); } catch (_) { parsedDetails = null; }
      }
      return {
        id: r.id,
        document_id: r.document_id,
        user_id: r.user_id,
        action: r.action,
        details: parsedDetails,
        created_at: r.created_at,
        actor_name: r.actor_name,
      };
    });

    // Backfill for legacy docs without persistent upload events, without writing during read path.
    if (mapped.length === 0) {
      mapped.push({
        id: `synthetic-upload-${owned.id}`,
        document_id: owned.id,
        user_id: req.user.id,
        action: 'uploaded',
        details: { name: owned.name },
        created_at: owned.created_at || now(),
        actor_name: req.user.full_name || req.user.email || 'Unknown user',
      });
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed > 200) {
      console.warn('[history] slow-request', { documentId: req.params.id, userId: req.user.id, ms: elapsed });
    }
    return res.json(mapped);
  } catch (error) {
    console.error('[history] failed', {
      documentId: req.params.id,
      userId: req.user?.id,
      message: error?.message,
    });
    return res.status(500).json({ error: 'Failed to load document history' });
  }
});

// ── Shared (no auth) ──
app.get('/api/shared/:token', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE share_token = ? AND shared = 1 AND trashed = 0')
    .get(req.params.token);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (doc.share_expires_at && new Date(doc.share_expires_at).getTime() <= Date.now()) {
    db.prepare('UPDATE documents SET shared = 0, share_token = NULL, share_expires_at = NULL, share_password_hash = NULL, updated_at = ? WHERE id = ?')
      .run(now(), doc.id);
    return res.status(404).json({ error: 'Not found' });
  }
  if (doc.share_password_hash) {
    const suppliedPassword = typeof req.query.password === 'string' ? req.query.password : '';
    if (!suppliedPassword || !bcrypt.compareSync(suppliedPassword, doc.share_password_hash)) {
      return res.status(401).json({ error: 'Password required' });
    }
  }
  const tags = db.prepare(`
    SELECT t.id, t.name, t.color FROM tags t
    JOIN document_tags dt ON dt.tag_id = t.id WHERE dt.document_id = ?
  `).all(doc.id);
  res.json({ ...doc, name: normalizeUploadedFilename(doc.name), starred: !!doc.starred, trashed: false, shared: true, tags });
});

app.get('/api/shared/:token/download', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE share_token = ? AND shared = 1 AND trashed = 0')
    .get(req.params.token);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (doc.share_expires_at && new Date(doc.share_expires_at).getTime() <= Date.now()) {
    db.prepare('UPDATE documents SET shared = 0, share_token = NULL, share_expires_at = NULL, share_password_hash = NULL, updated_at = ? WHERE id = ?')
      .run(now(), doc.id);
    return res.status(404).json({ error: 'Not found' });
  }
  if (doc.share_password_hash) {
    const suppliedPassword = typeof req.query.password === 'string' ? req.query.password : '';
    if (!suppliedPassword || !bcrypt.compareSync(suppliedPassword, doc.share_password_hash)) {
      return res.status(401).json({ error: 'Password required' });
    }
  }
  const filePath = path.join(DATA_DIR, doc.storage_path);
  res.setHeader('Content-Type', doc.file_type);
  res.sendFile(filePath);
});

// ── Static serving (production) ──
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`Docmoc server running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
