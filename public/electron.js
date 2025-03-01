//public/electron.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const sharp = require('sharp');
const jsQR = require('jsqr');
const { execFile } = require('child_process');
const util = require('util');
const { saveMnemonic, retrieveMnemonic, hasMnemonicStored } = require('../src/secureMnemonic');
// Shared Variables - Initialize to null
let Store = null;
let store = null;
let CID = null;
let config = null;

const execFilePromise = util.promisify(execFile);
const tmpdir = path.join(app.getPath('temp'), 'bitmail-temp-files');
let mainWindow;

// Utility functions
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
        throw error; // Re-throw to signal failure to the app
    }
}

// Initialize config.js
async function initializeConfig() {
    try {
        const configModule = await import('../src/config.js');
        config = configModule.default || configModule; // Handle both default and named exports
        console.log('config.js initialized');
    } catch (error) {
        console.error('Failed to initialize config.js:', error);
        throw error; // Re-throw to signal failure to the app
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
        throw error; // Re-throw to signal failure to the app
    }
}

function sanitizeShellInput(input) {
    return input.replace(/[^a-zA-Z0-9-_]/g, '');
}

// Window creation
function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');  // <--- HERE
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath, // <--- AND HERE
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      enableRemoteModule: false,
      worldSafeExecuteJavaScript: true,
      webSecurity: process.env.NODE_ENV === 'production',
    },
  });

    const buildPath = path.join(__dirname, 'build', 'index.html');
    if (process.env.NODE_ENV === 'development' || !fs.existsSync(buildPath)) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(buildPath);
    }
}

// IPC Handlers
function setupIpcMain() {
    if (!Store || !store || !CID || !config) {
        console.error('One or more essential modules are not initialized');
        return;
    }

    const isValidCID = (cidString) => {
        try {
            CID.parse(cidString);
            return true;
        } catch (error) {
            return false;
        }
    };

    // File dialog handler
    ipcMain.handle('dialog:openFile', async () => {
        const {canceled, filePaths} = await dialog.showOpenDialog({});
        return canceled ? null : filePaths[0];
    });

    // IPFS operations
    ipcMain.handle('uploadToIPFS', async (event, fileContents) => {
        try {
            const tmpFilePath = path.join(tmpdir, `upload-${Date.now()}.txt`);
            await fs.promises.writeFile(tmpFilePath, fileContents);
            const {stdout, stderr} = await execFilePromise('ipfs', ['add', tmpFilePath]);
            const cid = stdout.split(' ')[1].trim();
            if (!isValidCID(cid)) {
                console.error('Invalid CID returned from IPFS:', cid);
                return {
                    success: false,
                    error: {code: "IPFS_UPLOAD_FAILED", message: "Invalid CID from IPFS", details: cid}
                };
            }
            await fs.promises.unlink(tmpFilePath);
            return {success: true, cid: cid};
        } catch (error) {
            console.error('Error uploading to IPFS:', error);
            return {
                success: false,
                error: {code: "IPFS_UPLOAD_FAILED", message: "Failed to upload to IPFS", details: error.message}
            };
        }
    });

    ipcMain.handle('downloadFromIPFS', async (event, cid) => {
        try {
            if (!isValidCID(cid)) {
                return {
                    success: false,
                    error: {code: "INVALID_CID", message: "Invalid CID provided", details: cid}
                };
            }
            const tmpFilePath = path.join(tmpdir, `download-${Date.now()}.txt`);
            const {stdout, stderr} = await execFilePromise('ipfs', ['get', cid, '-o', tmpFilePath]);
            const data = await fs.promises.readFile(tmpFilePath, 'utf8');
            await fs.promises.unlink(tmpFilePath);
            return {success: true, data: data};
        } catch (error) {
            console.error('Error downloading from IPFS:', error);
            return {
                success: false,
                error: {code: "IPFS_DOWNLOAD_FAILED", message: "Failed to download from IPFS", details: error.message}
            };
        }
    });

    ipcMain.handle('writeEncryptedFile', async (event, filename, encryptedContent) => {
        try {
            const filePath = path.join(tmpdir, filename);
            await fs.promises.writeFile(filePath, encryptedContent);
            return {success: true, filePath: filePath};
        } catch (error) {
            console.error('Error writing encrypted file:', error);
            return {
                success: false,
                error: {code: "FILE_WRITE_FAILED", message: "Failed to write encrypted file", details: error.message}
            };
        }
    });

    ipcMain.handle('getStoreValue', (event, key) => {
        return store.get(key);
    });

    ipcMain.handle('setStoreValue', (event, key, value) => {
        store.set(key, value);
        return true;
    });

    ipcMain.handle('readFile', async (event, filePath) => {
        try {
            const data = await fs.promises.readFile(filePath, 'utf8');
            return {success: true, data: data};
        } catch (error) {
            console.error('Error reading file:', error);
            return {
                success: false,
                error: {code: "FILE_READ_FAILED", message: "Failed to read file", details: error.message}
            };
        }
    });

    ipcMain.handle('deleteFile', async (event, filePath) => {
        try {
            await fs.promises.unlink(filePath);
            return {success: true};
        } catch (error) {
            console.error('Error deleting file:', error);
            return {
                success: false,
                error: {code: "FILE_DELETE_FAILED", message: "Failed to delete file", details: error.message}
            };
        }
    });

    ipcMain.handle('fetchPublicKey', async (event, walletAddress) => {
        try {
            const sanitizedAddress = sanitizeShellInput(walletAddress);
            const args = ['q', 'account', sanitizedAddress, '--output', 'json'];
            const {stdout} = await execFilePromise('btmcli', args);
            return {success: true, account: JSON.parse(stdout)};
        } catch (error) {
            console.error('Error fetching public key:', error);
            return {
                success: false,
                error: {code: "FETCH_PUBLIC_KEY_FAILED", message: "Failed to fetch public key", details: error.message}
            };
        }
    });

    ipcMain.handle('loadAccountInfo', async (event, walletAddress) => {
        try {
            const filePath = path.join(app.getPath('userData'), `${walletAddress}_account_info.json`);
            try {
                await fs.promises.access(filePath);
            } catch (error) {
                console.log('Account info file does not exist, creating default.');
                const defaultAccountInfo = {userName: ''};
                await fs.promises.writeFile(filePath, JSON.stringify(defaultAccountInfo));
                return {success: true, accountInfo: defaultAccountInfo};
            }
            const data = await fs.promises.readFile(filePath, 'utf8');
            const accountInfo = JSON.parse(data);
            return {success: true, accountInfo: accountInfo};
        } catch (error) {
            console.error('Error loading account info:', error);
            return {
                success: false,
                error: {code: "LOAD_ACCOUNT_FAILED", message: "Failed to load account info", details: error.message}
            };
        }
    });

    ipcMain.handle('saveAccountInfo', async (event, {walletAddress, accountInfo}) => {
        try {
            const filePath = path.join(app.getPath('userData'), `${walletAddress}_account_info.json`);
            await fs.promises.writeFile(filePath, JSON.stringify(accountInfo));
            return {success: true};
        } catch (error) {
            console.error('Error saving account info:', error);
            return {
                success: false,
                error: {code: "SAVE_ACCOUNT_FAILED", message: "Failed to save account info", details: error.message}
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
                return {success: true, friends: emptyFriendsList};
            }
            const data = await fs.promises.readFile(filePath, 'utf8');
            const friends = JSON.parse(data);
            return {success: true, friends: friends};
        } catch (error) {
            console.error('Error loading friends list:', error);
            return {
                success: false,
                error: {code: "LOAD_FRIENDS_FAILED", message: "Failed to load friends list", details: error.message}
            };
        }
    });

    ipcMain.handle('saveFriendsList', async (event, {walletAddress, friends}) => {
        try {
            const filePath = path.join(app.getPath('userData'), `${walletAddress}_friends.json`);
            await fs.promises.writeFile(filePath, JSON.stringify(friends));
            return {success: true};
        } catch (error) {
            console.error('Error saving friends list:', error);
            return {
                success: false,
                error: {code: "SAVE_FRIENDS_FAILED", message: "Failed to save friends list", details: error.message}
            };
        }
    });

    ipcMain.handle('readFriendQRCode', async (event) => {
        try {
            const win = BrowserWindow.getAllWindows()[0];
            const result = await dialog.showOpenDialog(win, {
                properties: ['openFile'],
                filters: [{name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp']}]
            });
            if (result.canceled) {
                return {
                    success: false,
                    error: {code: "USER_CANCELLED", message: "User cancelled file selection", details: ""}
                };
            }
            const filePath = result.filePaths[0];
            const bitmap = await sharp(filePath).grayscale().raw().toBuffer();
            const code = jsQR(bitmap, 0, 0, {inversionAttempts: 'dontInvert'});
            if (!code) {
                return {
                    success: false,
                    error: {code: "NO_QR_FOUND", message: "No QR code found in image", details: ""}
                };
            }
            const friend = JSON.parse(code.data);
            if (
                typeof friend === 'object' &&
                friend !== null &&
                typeof friend.btml_address === 'string' &&
                typeof friend.public_key === 'string'
            ) {
                return {success: true, friend: friend};
            } else {
                return {
                    success: false,
                    error: {code: "INVALID_QR_DATA", message: "QR code does not contain valid friend data", details: ""}
                };
            }
        } catch (error) {
            console.error('Error reading friend QR Code:', error);
            return {
                success: false,
                error: {code: "READ_QR_FAILED", message: "Failed to read friend QR code", details: error.message}
            };
        }
    });

    ipcMain.handle('downloadQRCode', async (event, {qrData, defaultFileName}) => {
        try {
            const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData));
            const buffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');
            const win = BrowserWindow.getAllWindows()[0];
            const result = await dialog.showSaveDialog(win, {
                defaultPath: path.join(app.getPath('downloads'), defaultFileName),
                filters: [{name: 'Images', extensions: ['png']}]
            });
            if (result.canceled) {
                return {
                    success: false,
                    error: {code: "USER_CANCELLED", message: "User cancelled save dialog", details: ""}
                };
            }
            const filePath = result.filePath;
            await fs.promises.writeFile(filePath, buffer);
            return {success: true, filePath: filePath};
        } catch (error) {
            console.error('Error generating QR Code:', error);
            return {
                success: false,
                error: {code: "QR_DOWNLOAD_FAILED", message: "Failed to generate QR code", details: error.message}
            };
        }
    });
    ipcMain.handle('saveMnemonic', async (event, mnemonic, password) => {
      try {
        // Pass a setter that returns a promise
        await saveMnemonic(mnemonic, password, (key, value) => Promise.resolve(store.set(key, value)));
        return { success: true };
      } catch (error) {
        console.error('Error in saveMnemonic IPC handler:', error);
        return { success: false, error: error.message };
      }
    });
    
    // IPC handler for retrieving the mnemonic
    ipcMain.handle('retrieveMnemonic', async (event, password) => {
      try {
        // Pass a getter that returns a promise
        const mnemonic = await retrieveMnemonic(password, (key) => Promise.resolve(store.get(key)));
        return { success: true, mnemonic };
      } catch (error) {
        console.error('Error in retrieveMnemonic IPC handler:', error);
        return { success: false, error: error.message };
      }
    });
    
    // IPC handler for checking if a mnemonic is stored
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

// App lifecycle
app.whenReady().then(async () => {
    try {
        await ensureDirExists(tmpdir);
        // Initialize the store
        await initializeStore();
        // Initialize configuration
        await initializeConfig();
        // Initialize dependencies
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

// Secure temp file cleanup before quitting
app.on('before-quit', async () => {
    try {
        await fs.promises.rm(tmpdir, {recursive: true, force: true});
        console.log('Temporary files cleaned up');
    } catch (error) {
        console.error('Error cleaning up temporary files:', error);
    }
});

