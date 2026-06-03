// electron.js
// window creation code for Electron app
const { app, BrowserWindow } = require('electron');
const path = require('path');

// This variable distinguishes between dev and production modes
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false, // for safety reasons disallow node integration
      // in the future, if access to backend is needed, use preload scripts
      contextIsolation: true, // isolate frontend and backend
    },
  });

  if (isDev) {
    // In development mode, open the current VAA1 frontend launcher URL.
    const frontendPort = process.env.VAA1_FRONTEND_PORT || process.env.PORT || '3001';
    mainWindow.loadURL(`http://127.0.0.1:${frontendPort}/dashboard`);
    mainWindow.webContents.openDevTools(); // optional

  } else {
    // In production mode, open the built page
    const frontendPath = path.join(__dirname, 'src', 'frontend', 'out', 'index.html');
    mainWindow.loadFile(frontendPath);
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
