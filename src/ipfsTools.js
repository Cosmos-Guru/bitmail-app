// src/ipfsTools.js
export const uploadToIPFS = async (fileContents) => {
    try {
      const uploadResult = await window.electronAPI.uploadToIPFS(fileContents);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }
      return uploadResult.cid;
    } catch (error) {
      console.error("Error uploading to IPFS:", error);
      throw error;
    }
  };
  
  export const downloadFromIPFS = async (cid) => {
    try {
      const downloadResult = await window.electronAPI.downloadFromIPFS(cid);
      if (!downloadResult.success) {
        throw new Error(downloadResult.error);
      }
      return downloadResult;
    } catch (error) {
      console.error("Error downloading from IPFS:", error);
      throw error;
    }
  };
  