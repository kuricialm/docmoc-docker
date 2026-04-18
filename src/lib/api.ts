// ---------- Types ----------
export type User = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
  suspended?: boolean;
  lastSignInAt?: string | null;
  totalUploadedSize?: number;
  uploadQuotaBytes?: number | null;
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
  trash_retention_days: number;
  workspace_logo_url?: string | null;
  workspace_favicon_url?: string | null;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  registration_enabled: true,
  trash_retention_days: 30,
  workspace_logo_url: null,
  workspace_favicon_url: null,
};

export type OpenRouterModelOption = {
  id: string;
  name: string;
  description: string;
  context_length: number;
  input_modalities: string[];
  output_modalities: string[];
  prompt_price: number | null;
  completion_price: number | null;
  request_price: number | null;
  image_price: number | null;
  max_completion_tokens: number;
};

export type OpenRouterSettings = {
  provider: 'openrouter';
  configured: boolean;
  credential: {
    key_label: string | null;
    last4: string | null;
    masked_key: string | null;
    validated_at: string | null;
    expires_at: string | null;
    status: string;
    last_error: string | null;
    last_model_sync_at: string | null;
  } | null;
  preferences: {
    text_model_id: string | null;
    vision_model_id: string | null;
    summary_prompt: string;
    summary_prompt_default: string;
    text_model_valid: boolean;
    vision_model_valid: boolean;
  };
  models: {
    text: OpenRouterModelOption[];
    vision: OpenRouterModelOption[];
    fetched_at: string | null;
  };
  summary_backfill?: {
    missing_count: number;
    regeneratable_count?: number;
    queue_size: number;
    auto_generate_on_upload: boolean;
    batches?: {
      missing: {
        active: boolean;
        total: number;
        completed: number;
        failed: number;
        pending: number;
        progress_percent: number;
        started_at: string | null;
        finished_at: string | null;
      } | null;
      regenerate: {
        active: boolean;
        total: number;
        completed: number;
        failed: number;
        pending: number;
        progress_percent: number;
        started_at: string | null;
        finished_at: string | null;
      } | null;
    };
  };
};

export type DocumentSummaryState = {
  provider: string;
  format: 'brief';
  mode: 'text' | 'vision' | 'unsupported';
  state: 'no_key' | 'key_invalid' | 'model_missing' | 'missing' | 'pending' | 'ready' | 'failed' | 'unsupported';
  can_generate: boolean;
  message: string | null;
  coverage: 'full' | 'truncated' | null;
  model: string | null;
  generated_at: string | null;
  summary: string | null;
  openRouter: OpenRouterSettings;
};

// ---------- Fetch helper ----------
const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL?.trim();
const BASE = RAW_API_BASE
  ? `${RAW_API_BASE.replace(/\/$/, '')}${RAW_API_BASE.endsWith('/api') ? '' : '/api'}`
  : '/api';

type JsonRecord = Record<string, unknown>;
type DocumentWithTags = DocRecord & { tags: TagRecord[] };
type UploadedDocument = DocumentWithTags & { summary_auto_started?: boolean };
type SessionResponse = {
  user: ApiUser | null;
};

type ApiUser = {
  id: string;
  email: string;
  role: 'admin' | 'user';
  full_name?: string | null;
  fullName?: string | null;
  suspended?: boolean | null;
  last_sign_in_at?: string | null;
  lastSignInAt?: string | null;
  total_uploaded_size?: number;
  totalUploadedSize?: number;
  upload_quota_bytes?: number | null;
  uploadQuotaBytes?: number | null;
  accent_color?: string | null;
  accentColor?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  workspace_logo_url?: string | null;
  workspaceLogoUrl?: string | null;
  created_at?: string;
  createdAt?: string;
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const readStringField = (body: unknown, key: string): string | undefined => {
  if (!isRecord(body)) return undefined;
  const value = body[key];
  return typeof value === 'string' ? value : undefined;
};

async function readJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getResponseErrorMessage(res: Response, body: unknown): string {
  const errorMessage = readStringField(body, 'error');
  if (errorMessage) return errorMessage;

  const message = readStringField(body, 'message');
  if (message) return message;

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

async function blobFetch(path: string, opts?: RequestInit): Promise<Blob | undefined> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      ...opts,
    });
  } catch {
    return undefined;
  }

  if (res.status === 401) {
    throw new Error('PASSWORD_REQUIRED');
  }

  if (!res.ok) {
    return undefined;
  }

  return res.blob();
}

function mapUser(u: ApiUser): User {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name || u.fullName || '',
    role: u.role,
    suspended: !!u.suspended,
    lastSignInAt: u.last_sign_in_at || u.lastSignInAt || null,
    totalUploadedSize: typeof u.total_uploaded_size === 'number' ? u.total_uploaded_size : (typeof u.totalUploadedSize === 'number' ? u.totalUploadedSize : undefined),
    uploadQuotaBytes: typeof u.upload_quota_bytes === 'number' ? u.upload_quota_bytes : (typeof u.uploadQuotaBytes === 'number' ? u.uploadQuotaBytes : null),
    accentColor: u.accent_color || u.accentColor || null,
    avatarUrl: u.avatar_url || u.avatarUrl || null,
    workspaceLogoUrl: u.workspace_logo_url || u.workspaceLogoUrl || null,
    createdAt: u.created_at || u.createdAt || '',
  };
}

// ---------- Auth ----------
export async function login(email: string, password: string, rememberMe = false): Promise<User> {
  const u = await apiFetch<ApiUser>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe }),
  });
  return mapUser(u);
}

export async function signOut(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await apiFetch<SessionResponse>('/auth/session');
  return session.user ? mapUser(session.user) : null;
}

export async function updatePassword(newPassword: string): Promise<void> {
  await apiFetch('/profile/password', {
    method: 'PATCH',
    body: JSON.stringify({ newPassword }),
  });
}

export async function updateEmail(email: string): Promise<void> {
  await apiFetch('/profile/email', {
    method: 'PATCH',
    body: JSON.stringify({ email }),
  });
}

export async function createUser(email: string, password: string, fullName: string, role: 'admin' | 'user'): Promise<User> {
  const u = await apiFetch<ApiUser>('/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName, role }),
  });
  return mapUser(u);
}

export async function registerUser(email: string, password: string, fullName: string): Promise<User> {
  const u = await apiFetch<ApiUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName }),
  });
  return mapUser(u);
}

export async function getUsers(): Promise<User[]> {
  const users = await apiFetch<ApiUser[]>('/users');
  return users.map(mapUser);
}

export async function updateUser(
  userId: string,
  data: Partial<Pick<User, 'fullName' | 'email' | 'role' | 'suspended' | 'uploadQuotaBytes'>>
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

export async function updateProfile(data: Partial<Pick<User, 'accentColor' | 'workspaceLogoUrl' | 'fullName'>>): Promise<User> {
  const u = await apiFetch<ApiUser>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return mapUser(u);
}

export async function getProfile(): Promise<User | null> {
  return getCurrentUser();
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

// ---------- AI / OpenRouter ----------
export async function getOpenRouterSettings(): Promise<OpenRouterSettings> {
  return apiFetch('/profile/ai/openrouter');
}

export async function saveOpenRouterKey(apiKey: string): Promise<OpenRouterSettings> {
  return apiFetch('/profile/ai/openrouter-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export async function removeOpenRouterKey(): Promise<void> {
  await apiFetch('/profile/ai/openrouter-key', {
    method: 'DELETE',
  });
}

export async function saveOpenRouterPreferences(data: {
  textModelId?: string | null;
  visionModelId?: string | null;
  summaryPrompt?: string | null;
}): Promise<OpenRouterSettings> {
  return apiFetch('/profile/ai/openrouter/preferences', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function refreshOpenRouterModels(): Promise<OpenRouterSettings> {
  return apiFetch('/profile/ai/openrouter/models/refresh', {
    method: 'POST',
  });
}

export async function queueMissingOpenRouterSummaries(): Promise<{
  queued: number;
  settings: OpenRouterSettings;
}> {
  return apiFetch('/profile/ai/openrouter/backfill', {
    method: 'POST',
  });
}

export async function regenerateAllOpenRouterSummaries(): Promise<{
  queued: number;
  settings: OpenRouterSettings;
}> {
  return apiFetch('/profile/ai/openrouter/regenerate-all', {
    method: 'POST',
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

function buildDocumentQuery(filter?: DocFilter): string {
  const params = new URLSearchParams();
  if (filter?.trashed !== undefined) params.set('trashed', String(filter.trashed));
  if (filter?.starred) params.set('starred', 'true');
  if (filter?.shared) params.set('shared', 'true');
  if (filter?.tagId) params.set('tagId', filter.tagId);
  if (filter?.recent) params.set('recent', 'true');
  if (filter?.recentLimit !== undefined) params.set('recentLimit', String(filter.recentLimit));
  if (filter?.sortBy) params.set('sortBy', filter.sortBy);
  return params.toString();
}

async function uploadFile(path: string, file: File, fallbackErrorMessage: string): Promise<unknown> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const body = await readJsonBody(res);
  if (!res.ok) {
    throw new Error(getResponseErrorMessage(res, body) || fallbackErrorMessage);
  }

  return body;
}

export async function uploadDocument(file: File): Promise<UploadedDocument> {
  const body = await uploadFile('/documents/upload', file, 'Upload failed');
  if (!body) throw new Error('Upload failed: empty response from API');
  return body as UploadedDocument;
}

export async function getDocuments(filter?: DocFilter): Promise<DocumentWithTags[]> {
  const query = buildDocumentQuery(filter);
  return apiFetch(`/documents${query ? `?${query}` : ''}`);
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
  return blobFetch(`/documents/${docId}/blob`);
}

export async function getSharedDocument(token: string): Promise<DocumentWithTags | null> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/shared/${token}`, { credentials: 'include' });
  } catch {
    throw new Error('Cannot connect to backend. Is the server running?');
  }
  if (res.status === 401) throw new Error('PASSWORD_REQUIRED');
  if (!res.ok) return null;
  const body = await readJsonBody(res);
  return body as DocumentWithTags | null;
}

export async function unlockSharedDocument(token: string, password: string): Promise<DocumentWithTags | null> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/shared/${token}/unlock`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new Error('Cannot connect to backend. Is the server running?');
  }

  if (res.status === 401) throw new Error('PASSWORD_REQUIRED');
  if (!res.ok) return null;
  const body = await readJsonBody(res);
  return body as DocumentWithTags | null;
}

export async function getSharedDocumentBlob(token: string, password?: string): Promise<Blob | undefined> {
  return blobFetch(`/shared/${token}/blob`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(password ? { password } : {}),
  });
}

export async function getDocumentHistory(documentId: string): Promise<DocumentHistoryRecord[]> {
  const rows = await apiFetch<DocumentHistoryRecord[]>(`/documents/${documentId}/history`);
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getDocumentSummary(documentId: string): Promise<DocumentSummaryState> {
  return apiFetch(`/documents/${documentId}/summary`);
}

export async function generateDocumentSummary(documentId: string, force = false): Promise<DocumentSummaryState> {
  return apiFetch(`/documents/${documentId}/summary`, {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
}

// ---------- Tags ----------
export async function getTags(): Promise<TagRecord[]> {
  return apiFetch('/tags');
}

export async function createTag(name: string, color: string): Promise<TagRecord> {
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
export async function getNote(documentId: string): Promise<NoteRecord | null> {
  return apiFetch(`/documents/${documentId}/note`);
}

export async function upsertNote(documentId: string, content: string): Promise<void> {
  await apiFetch(`/documents/${documentId}/note`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

// ---------- Logo upload ----------
export async function uploadLogo(file: File): Promise<string> {
  const data = await uploadFile('/profile/logo', file, 'Logo upload failed');
  if (!isRecord(data) || typeof data.url !== 'string' || !data.url) throw new Error('Logo upload failed: empty response from API');
  return data.url;
}

export async function removeLogo(): Promise<void> {
  await apiFetch('/profile/logo', {
    method: 'DELETE',
  });
}

export async function uploadFavicon(file: File): Promise<string> {
  const data = await uploadFile('/profile/favicon', file, 'Favicon upload failed');
  if (!isRecord(data) || typeof data.url !== 'string' || !data.url) throw new Error('Favicon upload failed: empty response from API');
  return data.url;
}

export async function removeFavicon(): Promise<void> {
  await apiFetch('/profile/favicon', {
    method: 'DELETE',
  });
}
