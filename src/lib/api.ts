import { load, save, idbGet, idbSet, idbDel } from './store';

// ---------- Types ----------
export type User = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
  password: string;
  accentColor: string | null;
  avatarUrl: string | null;
  workspaceLogoUrl: string | null;
  createdAt: string;
};

export type DocRecord = {
  id: string;
  user_id: string;
  name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  starred: boolean;
  trashed: boolean;
  trashed_at: string | null;
  shared: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  tag_ids: string[];
};

export type TagRecord = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type NoteRecord = {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type AppSettings = {
  registration_enabled: boolean;
};

// ---------- Storage keys ----------
const USERS_KEY = 'docmoc_users';
const DOCS_KEY = 'docmoc_documents';
const TAGS_KEY = 'docmoc_tags';
const NOTES_KEY = 'docmoc_notes';
const SESSION_KEY = 'docmoc_session';
const SETTINGS_KEY = 'docmoc_settings';

// ---------- Seed ----------
function seed() {
  const users = load<User[]>(USERS_KEY, []);
  if (users.length === 0) {
    save(USERS_KEY, [
      {
        id: 'admin-1',
        email: 'admin@docmoc.local',
        fullName: 'Admin',
        role: 'admin' as const,
        password: 'admin',
        accentColor: null,
        avatarUrl: null,
        workspaceLogoUrl: null,
        createdAt: new Date().toISOString(),
      },
    ]);
  }
  if (!localStorage.getItem(SETTINGS_KEY)) {
    save(SETTINGS_KEY, { registration_enabled: true });
  }
}
seed();

// ---------- Helpers ----------
function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

// ---------- Auth ----------
export function login(email: string, password: string): User {
  const users = load<User[]>(USERS_KEY, []);
  const u = users.find((u) => u.email === email && u.password === password);
  if (!u) throw new Error('Invalid email or password');
  save(SESSION_KEY, u.id);
  return u;
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser(): User | null {
  const id = load<string | null>(SESSION_KEY, null);
  if (!id) return null;
  const users = load<User[]>(USERS_KEY, []);
  return users.find((u) => u.id === id) || null;
}

export function updatePassword(userId: string, newPassword: string) {
  const users = load<User[]>(USERS_KEY, []);
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('User not found');
  users[idx].password = newPassword;
  save(USERS_KEY, users);
}

export function createUser(email: string, password: string, fullName: string, role: 'admin' | 'user'): User {
  const users = load<User[]>(USERS_KEY, []);
  if (users.some((u) => u.email === email)) throw new Error('Email already exists');
  const u: User = { id: uid(), email, fullName, role, password, accentColor: null, avatarUrl: null, workspaceLogoUrl: null, createdAt: now() };
  users.push(u);
  save(USERS_KEY, users);
  return u;
}

export function getUsers(): User[] {
  return load<User[]>(USERS_KEY, []);
}

export function updateUserRole(userId: string, role: 'admin' | 'user') {
  const users = load<User[]>(USERS_KEY, []);
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('User not found');
  users[idx].role = role;
  save(USERS_KEY, users);
}

export function updateProfile(userId: string, data: Partial<Pick<User, 'accentColor' | 'workspaceLogoUrl' | 'fullName'>>) {
  const users = load<User[]>(USERS_KEY, []);
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('User not found');
  Object.assign(users[idx], data);
  save(USERS_KEY, users);
  return users[idx];
}

export function getProfile(userId: string): User | null {
  const users = load<User[]>(USERS_KEY, []);
  return users.find((u) => u.id === userId) || null;
}

// ---------- Settings ----------
export function getSettings(): AppSettings {
  return load<AppSettings>(SETTINGS_KEY, { registration_enabled: true });
}

export function updateSettings(s: Partial<AppSettings>) {
  const current = getSettings();
  save(SETTINGS_KEY, { ...current, ...s });
}

// ---------- Documents ----------
function loadDocs(): DocRecord[] { return load<DocRecord[]>(DOCS_KEY, []); }
function saveDocs(d: DocRecord[]) { save(DOCS_KEY, d); }

export async function uploadDocument(userId: string, file: File): Promise<DocRecord> {
  const id = uid();
  const storagePath = `${userId}/${id}`;
  await idbSet(storagePath, file);
  const doc: DocRecord = {
    id,
    user_id: userId,
    name: file.name,
    file_type: file.type || 'application/octet-stream',
    file_size: file.size,
    storage_path: storagePath,
    starred: false,
    trashed: false,
    trashed_at: null,
    shared: false,
    share_token: null,
    created_at: now(),
    updated_at: now(),
    tag_ids: [],
  };
  const docs = loadDocs();
  docs.push(doc);
  saveDocs(docs);
  return doc;
}

export type DocFilter = {
  trashed?: boolean;
  starred?: boolean;
  shared?: boolean;
  tagId?: string;
  recent?: boolean;
};

export function getDocuments(userId: string, filter?: DocFilter): (DocRecord & { tags: TagRecord[] })[] {
  let docs = loadDocs().filter((d) => d.user_id === userId);
  const tags = loadTags(userId);

  if (filter?.trashed !== undefined) docs = docs.filter((d) => d.trashed === filter.trashed);
  else docs = docs.filter((d) => !d.trashed);

  if (filter?.starred) docs = docs.filter((d) => d.starred);
  if (filter?.shared) docs = docs.filter((d) => d.shared);

  docs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  if (filter?.recent) docs = docs.slice(0, 20);

  let result = docs.map((d) => ({
    ...d,
    tags: tags.filter((t) => d.tag_ids.includes(t.id)),
  }));

  if (filter?.tagId) result = result.filter((d) => d.tag_ids.includes(filter.tagId!));
  return result;
}

export function renameDocument(id: string, name: string) {
  const docs = loadDocs();
  const idx = docs.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Not found');
  docs[idx].name = name;
  docs[idx].updated_at = now();
  saveDocs(docs);
}

export function toggleStar(id: string, starred: boolean) {
  const docs = loadDocs();
  const idx = docs.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Not found');
  docs[idx].starred = starred;
  docs[idx].updated_at = now();
  saveDocs(docs);
}

export function trashDocument(id: string) {
  const docs = loadDocs();
  const idx = docs.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Not found');
  docs[idx].trashed = true;
  docs[idx].trashed_at = now();
  docs[idx].updated_at = now();
  saveDocs(docs);
}

export function restoreDocument(id: string) {
  const docs = loadDocs();
  const idx = docs.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Not found');
  docs[idx].trashed = false;
  docs[idx].trashed_at = null;
  docs[idx].updated_at = now();
  saveDocs(docs);
}

export async function permanentDelete(id: string, storagePath: string) {
  const docs = loadDocs();
  saveDocs(docs.filter((d) => d.id !== id));
  await idbDel(storagePath);
  // also remove notes
  const notes = load<NoteRecord[]>(NOTES_KEY, []);
  save(NOTES_KEY, notes.filter((n) => n.document_id !== id));
}

export function toggleShare(id: string, shared: boolean) {
  const docs = loadDocs();
  const idx = docs.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Not found');
  docs[idx].shared = shared;
  docs[idx].share_token = shared ? uid() : null;
  docs[idx].updated_at = now();
  saveDocs(docs);
}

export async function downloadDocument(storagePath: string, fileName: string) {
  const blob = await idbGet<File>(storagePath);
  if (!blob) throw new Error('File not found');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getDocumentBlob(storagePath: string): Promise<Blob | undefined> {
  return idbGet<Blob>(storagePath);
}

export function getSharedDocument(token: string): (DocRecord & { tags: TagRecord[] }) | null {
  const docs = loadDocs();
  const doc = docs.find((d) => d.share_token === token && d.shared && !d.trashed);
  if (!doc) return null;
  const tags = load<TagRecord[]>(TAGS_KEY, []).filter((t) => doc.tag_ids.includes(t.id));
  return { ...doc, tags };
}

// ---------- Tags ----------
function loadTags(userId: string): TagRecord[] {
  return load<TagRecord[]>(TAGS_KEY, []).filter((t) => t.user_id === userId);
}

export function getTags(userId: string): TagRecord[] {
  return loadTags(userId).sort((a, b) => a.name.localeCompare(b.name));
}

export function createTag(userId: string, name: string, color: string): TagRecord {
  const all = load<TagRecord[]>(TAGS_KEY, []);
  const t: TagRecord = { id: uid(), user_id: userId, name, color, created_at: now() };
  all.push(t);
  save(TAGS_KEY, all);
  return t;
}

export function updateTag(id: string, name: string, color: string) {
  const all = load<TagRecord[]>(TAGS_KEY, []);
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error('Not found');
  all[idx].name = name;
  all[idx].color = color;
  save(TAGS_KEY, all);
}

export function deleteTag(id: string) {
  const all = load<TagRecord[]>(TAGS_KEY, []);
  save(TAGS_KEY, all.filter((t) => t.id !== id));
  // remove from docs
  const docs = loadDocs();
  docs.forEach((d) => { d.tag_ids = d.tag_ids.filter((tid) => tid !== id); });
  saveDocs(docs);
}

export function addTagToDocument(documentId: string, tagId: string) {
  const docs = loadDocs();
  const idx = docs.findIndex((d) => d.id === documentId);
  if (idx === -1) throw new Error('Not found');
  if (!docs[idx].tag_ids.includes(tagId)) docs[idx].tag_ids.push(tagId);
  saveDocs(docs);
}

export function removeTagFromDocument(documentId: string, tagId: string) {
  const docs = loadDocs();
  const idx = docs.findIndex((d) => d.id === documentId);
  if (idx === -1) throw new Error('Not found');
  docs[idx].tag_ids = docs[idx].tag_ids.filter((t) => t !== tagId);
  saveDocs(docs);
}

// ---------- Notes ----------
export function getNote(documentId: string, userId: string): NoteRecord | null {
  const notes = load<NoteRecord[]>(NOTES_KEY, []);
  return notes.find((n) => n.document_id === documentId && n.user_id === userId) || null;
}

export function upsertNote(documentId: string, userId: string, content: string) {
  const notes = load<NoteRecord[]>(NOTES_KEY, []);
  const idx = notes.findIndex((n) => n.document_id === documentId && n.user_id === userId);
  if (idx >= 0) {
    notes[idx].content = content;
    notes[idx].updated_at = now();
  } else {
    notes.push({ id: uid(), document_id: documentId, user_id: userId, content, created_at: now(), updated_at: now() });
  }
  save(NOTES_KEY, notes);
}

// ---------- Logo upload (store as data URL) ----------
export async function uploadLogo(userId: string, file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateProfile(userId, { workspaceLogoUrl: dataUrl });
      resolve(dataUrl);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
