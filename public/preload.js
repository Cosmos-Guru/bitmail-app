// preload.js
const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload Script Loaded');

const electronAPI = {
  invoke: (channel, data) => {
    const validChannels = [
      'fetchPublicKey',
      'writeEncryptedFile',
      'readFile',
      'deleteFile',
      'uploadToIPFS',
      'downloadFromIPFS',
      'downloadQRCode',
      'saveAccountInfo',
      'loadAccountInfo',
      'saveFriendsList',
      'loadFriendsList',
      'readFriendQRCode',
      'saveMnemonic',
      'retrieveMnemonic',
      'hasMnemonicStored',
      'getStoreValue',
      'setStoreValue',
      'saveUserName' // new channel
    ];

    if (!validChannels.includes(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, data)
      .catch(error => {
        console.error(`[IPC Error] ${channel}:`, error);
        throw new Error(error.message || 'Unknown IPC error');
      });
  },
  fetchPublicKey: (address) => ipcRenderer.invoke('fetchPublicKey', address),
  writeEncryptedFile: (filename, contents) => ipcRenderer.invoke('writeEncryptedFile', { filename, contents }),
  readFile: (filePath) => ipcRenderer.invoke('readFile', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('deleteFile', filePath),
  uploadToIPFS: (fileContents) => ipcRenderer.invoke('uploadToIPFS', fileContents),
  downloadFromIPFS: (cid) => ipcRenderer.invoke('downloadFromIPFS', cid),
  downloadQRCode: (data) => ipcRenderer.invoke('downloadQRCode', data),
  saveAccountInfo: (data) => ipcRenderer.invoke('saveAccountInfo', data),
  loadAccountInfo: (address) => ipcRenderer.invoke('loadAccountInfo', address),
  saveFriendsList: (data) => ipcRenderer.invoke('saveFriendsList', data),
  loadFriendsList: (address) => ipcRenderer.invoke('loadFriendsList', address),
  readFriendQRCode: () => ipcRenderer.invoke('readFriendQRCode'),
  // Mnemonic-related functions
  saveMnemonic: (mnemonic, password) => ipcRenderer.invoke('saveMnemonic', mnemonic, password),
  retrieveMnemonic: (password) => ipcRenderer.invoke('retrieveMnemonic', password),
  hasMnemonicStored: () => ipcRenderer.invoke('hasMnemonicStored'),
  // Store-related methods
  getStoreValue: (key) => ipcRenderer.invoke('getStoreValue', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('setStoreValue', key, value),
  // New: Expose saveUserName
  saveUserName: (data) => ipcRenderer.invoke('saveUserName', data)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
