// @vitest-environment node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('./createApp.cjs');
const { createContext } = require('../bootstrap/createContext.cjs');

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docmoc-app-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { force: true, recursive: true });
  }
});

describe('createApp', () => {
  it('wires routes with the refactored services context', async () => {
    const dataDir = makeTempDir();
    const context = createContext({
      ADMIN_EMAIL: 'admin@docmoc.local',
      ADMIN_PASSWORD: 'admin',
      COOKIE_SECRET: 'test-secret',
      DATA_DIR: dataDir,
      HOME: dataDir,
      PORT: '0',
    });
    const app = createApp(context);
    const server = app.listen(0);
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const settingsResponse = await fetch(`${baseUrl}/api/settings`);
      expect(settingsResponse.status).toBe(200);
      await expect(settingsResponse.json()).resolves.toMatchObject({
        registration_enabled: true,
        workspace_favicon_url: null,
        workspace_logo_url: null,
      });

      const documentsResponse = await fetch(`${baseUrl}/api/documents`);
      expect(documentsResponse.status).toBe(401);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      context.db.close();
    }
  });
});
