// ---------- Types ----------
export type User = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
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
  workspace_logo_url?: string | null;
};

// ---------- Fetch helper ----------
const BASE = '/api';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function mapUser(u: any): User {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name || u.fullName || '',
    role: u.role,
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
};

export async function uploadDocument(_userId: string, file: File): Promise<DocRecord & { tags: TagRecord[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/documents/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Upload failed');
  }
  return res.json();
}

export async function getDocuments(_userId: string, filter?: DocFilter): Promise<(DocRecord & { tags: TagRecord[] })[]> {
  const params = new URLSearchParams();
  if (filter?.trashed !== undefined) params.set('trashed', String(filter.trashed));
  if (filter?.starred) params.set('starred', 'true');
  if (filter?.shared) params.set('shared', 'true');
  if (filter?.tagId) params.set('tagId', filter.tagId);
  if (filter?.recent) params.set('recent', 'true');
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

export async function toggleShare(id: string, shared: boolean): Promise<{ share_token: string | null }> {
  return apiFetch(`/documents/${id}/share`, {
    method: 'PATCH',
    body: JSON.stringify({ shared }),
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

export async function getSharedDocument(token: string): Promise<(DocRecord & { tags: TagRecord[] }) | null> {
  try {
    return await apiFetch(`/shared/${token}`);
  } catch {
    return null;
  }
}

export async function getSharedDocumentBlob(token: string): Promise<Blob | undefined> {
  try {
    const res = await fetch(`${BASE}/shared/${token}/download`, { credentials: 'include' });
    if (!res.ok) return undefined;
    return res.blob();
  } catch {
    return undefined;
  }
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
  if (!res.ok) throw new Error('Logo upload failed');
  const data = await res.json();
  return data.url;
}

export async function removeLogo(_userId: string): Promise<void> {
  await apiFetch('/profile/logo', {
    method: 'DELETE',
  });
}
