// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  fetchPublicKey: (address) => ipcRenderer.invoke('fetchPublicKey', address),
  writeEncryptedFile: (filename, contents) =>
    ipcRenderer.invoke('writeEncryptedFile', { filename, contents }),
  readFile: (filePath) => ipcRenderer.invoke('readFile', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('deleteFile', filePath),
  uploadToIPFS: (fileContents) => ipcRenderer.invoke('uploadToIPFS', fileContents),
});

