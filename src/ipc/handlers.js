// src/ipc/handlers.js
export const fetchPublicKey = (address) =>
    window.electronAPI.fetchPublicKey(address);
  
  export const writeEncryptedFile = (filename, contents) =>
    window.electronAPI.writeEncryptedFile(filename, contents);
  
  export const readFile = (filePath) =>
    window.electronAPI.readFile(filePath);
  
  export const deleteFile = (filePath) =>
    window.electronAPI.deleteFile(filePath);
  
  export const uploadToIPFS = (fileContents) =>
    window.electronAPI.uploadToIPFS(fileContents);
  
  export const downloadFromIPFS = (cid) =>
    window.electronAPI.downloadFromIPFS(cid);
  
  export const downloadQRCode = (data) =>
    window.electronAPI.downloadQRCode(data);
  
  export const saveAccountInfo = (data) =>
    window.electronAPI.saveAccountInfo(data);
  
  export const loadAccountInfo = (address) =>
    window.electronAPI.loadAccountInfo(address);
  
  export const saveFriendsList = (data) =>
    window.electronAPI.saveFriendsList(data);
  
  export const loadFriendsList = (address) =>
    window.electronAPI.loadFriendsList(address);
  
  export const readFriendQRCode = () =>
    window.electronAPI.readFriendQRCode();
  
  export const saveMnemonic = (mnemonic, password) =>
    window.electronAPI.saveMnemonic(mnemonic, password);
  
  export const retrieveMnemonic = (password) =>
    window.electronAPI.retrieveMnemonic(password);
  
  export const hasMnemonicStored = () =>
    window.electronAPI.hasMnemonicStored();
  