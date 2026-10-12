import { app, BrowserWindow, ipcMain } from 'electron';
import { mkdir, readFile, rename, writeFile, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const savePath = () => join(app.getPath('userData'), 'save-v1.json');
const backupPath = () => `${savePath()}.bak`;

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#101820',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (app.isPackaged) await window.loadFile(join(__dirname, '../dist/index.html'));
  else await window.loadURL('http://127.0.0.1:5173');
}

ipcMain.handle('save:load', async () => {
  const readOptional = async (path: string): Promise<string | null> => {
    try { return await readFile(path, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  };
  try {
    return { primary: await readOptional(savePath()), backup: await readOptional(backupPath()) };
  } catch {
    throw new Error('Impossible de lire la sauvegarde ou sa copie de secours.');
  }
});

ipcMain.handle('save:write', async (_event, raw: unknown) => {
  if (typeof raw !== 'string' || raw.length > 1_000_000) {
    throw new Error('Format de sauvegarde invalide.');
  }
  const payload: unknown = JSON.parse(raw);
  if (payload !== null && (typeof payload !== 'object' || !('version' in payload) || payload.version !== 2 ||
      !('hero' in payload) || (payload.hero !== 'warrior' && payload.hero !== 'assassin') ||
      !('inventory' in payload) || !Array.isArray(payload.inventory))) {
    throw new Error('Schéma de sauvegarde non pris en charge.');
  }
  await mkdir(app.getPath('userData'), { recursive: true });
  const target = savePath();
  const temporary = `${target}.tmp`;
  if (payload === null) {
    await writeFile(temporary, raw, 'utf8');
    await rename(temporary, target);
    await rm(backupPath(), { force: true });
    return true;
  }
  try {
    await copyFile(target, backupPath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await writeFile(temporary, raw, 'utf8');
  await rename(temporary, target);
  return true;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
