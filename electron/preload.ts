import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('gamePlatform', {
  loadSave: (): Promise<{ primary: string | null; backup: string | null }> => ipcRenderer.invoke('save:load'),
  writeSave: (raw: string): Promise<boolean> => ipcRenderer.invoke('save:write', raw),
  isDesktop: true,
});
