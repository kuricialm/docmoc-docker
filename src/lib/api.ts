// ---------- Types ----------
export type User = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
  suspended?: boolean;
  lastSignInAt?: string | null;
  totalUploadedSize?: number;
  accentColor: string | null;
  avatarUrl: string | null;
  workspaceLogoUrl: string | null;
  createdAt: string;
};

export type DocRecord = {
  id: string;
  user_id: string;
  uploaded_by_name?: string;
  name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  starred: boolean;
  trashed: boolean;
  trashed_at: string | null;
  shared: boolean;
  share_token: string | null;
  share_expires_at?: string | null;
  share_has_password?: boolean;
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

export type DocumentHistoryRecord = {
  id: string;
  document_id: string;
  user_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_name: string;
};

export type AppSettings = {
  registration_enabled: boolean;
  workspace_logo_url?: string | null;
  workspace_favicon_url?: string | null;
};

// ---------- Fetch helper ----------
const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL?.trim();
const BASE = RAW_API_BASE
  ? `${RAW_API_BASE.replace(/\/$/, '')}${RAW_API_BASE.endsWith('/api') ? '' : '/api'}`
  : '/api';

async function readJsonBody(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getResponseErrorMessage(res: Response, body: any): string {
  if (body?.error && typeof body.error === 'string') return body.error;
  if (body?.message && typeof body.message === 'string') return body.message;
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return 'API response was not JSON. Verify your frontend is pointing to the Docmoc backend (/api).';
  }
  return `Request failed: ${res.status}`;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
      ...opts,
    });
  } catch {
    throw new Error('Cannot connect to backend. Is the server running?');
  }
  const body = await readJsonBody(res);
  if (!res.ok) {
    throw new Error(getResponseErrorMessage(res, body));
  }
  if (body === null) {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('API response was not JSON. Verify your frontend is pointing to the Docmoc backend (/api).');
    }
    return {} as T;
  }
  return body as T;
}

function mapUser(u: any): User {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name || u.fullName || '',
    role: u.role,
    suspended: !!u.suspended,
    lastSignInAt: u.last_sign_in_at || u.lastSignInAt || null,
    totalUploadedSize: typeof u.total_uploaded_size === 'number' ? u.total_uploaded_size : (typeof u.totalUploadedSize === 'number' ? u.totalUploadedSize : undefined),
    accentColor: u.accent_color || u.accentColor || null,
    avatarUrl: u.avatar_url || u.avatarUrl || null,
    workspaceLogoUrl: u.workspace_logo_url || u.workspaceLogoUrl || null,
    createdAt: u.created_at || u.createdAt || '',
  };
}

// ---------- Auth ----------
export async function login(email: string, password: string, rememberMe = false): Promise<User> {
  const u = await apiFetch<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe }),
  });
  return mapUser(u);
}

export async function signOut(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const u = await apiFetch<any>('/auth/me');
    return mapUser(u);
  } catch {
    return null;
  }
}

export async function updatePassword(_userId: string, newPassword: string): Promise<void> {
  await apiFetch('/profile/password', {
    method: 'PATCH',
    body: JSON.stringify({ newPassword }),
  });
}

export async function updateEmail(_userId: string, email: string): Promise<void> {
  await apiFetch('/profile/email', {
    method: 'PATCH',
    body: JSON.stringify({ email }),
  });
}

export async function createUser(email: string, password: string, fullName: string, role: 'admin' | 'user'): Promise<User> {
  const u = await apiFetch<any>('/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName, role }),
  });
  return mapUser(u);
}

export async function registerUser(email: string, password: string, fullName: string): Promise<User> {
  const u = await apiFetch<any>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName }),
  });
  return mapUser(u);
}

export async function getUsers(): Promise<User[]> {
  const users = await apiFetch<any[]>('/users');
  return users.map(mapUser);
}

export async function updateUserRole(userId: string, role: 'admin' | 'user'): Promise<void> {
  await apiFetch(`/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function updateUser(
  userId: string,
  data: Partial<Pick<User, 'fullName' | 'email' | 'role' | 'suspended'>>
): Promise<void> {
  await apiFetch(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  await apiFetch(`/users/${userId}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword }),
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await apiFetch(`/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function updateProfile(userId: string, data: Partial<Pick<User, 'accentColor' | 'workspaceLogoUrl' | 'fullName'>>): Promise<User> {
  const u = await apiFetch<any>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return mapUser(u);
}

export async function getProfile(_userId: string): Promise<User | null> {
  try {
    const u = await apiFetch<any>('/auth/me');
    return mapUser(u);
  } catch {
    return null;
  }
}

// ---------- Settings ----------
export async function getSettings(): Promise<AppSettings> {
  return apiFetch<AppSettings>('/settings');
}

export async function updateSettings(s: Partial<AppSettings>): Promise<void> {
  await apiFetch('/settings', {
    method: 'PATCH',
    body: JSON.stringify(s),
  });
}

// ---------- Documents ----------
export type DocFilter = {
  trashed?: boolean;
  starred?: boolean;
  shared?: boolean;
  tagId?: string;
  recent?: boolean;
  recentLimit?: number;
  sortBy?: 'updated' | 'created';
};

export async function uploadDocument(_userId: string, file: File): Promise<DocRecord & { tags: TagRecord[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/documents/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  const body = await readJsonBody(res);
  if (!res.ok) {
    throw new Error(getResponseErrorMessage(res, body) || 'Upload failed');
  }
  if (!body) throw new Error('Upload failed: empty response from API');
  return body as DocRecord & { tags: TagRecord[] };
}

export async function getDocuments(_userId: string, filter?: DocFilter): Promise<(DocRecord & { tags: TagRecord[] })[]> {
  const params = new URLSearchParams();
  if (filter?.trashed !== undefined) params.set('trashed', String(filter.trashed));
  if (filter?.starred) params.set('starred', 'true');
  if (filter?.shared) params.set('shared', 'true');
  if (filter?.tagId) params.set('tagId', filter.tagId);
  if (filter?.recent) params.set('recent', 'true');
  if (filter?.recentLimit !== undefined) params.set('recentLimit', String(filter.recentLimit));
  if (filter?.sortBy) params.set('sortBy', filter.sortBy);
  return apiFetch(`/documents?${params.toString()}`);
}

export async function renameDocument(id: string, name: string): Promise<void> {
  await apiFetch(`/documents/${id}/rename`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function toggleStar(id: string, starred: boolean): Promise<void> {
  await apiFetch(`/documents/${id}/star`, {
    method: 'PATCH',
    body: JSON.stringify({ starred }),
  });
}

export async function trashDocument(id: string): Promise<void> {
  await apiFetch(`/documents/${id}/trash`, { method: 'PATCH' });
}

export async function restoreDocument(id: string): Promise<void> {
  await apiFetch(`/documents/${id}/restore`, { method: 'PATCH' });
}

export async function permanentDelete(id: string, _storagePath: string): Promise<void> {
  await apiFetch(`/documents/${id}`, { method: 'DELETE' });
}

export type ShareConfig = {
  expiresAt?: string;
  password?: string;
};

export async function toggleShare(
  id: string,
  shared: boolean,
  config?: ShareConfig,
): Promise<{ share_token: string | null }> {
  return apiFetch(`/documents/${id}/share`, {
    method: 'PATCH',
    body: JSON.stringify({ shared, config }),
  });
}

export async function downloadDocument(docId: string, fileName: string): Promise<void> {
  const res = await fetch(`${BASE}/documents/${docId}/download`, { credentials: 'include' });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getDocumentBlob(docId: string): Promise<Blob | undefined> {
  try {
    const res = await fetch(`${BASE}/documents/${docId}/blob`, { credentials: 'include' });
    if (!res.ok) return undefined;
    return res.blob();
  } catch {
    return undefined;
  }
}

export async function getSharedDocument(token: string, password?: string): Promise<(DocRecord & { tags: TagRecord[] }) | null> {
  const suffix = password ? `?password=${encodeURIComponent(password)}` : '';
  let res: Response;
  try {
    res = await fetch(`${BASE}/shared/${token}${suffix}`, { credentials: 'include' });
  } catch {
    throw new Error('Cannot connect to backend. Is the server running?');
  }
  if (res.status === 401) throw new Error('PASSWORD_REQUIRED');
  if (!res.ok) return null;
  const body = await readJsonBody(res);
  return body as (DocRecord & { tags: TagRecord[] }) | null;
}

export async function getSharedDocumentBlob(token: string, password?: string): Promise<Blob | undefined> {
  try {
    const suffix = password ? `?password=${encodeURIComponent(password)}` : '';
    const res = await fetch(`${BASE}/shared/${token}/download${suffix}`, { credentials: 'include' });
    if (!res.ok) return undefined;
    return res.blob();
  } catch {
    return undefined;
  }
}

export async function getDocumentHistory(documentId: string): Promise<DocumentHistoryRecord[]> {
  const rows = await apiFetch<DocumentHistoryRecord[]>(`/documents/${documentId}/history`);
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---------- Tags ----------
export async function getTags(userId: string): Promise<TagRecord[]> {
  return apiFetch('/tags');
}

export async function createTag(_userId: string, name: string, color: string): Promise<TagRecord> {
  return apiFetch('/tags', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  });
}

export async function updateTag(id: string, name: string, color: string): Promise<void> {
  await apiFetch(`/tags/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, color }),
  });
}

export async function deleteTag(id: string): Promise<void> {
  await apiFetch(`/tags/${id}`, { method: 'DELETE' });
}

export async function addTagToDocument(documentId: string, tagId: string): Promise<void> {
  await apiFetch(`/documents/${documentId}/tags/${tagId}`, { method: 'POST' });
}

export async function removeTagFromDocument(documentId: string, tagId: string): Promise<void> {
  await apiFetch(`/documents/${documentId}/tags/${tagId}`, { method: 'DELETE' });
}

// ---------- Notes ----------
export async function getNote(documentId: string, _userId: string): Promise<NoteRecord | null> {
  return apiFetch(`/documents/${documentId}/note`);
}

export async function upsertNote(documentId: string, _userId: string, content: string): Promise<void> {
  await apiFetch(`/documents/${documentId}/note`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

// ---------- Logo upload ----------
export async function uploadLogo(_userId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/profile/logo`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  const data = await readJsonBody(res);
  if (!res.ok) throw new Error(getResponseErrorMessage(res, data) || 'Logo upload failed');
  if (!data?.url) throw new Error('Logo upload failed: empty response from API');
  return data.url;
}

export async function removeLogo(_userId: string): Promise<void> {
  await apiFetch('/profile/logo', {
    method: 'DELETE',
  });
}

export async function uploadFavicon(_userId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/profile/favicon`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  const data = await readJsonBody(res);
  if (!res.ok) throw new Error(getResponseErrorMessage(res, data) || 'Favicon upload failed');
  if (!data?.url) throw new Error('Favicon upload failed: empty response from API');
  return data.url;
}

export async function removeFavicon(_userId: string): Promise<void> {
  await apiFetch('/profile/favicon', {
    method: 'DELETE',
  });
}
