import { app, BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

let apiProcess: ChildProcess | null = null;

function pickPort(): number {
  // Cheap random port in a safe-ish range for dev.
  return 3000 + Math.floor(Math.random() * 2000);
}

function startApi(): { port: number } {
  const port = Number(process.env.API_PORT ?? pickPort());
  const isDev = process.env.API_DEV === '1';

  if (isDev) {
    apiProcess = spawn('npm', ['-w', 'apps/api', 'run', 'dev'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: String(port),
      },
      shell: process.platform === 'win32',
    });
  } else {
    const apiEntry = path.join(app.getAppPath(), '..', 'api', 'dist', 'index.js');
    apiProcess = spawn(process.execPath, [apiEntry], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: String(port),
      },
    });
  }

  apiProcess.on('exit', () => {
    apiProcess = null;
  });

  return { port };
}

function createWindow(apiBase: string): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
    },
  });

  const devUrl = process.env.UI_DEV_URL;
  if (devUrl) {
    const url = new URL(devUrl);
    url.searchParams.set('apiBase', apiBase);
    void win.loadURL(url.toString());
    return;
  }

  const uiIndex = path.join(app.getAppPath(), '..', 'ui', 'index.html');
  void win.loadFile(uiIndex, { query: { apiBase } });
}

app.whenReady().then(() => {
  const { port } = startApi();
  const apiBase = `http://localhost:${port}`;
  createWindow(apiBase);
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
