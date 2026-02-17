import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(desktopRoot, '..', '..');
const desktopDist = path.join(desktopRoot, 'dist');

const apiDistSrc = path.join(workspaceRoot, 'apps', 'api', 'dist');
const uiDistSrc = path.join(workspaceRoot, 'apps', 'ui', 'dist', 'ui');
const seedDbSrc = path.join(workspaceRoot, 'apps', 'api', 'app.db');
const prismaClientSrc = path.join(workspaceRoot, 'node_modules', '.prisma', 'client');

const apiDistOut = path.join(desktopDist, 'api');
const uiDistOut = path.join(desktopDist, 'ui');
const assetsOut = path.join(desktopDist, 'assets');
const seedDbOut = path.join(assetsOut, 'app.db');
const prismaClientOut = path.join(desktopDist, 'prisma-client');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function requirePathExists(label, targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found at ${targetPath}`);
  }
}

requirePathExists('API build output', apiDistSrc);
requirePathExists('UI build output', uiDistSrc);
requirePathExists('Seed database', seedDbSrc);
requirePathExists('Prisma generated client', prismaClientSrc);

ensureDir(desktopDist);
fs.rmSync(apiDistOut, { recursive: true, force: true });
fs.rmSync(uiDistOut, { recursive: true, force: true });
fs.rmSync(prismaClientOut, { recursive: true, force: true });
ensureDir(assetsOut);

fs.cpSync(apiDistSrc, apiDistOut, { recursive: true });
fs.cpSync(uiDistSrc, uiDistOut, { recursive: true });
fs.cpSync(prismaClientSrc, prismaClientOut, { recursive: true });
fs.copyFileSync(seedDbSrc, seedDbOut);
