// @vitest-environment node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('./createApp.cjs');
const { createContext } = require('../bootstrap/createContext.cjs');

const tempDirs = [];

function makeTempDir(prefix = 'docmoc-security-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function startTestServer() {
  const dataDir = makeTempDir();
  const context = createContext({
    ADMIN_EMAIL: 'admin@docmoc.local',
    ADMIN_PASSWORD: 'password123',
    AI_SECRETS_MASTER_KEY: 'test-ai-secret',
    COOKIE_SECRET: 'test-cookie-secret',
    DATA_DIR: dataDir,
    HOME: dataDir,
    PORT: '0',
  });
  const app = createApp(context);
  const server = app.listen(0);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function close() {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    context.db.close();
  }

  return {
    baseUrl,
    close,
    context,
    dataDir,
  };
}

async function signIn(baseUrl, password = 'password123') {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@docmoc.local',
      password,
    }),
  });

  return {
    cookie: response.headers.get('set-cookie')?.split(';')[0] || '',
    response,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { force: true, recursive: true });
  }
});

describe('app security behavior', () => {
  it('rejects authenticated mutating requests without a trusted origin', async () => {
    const runtime = await startTestServer();

    try {
      const signedIn = await signIn(runtime.baseUrl);
      expect(signedIn.response.status).toBe(200);

      const blockedResponse = await fetch(`${runtime.baseUrl}/api/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: signedIn.cookie,
        },
        body: JSON.stringify({ fullName: 'Blocked Update' }),
      });

      expect(blockedResponse.status).toBe(403);
      await expect(blockedResponse.json()).resolves.toMatchObject({
        error: 'Cross-origin requests are not allowed',
      });

      const allowedResponse = await fetch(`${runtime.baseUrl}/api/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: signedIn.cookie,
          Origin: runtime.baseUrl,
        },
        body: JSON.stringify({ fullName: 'Allowed Update' }),
      });

      expect(allowedResponse.status).toBe(200);
      await expect(allowedResponse.json()).resolves.toMatchObject({
        full_name: 'Allowed Update',
      });
    } finally {
      await runtime.close();
    }
  });

  it('rate limits repeated login failures', async () => {
    const runtime = await startTestServer();

    try {
      const statuses = [];
      for (let attempt = 0; attempt < 11; attempt += 1) {
        const response = await signIn(runtime.baseUrl, 'wrong-password');
        statuses.push(response.response.status);
      }

      expect(statuses.slice(0, 10)).toEqual(new Array(10).fill(401));
      expect(statuses[10]).toBe(429);
    } finally {
      await runtime.close();
    }
  }, 15000);

  it('uses POST unlock/blob for password-protected shares', async () => {
    const runtime = await startTestServer();

    try {
      const owner = runtime.context.repositories.users.getByEmail('admin@docmoc.local');
      const docId = 'doc-protected-share';
      const storagePath = `uploads/${owner.id}/${docId}.txt`;
      const absolutePath = path.join(runtime.dataDir, storagePath);

      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, 'secret shared document');

      runtime.context.repositories.documents.createDocument({
        created_at: '2026-04-19T00:00:00.000Z',
        file_size: 22,
        file_type: 'text/plain',
        id: docId,
        name: 'secret.txt',
        share_token: null,
        shared: 0,
        starred: 0,
        storage_path: storagePath,
        trashed: 0,
        trashed_at: null,
        updated_at: '2026-04-19T00:00:00.000Z',
        uploaded_by_name_snapshot: 'Admin',
        user_id: owner.id,
      });

      const { share_token: shareToken } = runtime.context.services.shared.updateShare(docId, owner.id, true, {
        password: 'password123',
      });

      const blockedMetadata = await fetch(`${runtime.baseUrl}/api/shared/${shareToken}`);
      expect(blockedMetadata.status).toBe(401);

      const blockedDownload = await fetch(`${runtime.baseUrl}/api/shared/${shareToken}/download`);
      expect(blockedDownload.status).toBe(401);

      const wrongPassword = await fetch(`${runtime.baseUrl}/api/shared/${shareToken}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password' }),
      });
      expect(wrongPassword.status).toBe(401);

      const unlocked = await fetch(`${runtime.baseUrl}/api/shared/${shareToken}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'password123' }),
      });
      expect(unlocked.status).toBe(200);
      await expect(unlocked.json()).resolves.toMatchObject({
        name: 'secret.txt',
      });

      const blobResponse = await fetch(`${runtime.baseUrl}/api/shared/${shareToken}/blob`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'password123' }),
      });
      expect(blobResponse.status).toBe(200);
      await expect(blobResponse.text()).resolves.toBe('secret shared document');
    } finally {
      await runtime.close();
    }
  });

  it('rejects unsupported SVG uploads on the server', async () => {
    const runtime = await startTestServer();

    try {
      const signedIn = await signIn(runtime.baseUrl);
      expect(signedIn.response.status).toBe(200);

      const formData = new FormData();
      formData.append('file', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: 'image/svg+xml' }), 'unsafe.svg');

      const response = await fetch(`${runtime.baseUrl}/api/documents/upload`, {
        method: 'POST',
        headers: {
          Cookie: signedIn.cookie,
          Origin: runtime.baseUrl,
        },
        body: formData,
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: 'Unsupported document file type',
      });
    } finally {
      await runtime.close();
    }
  });
});
