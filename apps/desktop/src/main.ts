import { app, BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let apiProcess: ChildProcess | null = null;

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
  const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
  return (
    findWorkspaceRoot(process.cwd()) ??
    findWorkspaceRoot(app.getAppPath()) ??
    findWorkspaceRoot(runtimeDir) ??
    path.resolve(runtimeDir, '..', '..', '..')
  );
}

function startApi(): { port: number; apiBase: string } {
  const port = Number(process.env.API_PORT ?? pickPort());
  const isDev = process.env.API_DEV === '1';
  const root = workspaceRoot();
  const apiDevCwd = path.join(root, 'apps', 'api');
  const apiEntry = path.join(root, 'apps', 'api', 'dist', 'server.js');

  if (isDev) {
    apiProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      cwd: apiDevCwd,
      env: {
        ...process.env,
        PORT: String(port)
      },
      shell: process.platform === 'win32'
    });
  } else {
    if (fs.existsSync(apiEntry)) {
      apiProcess = spawn(process.execPath, [apiEntry], {
        stdio: 'inherit',
        cwd: root,
        env: {
          ...process.env,
          PORT: String(port),
          ELECTRON_RUN_AS_NODE: '1'
        }
      });
    } else {
      apiProcess = spawn('npm', ['run', 'dev'], {
        stdio: 'inherit',
        cwd: apiDevCwd,
        env: {
          ...process.env,
          PORT: String(port)
        },
        shell: process.platform === 'win32'
      });
    }
  }

  apiProcess.on('exit', () => {
    apiProcess = null;
  });

  return { port, apiBase: `http://127.0.0.1:${port}` };
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

app.whenReady().then(async () => {
  const { apiBase } = startApi();
  await waitForApi(apiBase);
  await createWindow(apiBase);
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
});
