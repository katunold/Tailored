import { app, BrowserWindow, dialog } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import type { Server as HttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let apiProcess: ChildProcess | null = null;
let apiServer: HttpServer | null = null;
let apiPrisma: { $disconnect: () => Promise<void> } | null = null;

// Linux GPU/VSync warnings are noisy in some desktop environments and are not
// critical for this UI. Keep rendering path stable and quiet for dev/runtime.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration();
}

function pickPort(): number {
  // Cheap random port in a safe-ish range for dev.
  return 3000 + Math.floor(Math.random() * 2000);
}

function findWorkspaceRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { workspaces?: unknown };
        if (pkg.workspaces) {
          return current;
        }
      } catch {
        // Ignore invalid package.json and keep traversing upward.
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function workspaceRoot(): string {
  const runtimeDir = desktopRuntimeDir();
  return (
    findWorkspaceRoot(process.cwd()) ??
    findWorkspaceRoot(app.getAppPath()) ??
    findWorkspaceRoot(runtimeDir) ??
    path.resolve(runtimeDir, '..', '..', '..')
  );
}

function desktopRuntimeDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function findFirstExistingPath(candidates: string[]): string | null {
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function reportFatalStartupError(error: unknown): void {
  const text = error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error);

  try {
    const userDataDir = app.getPath('userData');
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.appendFileSync(path.join(userDataDir, 'desktop-startup.log'), `${new Date().toISOString()} ${text}\n\n`);
  } catch {
    // Avoid masking original failure if logging fails.
  }

  try {
    dialog.showErrorBox('Tailored failed to start', text);
  } catch {
    // If dialog cannot be shown, fallback to stderr.
    console.error(text);
  }
}

function appendStartupLog(message: string): void {
  try {
    const userDataDir = app.getPath('userData');
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.appendFileSync(
      path.join(userDataDir, 'desktop-startup.log'),
      `${new Date().toISOString()} ${message}\n`
    );
  } catch {
    // Ignore logging failures.
  }
}

function toSqlitePrismaUrl(dbPath: string): string {
  // Prisma SQLite datasource accepts `file:/absolute/path.db`.
  const normalized = dbPath.replaceAll('\\', '/');
  return `file:${normalized}`;
}

function ensureDbFileReady(dbPath: string): void {
  const dbDir = path.dirname(dbPath);
  fs.mkdirSync(dbDir, { recursive: true });

  if (!fs.existsSync(dbPath)) {
    // Ensure the file exists and is writable before Prisma opens it.
    fs.closeSync(fs.openSync(dbPath, 'a'));
  }
}

async function startApi(): Promise<{ port: number; apiBase: string }> {
  const port = Number(process.env.API_PORT ?? pickPort());
  const isDev = process.env.API_DEV === '1';
  const apiBase = `http://127.0.0.1:${port}`;

  if (isDev) {
    const root = workspaceRoot();
    const apiDevCwd = path.join(root, 'apps', 'api');
    apiProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      cwd: apiDevCwd,
      env: {
        ...process.env,
        PORT: String(port)
      },
      shell: process.platform === 'win32'
    });

    apiProcess.on('exit', () => {
      apiProcess = null;
    });
    return { port, apiBase };
  }

  const runtimeDir = desktopRuntimeDir();
  const root = workspaceRoot();
  const apiAppEntry = findFirstExistingPath([
    path.join(runtimeDir, 'api', 'app.js'),
    path.join(root, 'apps', 'api', 'dist', 'app.js')
  ]);

  if (!apiAppEntry) {
    throw new Error('Could not locate bundled API app entrypoint.');
  }

  const seedDb = findFirstExistingPath([
    path.join(runtimeDir, 'assets', 'app.db'),
    path.join(root, 'apps', 'api', 'app.db')
  ]);
  const userDataDir = app.getPath('userData');
  const userDbPath = path.join(userDataDir, 'app.db');
  fs.mkdirSync(userDataDir, { recursive: true });
  if (!fs.existsSync(userDbPath) && seedDb && fs.existsSync(seedDb)) {
    fs.copyFileSync(seedDb, userDbPath);
  }
  ensureDbFileReady(userDbPath);

  const databaseUrl = toSqlitePrismaUrl(userDbPath);
  process.env.DATABASE_URL = databaseUrl;
  process.env.PORT = String(port);
  appendStartupLog(`Using SQLite DB at ${userDbPath}`);

  const apiModule = (await import(pathToFileURL(apiAppEntry).href)) as {
    createApp?: (context: { prisma: any }) => {
      listen: (port: number, host: string, cb: () => void) => HttpServer;
    };
  };

  const prismaClientEntry = findFirstExistingPath([
    path.join(runtimeDir, 'prisma-client', 'index.js'),
    path.join(process.resourcesPath, 'node_modules', '.prisma', 'client', 'index.js')
  ]);

  const prismaModule = prismaClientEntry
    ? ((await import(pathToFileURL(prismaClientEntry).href)) as {
        PrismaClient?: new (...args: any[]) => any;
      })
    : ((await import('@prisma/client')) as { PrismaClient: new (...args: any[]) => any });

  if (!prismaModule.PrismaClient) {
    throw new Error(
      `Could not load PrismaClient from ${prismaClientEntry ?? '@prisma/client'}.`
    );
  }

  if (!apiModule.createApp) {
    throw new Error(`Could not load createApp() from ${apiAppEntry}.`);
  }

  apiPrisma = new prismaModule.PrismaClient({
    datasources: { db: { url: databaseUrl } }
  });
  const apiApp = apiModule.createApp({ prisma: apiPrisma });

  await new Promise<void>((resolve, reject) => {
    const server = apiApp.listen(port, '127.0.0.1', () => resolve());
    server.once('error', reject);
    apiServer = server;
  });

  return { port, apiBase };
}

async function waitForApi(apiBase: string): Promise<void> {
  const maxAttempts = 40;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await fetch(`${apiBase}/api/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // API may still be booting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`API did not become healthy at ${apiBase}/api/health`);
}

async function isUrlReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

function createDesktopErrorPage(message: string): string {
  const escaped = message
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Tailored Desktop</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #f6f7fb;
        color: #111827;
        display: grid;
        place-items: center;
        min-height: 100vh;
      }
      .card {
        width: min(760px, calc(100vw - 48px));
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 20px;
      }
      h1 { margin: 0 0 10px; font-size: 20px; }
      p { margin: 0 0 8px; line-height: 1.5; }
      code {
        display: block;
        background: #f3f4f6;
        border-radius: 8px;
        padding: 10px;
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Tailored Desktop Could Not Load UI</h1>
      <p>${escaped}</p>
      <p>Try one of these:</p>
      <code>npm run dev</code>
      <code>npm run start:desktop</code>
    </main>
  </body>
</html>`;
}

async function createWindow(apiBase: string): Promise<void> {
  const runtimeDir = desktopRuntimeDir();
  const root = workspaceRoot();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      contextIsolation: true
    }
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    appendStartupLog(
      `Renderer did-fail-load (${errorCode}) ${errorDescription} while loading ${validatedURL}`
    );
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    appendStartupLog(
      `Renderer process gone: reason=${details.reason}, exitCode=${details.exitCode}`
    );
  });
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level <= 2) {
      appendStartupLog(`Renderer console(${level}) ${sourceId}:${line} ${message}`);
    }
  });

  const devUrl = process.env.UI_DEV_URL;
  if (devUrl) {
    const url = new URL(devUrl);
    url.searchParams.set('apiBase', apiBase);
    const reachable = await isUrlReachable(url.toString());
    if (reachable) {
      void win.loadURL(url.toString());
      return;
    }

    const html = createDesktopErrorPage(
      `UI dev server is not reachable at ${url.origin}.`
    );
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return;
  }

  const uiIndexCandidates = [
    path.join(runtimeDir, 'ui', 'index.html'),
    path.join(runtimeDir, 'ui', 'browser', 'index.html'),
    path.join(root, 'apps', 'ui', 'dist', 'ui', 'index.html'),
    path.join(root, 'apps', 'ui', 'dist', 'ui', 'browser', 'index.html')
  ];
  const uiIndex = uiIndexCandidates.find((candidate) => fs.existsSync(candidate));
  if (uiIndex) {
    void win.loadFile(uiIndex, { query: { apiBase } });
    return;
  }

  const fallbackDevUrl = 'http://localhost:4200';
  const url = new URL(fallbackDevUrl);
  url.searchParams.set('apiBase', apiBase);
  if (await isUrlReachable(url.toString())) {
    void win.loadURL(url.toString());
    return;
  }

  const html = createDesktopErrorPage(
    `Built UI was not found at ${uiIndexCandidates.join(' or ')} and no UI dev server is running at ${url.origin}.`
  );
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

app.whenReady()
  .then(async () => {
    const { apiBase } = await startApi();
    await waitForApi(apiBase);
    await createWindow(apiBase);
  })
  .catch((error) => {
    reportFatalStartupError(error);
    app.quit();
  });

process.on('uncaughtException', (error) => {
  reportFatalStartupError(error);
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  reportFatalStartupError(reason);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (apiProcess) {
    apiProcess.kill();
    apiProcess = null;
  }

  if (apiServer) {
    apiServer.close();
    apiServer = null;
  }

  if (apiPrisma) {
    void apiPrisma.$disconnect();
    apiPrisma = null;
  }
});
