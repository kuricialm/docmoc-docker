const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const APP_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'codex.admin.validation@docmoc.local';
const ADMIN_PASSWORD = 'CodexAdmin123!';
const SOURCE_PDF_PATH = path.resolve(__dirname, '../../data/uploads/codex-validation-user/codex-validation.pdf');
const OUTPUT_SCREENSHOT = path.resolve(__dirname, 'docmoc-validation-final.png');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitFor(fn, description, timeout = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (await fn()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for ${description}`);
}

function createValidationFiles() {
  const uniqueId = `codex-validation-${Date.now()}`;
  const tempTextPath = path.join(os.tmpdir(), `${uniqueId}.txt`);
  const tempPdfPath = path.join(os.tmpdir(), `${uniqueId}.pdf`);
  const unsupportedPath = path.join(os.tmpdir(), `${uniqueId}.bin`);

  fs.writeFileSync(tempTextPath, 'Codex validation note\nThis file is used to validate text preview, notes, tags, sharing, and trash/restore flows.\n');
  fs.copyFileSync(SOURCE_PDF_PATH, tempPdfPath);
  fs.writeFileSync(unsupportedPath, Buffer.from([0xde, 0xad, 0xbe, 0xef]));

  return {
    textFileName: path.basename(tempTextPath),
    textFilePath: tempTextPath,
    pdfFileName: path.basename(tempPdfPath),
    pdfFilePath: tempPdfPath,
    unsupportedPath,
    uniqueId,
  };
}

async function clearAndType(locator, value) {
  await locator.click();
  await locator.fill('');
  await locator.fill(value);
}

async function setSearch(page, value) {
  const searchInput = page.getByPlaceholder(/Search/);
  await clearAndType(searchInput, value);
}

async function openDocument(page, name) {
  await waitFor(async () => await page.getByText(name, { exact: true }).first().isVisible(), `"${name}" document card`);
  await page.getByText(name, { exact: true }).first().click();

  const dialog = page.getByRole('dialog').first();
  await waitFor(async () => await dialog.isVisible(), 'document viewer dialog');
  return dialog;
}

async function closeDialog(dialog) {
  await dialog.getByRole('button', { name: 'Close' }).click();
  await waitFor(async () => !(await dialog.isVisible()), 'dialog close');
}

async function loginThroughUi(page) {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await waitFor(async () => await page.getByRole('button', { name: 'Sign In' }).isVisible(), 'login form');

  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await waitFor(async () => await page.getByPlaceholder(/Search/).isVisible(), 'main application shell after login');
}

async function toggleTheme(page) {
  await page.evaluate(() => {
    const root = document.documentElement;
    const frames = [
      {
        className: root.className,
        datasetTheme: root.dataset.theme || null,
      },
    ];

    const observer = new MutationObserver(() => {
      frames.push({
        className: root.className,
        datasetTheme: root.dataset.theme || null,
      });
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    window.__themeFrames = frames;
    window.__themeObserver = observer;
  });

  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await waitFor(
    async () => (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark',
    'dark theme after toggle',
  );

  return await page.evaluate(() => {
    window.__themeObserver?.disconnect();
    return window.__themeFrames || [];
  });
}

async function uploadFiles(page, filePaths) {
  await page.locator('input[type="file"]').first().setInputFiles(filePaths);
}

async function createTag(page, tagName) {
  await page.getByTitle('Manage Tags').click();
  const tagDialog = page.getByRole('dialog').filter({ hasText: 'Manage Tags' });
  await waitFor(async () => await tagDialog.isVisible(), 'tag manager dialog');

  const newTagInput = tagDialog.getByPlaceholder('New tag name...');
  await newTagInput.fill(tagName);
  await newTagInput.press('Enter');
  await waitFor(async () => await tagDialog.getByText(tagName, { exact: true }).isVisible(), `tag "${tagName}"`);

  await tagDialog.getByRole('button', { name: 'Close' }).click();
  await waitFor(async () => !(await tagDialog.isVisible()), 'tag manager close');
}

async function main() {
  const validationFiles = createValidationFiles();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const unauthorizedResponses = [];
  let latestShareToken = null;

  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP_URL });

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('response', async (response) => {
    if (response.status() === 401) {
      unauthorizedResponses.push(response.url());
    }

    if (!response.url().includes('/api/documents/') || !response.url().includes('/share') || response.request().method() !== 'PATCH') {
      return;
    }

    try {
      const body = await response.json();
      if (body && typeof body.share_token === 'string' && body.share_token) {
        latestShareToken = body.share_token;
      }
    } catch {
      // Ignore non-JSON responses here.
    }
  });

  await loginThroughUi(page);

  const themeFrames = await toggleTheme(page);
  const themeFramesAfterToggle = themeFrames.slice(1);
  assert(themeFramesAfterToggle.length > 0, 'Theme toggle produced no observed mutations');
  assert(
    themeFramesAfterToggle.every((frame) => frame.datasetTheme === 'dark' && frame.className.includes('dark')),
    `Theme toggle passed through an unexpected non-dark state: ${JSON.stringify(themeFrames)}`,
  );

  await uploadFiles(page, [validationFiles.textFilePath, validationFiles.pdfFilePath]);
  await waitFor(async () => await page.getByText(validationFiles.textFileName, { exact: true }).isVisible(), `uploaded text file ${validationFiles.textFileName}`);
  await waitFor(async () => await page.getByText(validationFiles.pdfFileName, { exact: true }).isVisible(), `uploaded pdf file ${validationFiles.pdfFileName}`);

  await uploadFiles(page, [validationFiles.unsupportedPath]);
  await waitFor(
    async () => await page.getByText('1 file was skipped (unsupported format).').isVisible(),
    'unsupported upload error toast',
  );

  await setSearch(page, validationFiles.textFileName);
  const textDialog = await openDocument(page, validationFiles.textFileName);
  await waitFor(async () => await textDialog.getByText('Codex validation note').isVisible(), 'text preview content');

  await textDialog.getByRole('button', { name: 'Share link' }).click();
  const shareDialog = page.getByRole('dialog').filter({ hasText: /Share this document|Edit share settings/ });
  await waitFor(async () => await shareDialog.isVisible(), 'share dialog');
  await shareDialog.getByRole('button', { name: 'Generate link' }).click();
  await waitFor(async () => !(await shareDialog.isVisible()), 'share dialog close after generation');
  await waitFor(async () => latestShareToken !== null, 'share token capture');
  const shareUrl = `${APP_URL}/shared/${latestShareToken}`;

  const tagName = `${validationFiles.uniqueId}-tag`;
  await closeDialog(textDialog);
  await createTag(page, tagName);

  const taggedTextDialog = await openDocument(page, validationFiles.textFileName);
  await taggedTextDialog.locator('button[class*="border-dashed"]').click();
  await page.getByRole('button', { name: tagName, exact: true }).click();
  await waitFor(async () => await taggedTextDialog.getByText(tagName, { exact: true }).isVisible(), 'tag applied in document viewer');

  await taggedTextDialog.getByRole('tab', { name: 'Notes' }).click();
  const noteText = `${validationFiles.uniqueId} note`;
  await taggedTextDialog.getByPlaceholder('Add private notes about this document...').fill(noteText);
  await taggedTextDialog.getByRole('button', { name: 'Save Note' }).click();
  await waitFor(async () => await page.getByText('Note saved').isVisible(), 'note saved toast');

  await taggedTextDialog.getByRole('tab', { name: 'History' }).click();
  await waitFor(async () => await taggedTextDialog.getByText(/Added comment|Edited comment/).isVisible(), 'history entry for note update');

  const starButtonName = await taggedTextDialog.getByRole('button', { name: /Star document|Unstar document/ }).getAttribute('aria-label');
  assert(Boolean(starButtonName), 'Star button label not found');
  await taggedTextDialog.getByRole('button', { name: starButtonName }).click();
  await closeDialog(taggedTextDialog);

  await page.getByRole('link', { name: 'Starred', exact: true }).click();
  await waitFor(async () => await page.getByText(validationFiles.textFileName, { exact: true }).isVisible(), 'document on starred page');

  await page.getByRole('link', { name: 'Shared by Me', exact: true }).click();
  await waitFor(async () => await page.getByText(validationFiles.textFileName, { exact: true }).isVisible(), 'document on shared page');

  const sharedPage = await context.newPage();
  const sharedPageErrors = [];
  const sharedConsoleErrors = [];
  const sharedUnauthorizedResponses = [];
  sharedPage.on('pageerror', (error) => sharedPageErrors.push(error.message));
  sharedPage.on('console', (message) => {
    if (message.type() === 'error') {
      sharedConsoleErrors.push(message.text());
    }
  });
  sharedPage.on('response', (response) => {
    if (response.status() === 401) {
      sharedUnauthorizedResponses.push(response.url());
    }
  });
  await sharedPage.goto(shareUrl, { waitUntil: 'networkidle' });
  await waitFor(async () => await sharedPage.getByText(validationFiles.textFileName, { exact: true }).isVisible(), 'shared document title');
  await waitFor(async () => await sharedPage.getByText('Codex validation note').isVisible(), 'shared document preview');
  await sharedPage.close();

  await page.getByRole('button', { name: /Disable Sharing|Disable/ }).click();
  await waitFor(async () => !(await page.getByText(validationFiles.textFileName, { exact: true }).isVisible()), 'shared document removed from shared page');

  await page.getByRole('link', { name: 'All Documents', exact: true }).click();
  await setSearch(page, validationFiles.textFileName);
  const textCard = page.locator('.group').filter({ hasText: validationFiles.textFileName }).first();
  await waitFor(async () => await textCard.isVisible(), 'uploaded text card in all documents');
  await textCard.getByRole('button', { name: /Select document|Deselect document/ }).click();
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.getByRole('link', { name: 'Trash', exact: true }).click();
  await waitFor(async () => await page.getByText(validationFiles.textFileName, { exact: true }).isVisible(), 'document in trash');
  await page.getByRole('button', { name: /Restore/ }).click();
  await waitFor(async () => !(await page.getByText(validationFiles.textFileName, { exact: true }).isVisible()), 'document removed from trash after restore');

  await page.getByRole('link', { name: 'Recent', exact: true }).click();
  await waitFor(async () => await page.getByText(validationFiles.textFileName, { exact: true }).isVisible(), 'document on recent page');

  await page.getByRole('link', { name: 'All Documents', exact: true }).click();
  await setSearch(page, validationFiles.pdfFileName);
  const pdfDialog = await openDocument(page, validationFiles.pdfFileName);
  const pdfFrame = pdfDialog.locator(`iframe[title="${validationFiles.pdfFileName}"]`);
  await waitFor(async () => await pdfFrame.isVisible(), 'pdf preview iframe');

  const downloadPromise = page.waitForEvent('download');
  await pdfDialog.getByRole('button', { name: 'Download' }).click();
  const download = await downloadPromise;
  await download.cancel();

  await closeDialog(pdfDialog);
  await setSearch(page, '');

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await waitFor(async () => await page.getByRole('heading', { name: 'Settings', exact: true }).isVisible(), 'settings page');
  await waitFor(async () => await page.getByText('OpenRouter', { exact: true }).isVisible(), 'OpenRouter section');
  await waitFor(async () => await page.getByText('Access Control', { exact: true }).isVisible(), 'Access Control section');
  const thumbnailSwitch = page.getByRole('switch', { name: 'Toggle thumbnail previews' });
  await thumbnailSwitch.click();
  await thumbnailSwitch.click();

  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await waitFor(async () => await page.getByRole('heading', { name: 'User Management', exact: true }).isVisible(), 'admin page');
  await waitFor(async () => await page.getByText(ADMIN_EMAIL, { exact: true }).first().isVisible(), 'admin user row');

  if (pageErrors.length > 0) {
    throw new Error(`Page errors detected: ${pageErrors.join(' | ')}`);
  }
  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.join(' | ')} :: 401s ${unauthorizedResponses.join(' | ')}`);
  }
  if (sharedPageErrors.length > 0) {
    throw new Error(`Shared page errors detected: ${sharedPageErrors.join(' | ')}`);
  }
  if (sharedConsoleErrors.length > 0) {
    throw new Error(`Shared page console errors detected: ${sharedConsoleErrors.join(' | ')} :: 401s ${sharedUnauthorizedResponses.join(' | ')}`);
  }

  await page.screenshot({ path: OUTPUT_SCREENSHOT, fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    validated: [
      'login',
      'theme-toggle',
      'supported-upload',
      'unsupported-upload',
      'search',
      'text-preview',
      'notes',
      'history',
      'tag-create-and-apply',
      'starred-navigation',
      'share-and-shared-link',
      'disable-share',
      'trash-and-restore',
      'recent-navigation',
      'pdf-preview',
      'download',
      'settings',
      'admin',
    ],
    shareUrl,
    themeFrames,
    screenshot: OUTPUT_SCREENSHOT,
  }, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
