// electron.js

const config = require('./src/config.js');
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Create a promise to dynamically import and create the IPFS client.
const ipfsClientPromise = import('ipfs-http-client').then((mod) =>
  mod.create({ url: config.IFPS_GATEWAY_URL })
);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // For development only—disable webSecurity to bypass CORS (not for production!)
      webSecurity: false,
    },
  });

  const buildPath = path.join(__dirname, 'build', 'index.html');
  if (process.env.NODE_ENV === 'development' || !fs.existsSync(buildPath)) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(buildPath);
  }
}

app.whenReady().then(createWindow);

// IPC handler: fetch public key from REST endpoint.
ipcMain.handle('fetchPublicKey', async (event, address) => {
  try {
    const { default: fetch } = await import('node-fetch');
    const url = `${config.COSMOS_API}/cosmos/auth/v1beta1/accounts/${address}`;
    console.log('[fetchPublicKey] Fetching public key from URL:', url);
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[fetchPublicKey] HTTP error! status: ${response.status} - ${text}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    console.log('[fetchPublicKey] Received public key data:', json);
    
    // Extract the pub_key from the nested structure
    const pubKey = json.account?.pub_key;
    if (!pubKey) {
      throw new Error('Public key not found in the response');
    }
    
    return pubKey;
  } catch (err) {
    console.error('[fetchPublicKey] Error:', err);
    throw err;
  }
});

// IPC handler: write encrypted file.
ipcMain.handle('writeEncryptedFile', async (event, { filename, contents }) => {
  try {
    const filePath = path.join(__dirname, filename);
    console.log('[writeEncryptedFile] Writing file:', filePath);
    fs.writeFileSync(filePath, Buffer.from(contents, 'utf8'));
    console.log('[writeEncryptedFile] File written successfully.');
    return { success: true, filePath };
  } catch (error) {
    console.error('[writeEncryptedFile] Error writing file:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler: read file contents.
ipcMain.handle('readFile', async (event, filePath) => {
  try {
    console.log('[readFile] Reading file:', filePath);
    const data = fs.readFileSync(filePath);
    console.log('[readFile] File read successfully.');
    return { success: true, data: data.toString('utf8') };
  } catch (error) {
    console.error('[readFile] Error reading file:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler: delete file.
ipcMain.handle('deleteFile', async (event, filePath) => {
  try {
    console.log('[deleteFile] Deleting file:', filePath);
    fs.unlinkSync(filePath);
    console.log('[deleteFile] File deleted successfully.');
    return { success: true };
  } catch (error) {
    console.error('[deleteFile] Error deleting file:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to upload file contents to IPFS.
ipcMain.handle('uploadToIPFS', async (event, fileContents) => {
  try {
    console.log('[uploadToIPFS] Uploading file contents to IPFS...');
    // Ensure fileContents is converted to a Buffer.
    const buffer = Buffer.from(fileContents, 'utf8');
    const ipfs = await ipfsClientPromise;
    const result = await ipfs.add(buffer);
    console.log('[uploadToIPFS] IPFS upload result:', result);
    return { success: true, cid: result.cid.toString() };
  } catch (error) {
    console.error('[uploadToIPFS] Error uploading to IPFS:', error);
    return { success: false, error: error.message };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
