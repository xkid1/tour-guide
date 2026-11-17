// Electron main process for the e2e app: a locked-down window, as Electron's security
// checklist recommends (contextIsolation, sandbox, no nodeIntegration).
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.whenReady().then(() => {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  window.loadFile(path.join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => app.quit());
