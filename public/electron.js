// public/electron.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { execFile } = require('child_process');
const util = require('util');
const { saveMnemonic, retrieveMnemonic, hasMnemonicStored } = require('../src/secureMnemonic');
const sharp = require('sharp');
const { Worker } = require('worker_threads');
global.Worker = Worker;
const QrScanner = require('qr-scanner');


let Store = null;
let store = null;
let CID = null;
let config = null;

const execFilePromise = util.promisify(execFile);
const tmpdir = path.join(app.getPath('temp'), 'bitmail-temp-files');
let mainWindow;

// Utility function to ensure a directory exists
async function ensureDirExists(dir) {
  try {
    await fs.promises.access(dir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.promises.mkdir(dir, { recursive: true });
    } else {
      throw error;
    }
  }
}

// Initialize electron-store
async function initializeStore() {
  try {
    const electronStoreModule = await import('electron-store');
    Store = electronStoreModule.default;
    store = new Store();
    console.log('electron-store initialized');
  } catch (error) {
    console.error('Failed to initialize electron-store:', error);
    throw error;
  }
}

// Initialize config.js
async function initializeConfig() {
  try {
    const configModule = await import('../src/config.js');
    config = configModule.default || configModule;
    console.log('config.js initialized');
  } catch (error) {
    console.error('Failed to initialize config.js:', error);
    throw error;
  }
}

// Initialize dependencies
async function initializeDependencies() {
  try {
    const multiformats = await import('multiformats');
    CID = multiformats.CID;
    console.log('Dependencies initialized');
  } catch (error) {
    console.error('Failed to initialize dependencies:', error);
    throw error;
  }
}

function sanitizeShellInput(input) {
  return input.replace(/[^a-zA-Z0-9-_]/g, '');
}

// Window creation
function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      enableRemoteModule: false,
      worldSafeExecuteJavaScript: true,
      webSecurity: process.env.NODE_ENV === 'production'
    },
  });

  const buildPath = path.join(__dirname, 'build', 'index.html');
  if (process.env.NODE_ENV === 'development' || !fs.existsSync(buildPath)) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(buildPath);
  }
  
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('[Electron] Main window finished loading.');
    mainWindow.webContents.send('electron-ready');
  });
}

// IPC Handlers
function setupIpcMain() {
  if (!Store || !store || !CID || !config) {
    console.error('One or more essential modules are not initialized');
    return;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('electron-ready');
  }

  const isValidCID = (cidString) => {
    try {
      CID.parse(cidString);
      return true;
    } catch (error) {
      return false;
    }
  };

  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({});
    return canceled ? null : filePaths[0];
  });

  ipcMain.handle('uploadToIPFS', async (event, fileContents) => {
    try {
      const tmpFilePath = path.join(tmpdir, `upload-${Date.now()}.txt`);
      await fs.promises.writeFile(tmpFilePath, fileContents);
      const { stdout } = await execFilePromise('ipfs', ['add', tmpFilePath]);
      const cid = stdout.split(' ')[1].trim();
      if (!isValidCID(cid)) {
        console.error('Invalid CID returned from IPFS:', cid);
        return {
          success: false,
          error: { code: "IPFS_UPLOAD_FAILED", message: "Invalid CID from IPFS", details: cid }
        };
      }
      await fs.promises.unlink(tmpFilePath);
      return { success: true, cid: cid };
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      return {
        success: false,
        error: { code: "IPFS_UPLOAD_FAILED", message: "Failed to upload to IPFS", details: error.message }
      };
    }
  });

  ipcMain.handle('downloadFromIPFS', async (event, cid) => {
    try {
      if (!isValidCID(cid)) {
        return {
          success: false,
          error: { code: "INVALID_CID", message: "Invalid CID provided", details: cid }
        };
      }
      const tmpFilePath = path.join(tmpdir, `download-${Date.now()}.txt`);
      const { stdout } = await execFilePromise('ipfs', ['get', cid, '-o', tmpFilePath]);
      const data = await fs.promises.readFile(tmpFilePath, 'utf8');
      await fs.promises.unlink(tmpFilePath);
      return { success: true, data: data };
    } catch (error) {
      console.error('Error downloading from IPFS:', error);
      return {
        success: false,
        error: { code: "IPFS_DOWNLOAD_FAILED", message: "Failed to download from IPFS", details: error.message }
      };
    }
  });

  ipcMain.handle('writeEncryptedFile', async (event, filename, encryptedContent) => {
    try {
      const filePath = path.join(tmpdir, filename);
      await fs.promises.writeFile(filePath, encryptedContent);
      return { success: true, filePath: filePath };
    } catch (error) {
      console.error('Error writing encrypted file:', error);
      return {
        success: false,
        error: { code: "FILE_WRITE_FAILED", message: "Failed to write encrypted file", details: error.message }
      };
    }
  });

  ipcMain.handle('getStoreValue', (event, key) => store.get(key));
  ipcMain.handle('setStoreValue', (event, key, value) => { store.set(key, value); return true; });

  ipcMain.handle('readFile', async (event, filePath) => {
    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      return { success: true, data: data };
    } catch (error) {
      console.error('Error reading file:', error);
      return {
        success: false,
        error: { code: "FILE_READ_FAILED", message: "Failed to read file", details: error.message }
      };
    }
  });

  ipcMain.handle('deleteFile', async (event, filePath) => {
    try {
      await fs.promises.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error('Error deleting file:', error);
      return {
        success: false,
        error: { code: "FILE_DELETE_FAILED", message: "Failed to delete file", details: error.message }
      };
    }
  });

  ipcMain.handle('fetchPublicKey', async (event, walletAddress) => {
    try {
      const sanitizedAddress = sanitizeShellInput(walletAddress);
      const args = ['q', 'account', sanitizedAddress, '--output', 'json'];
      const { stdout } = await execFilePromise('btmcli', args);
      return { success: true, account: JSON.parse(stdout) };
    } catch (error) {
      console.error('Error fetching public key:', error);
      return {
        success: false,
        error: { code: "FETCH_PUBLIC_KEY_FAILED", message: "Failed to fetch public key", details: error.message }
      };
    }
  });

  // loadAccountInfo handler with detailed logging
  ipcMain.handle('loadAccountInfo', async (event, walletAddress) => {
    try {
      const filePath = path.join(app.getPath('userData'), `${walletAddress}_account_info.json`);
      console.log('[Electron.loadAccountInfo] Checking account info file at:', filePath);
      try {
        await fs.promises.access(filePath);
        console.log('[Electron.loadAccountInfo] File exists.');
      } catch (error) {
        console.log('[Electron.loadAccountInfo] File does not exist. Creating default account info file with empty username.');
        const defaultAccountInfo = { userName: '' };
        await fs.promises.writeFile(filePath, JSON.stringify(defaultAccountInfo));
        console.log('[Electron.loadAccountInfo] Default account info file created:', defaultAccountInfo);
        return { success: true, accountInfo: defaultAccountInfo };
      }
      const data = await fs.promises.readFile(filePath, 'utf8');
      console.log('[Electron.loadAccountInfo] Raw file contents:', data);
      const accountInfo = JSON.parse(data);
      console.log('[Electron.loadAccountInfo] Loaded account info from file:', filePath, 'Content:', accountInfo);
      return { success: true, accountInfo: accountInfo };
    } catch (error) {
      console.error('[Electron.loadAccountInfo] Error loading account info:', error);
      return {
        success: false,
        error: { code: "LOAD_ACCOUNT_FAILED", message: "Failed to load account info", details: error.message }
      };
    }
  });

  // New: Separate saveUserName handler to update only the username field
  ipcMain.handle('saveUserName', async (event, { walletAddress, userName }) => {
    try {
      const filePath = path.join(app.getPath('userData'), `${walletAddress}_account_info.json`);
      let accountInfo = { userName: '' };
      try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        accountInfo = JSON.parse(data);
      } catch (err) {
        console.log('[Electron.saveUserName] No existing account info. Using default.');
      }
      accountInfo.userName = userName;
      await fs.promises.writeFile(filePath, JSON.stringify(accountInfo));
      console.log('[Electron.saveUserName] Saved account info:', accountInfo);
      return { success: true };
    } catch (error) {
      console.error('[Electron.saveUserName] Error saving username:', error);
      return {
        success: false,
        error: { code: "SAVE_USERNAME_FAILED", message: "Failed to save username", details: error.message }
      };
    }
  });

  // Existing saveAccountInfo handler (for saving complete account info)
  ipcMain.handle('saveAccountInfo', async (event, { walletAddress, accountInfo }) => {
    try {
      const filePath = path.join(app.getPath('userData'), `${walletAddress}_account_info.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(accountInfo));
      return { success: true };
    } catch (error) {
      console.error('Error saving account info:', error);
      return {
        success: false,
        error: { code: "SAVE_ACCOUNT_FAILED", message: "Failed to save account info", details: error.message }
      };
    }
  });

  ipcMain.handle('loadFriendsList', async (event, walletAddress) => {
    try {
      const filePath = path.join(app.getPath('userData'), `${walletAddress}_friends.json`);
      try {
        await fs.promises.access(filePath);
      } catch (error) {
        console.log('Friends list file does not exist, creating empty list.');
        const emptyFriendsList = [];
        await fs.promises.writeFile(filePath, JSON.stringify(emptyFriendsList));
        return { success: true, friends: emptyFriendsList };
      }
      const data = await fs.promises.readFile(filePath, 'utf8');
      const friends = JSON.parse(data);
      return { success: true, friends: friends };
    } catch (error) {
      console.error('Error loading friends list:', error);
      return {
        success: false,
        error: { code: "LOAD_FRIENDS_FAILED", message: "Failed to load friends list", details: error.message }
      };
    }
  });

  
  



  ipcMain.handle('saveFriendsList', async (event, { walletAddress, friends }) => {
    try {
      const filePath = path.join(app.getPath('userData'), `${walletAddress}_friends.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(friends));
      return { success: true };
    } catch (error) {
      console.error('Error saving friends list:', error);
      return {
        success: false,
        error: { code: "SAVE_FRIENDS_FAILED", message: "Failed to save friends list", details: error.message }
      };
    }
  });

  ipcMain.handle('saveMnemonic', async (event, mnemonic, password) => {
    try {
      await saveMnemonic(mnemonic, password, (key, value) => Promise.resolve(store.set(key, value)));
      return { success: true };
    } catch (error) {
      console.error('Error in saveMnemonic IPC handler:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('retrieveMnemonic', async (event, password) => {
    try {
      const mnemonic = await retrieveMnemonic(password, (key) => Promise.resolve(store.get(key)));
      return { success: true, mnemonic };
    } catch (error) {
      console.error('Error in retrieveMnemonic IPC handler:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hasMnemonicStored', async (event) => {
    try {
      const exists = await hasMnemonicStored((key) => Promise.resolve(store.get(key)));
      return exists;
    } catch (error) {
      console.error('Error in hasMnemonicStored IPC handler:', error);
      return false;
    }
  });
}

app.whenReady().then(async () => {
  try {
    await ensureDirExists(tmpdir);
    await initializeStore();
    await initializeConfig();
    await initializeDependencies();
    createWindow();
    setupIpcMain();
  } catch (err) {
    console.error('App initialization failed:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', async () => {
  try {
    await fs.promises.rm(tmpdir, { recursive: true, force: true });
    console.log('Temporary files cleaned up');
  } catch (error) {
    console.error('Error cleaning up temporary files:', error);
  }
});
