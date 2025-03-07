
  /*
  ipcMain.handle('readFriendQRCode', async (event) => {
  try {
    // Step 1: Open a file dialog for the user to select an image.
    const win = BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp'] }]
    });
    if (result.canceled) {
      return {
        success: false,
        error: { code: "USER_CANCELLED", message: "User cancelled file selection", details: "" }
      };
    }
    
    const filePath = result.filePaths[0];
    console.log('[Electron.readFriendQRCode] Selected file:', filePath);
    
    // Step 2: Ensure file exists
    if (!fs.existsSync(filePath)) {
      console.error('[Electron.readFriendQRCode] File does not exist:', filePath);
      return {
        success: false,
        error: { code: "FILE_NOT_FOUND", message: "Selected file does not exist", details: filePath }
      };
    }
    
    // Step 3: Read the file as a buffer
    const buffer = fs.readFileSync(filePath);
    
    // Step 4: Load the image using Jimp
    const Jimp = require('jimp');
    const image = await Jimp.read(buffer);
    console.log('[Electron.readFriendQRCode] Loaded image. Dimensions:', image.bitmap.width, 'x', image.bitmap.height);
    
    // Step 5: Decode the QR code using qrcode-reader
    const QrCodeReader = require('qrcode-reader');
    const qr = new QrCodeReader();
    const qrResult = await new Promise((resolve, reject) => {
      qr.callback = (err, res) => {
        if (err) return reject(err);
        resolve(res);
      };
      qr.decode(image.bitmap);
    });
    
    if (!qrResult || !qrResult.result) {
      console.error('[Electron.readFriendQRCode] No QR code found in image.');
      return {
        success: false,
        error: { code: "NO_QR_FOUND", message: "No QR code found in image", details: "qrcode-reader returned no result" }
      };
    }
    
    console.log('[Electron.readFriendQRCode] Decoded QR code data:', qrResult.result);
    
    // Step 6: Parse the decoded QR code data as JSON
    let friend;
    try {
      friend = JSON.parse(qrResult.result);
    } catch (parseError) {
      return {
        success: false,
        error: { code: "INVALID_QR_DATA", message: "QR code does not contain valid JSON", details: parseError.message }
      };
    }
    
    // Step 7: Validate the friend object format
    if (
      typeof friend === 'object' &&
      friend !== null &&
      typeof friend.btml_address === 'string' &&
      typeof friend.public_key === 'string'
    ) {
      return { success: true, friend };
    } else {
      return {
        success: false,
        error: { 
          code: "INVALID_FRIEND_DATA", 
          message: "QR code does not contain valid friend data", 
          details: "Missing required fields or incorrect data types" 
        }
      };
    }
  } catch (error) {
    console.error('[Electron.readFriendQRCode] Detailed error:', error);
    return {
      success: false,
      error: { code: "READ_QR_FAILED", message: "Failed to read friend QR code", details: error.stack || error.message }
    };
  }
});


ipcMain.handle('readFriendQRCode', async (event) => {
  try {
    // Step 1: Open a file dialog for the user to select an image.
    const win = BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp'] }]
    });
    if (result.canceled) {
      return {
        success: false,
        error: { code: "USER_CANCELLED", message: "User cancelled file selection", details: "" }
      };
    }
    
    const filePath = result.filePaths[0];
    console.log('[Electron.readFriendQRCode] Selected file:', filePath);
    
    // Step 2: Ensure file exists
    if (!fs.existsSync(filePath)) {
      console.error('[Electron.readFriendQRCode] File does not exist:', filePath);
      return {
        success: false,
        error: { code: "FILE_NOT_FOUND", message: "Selected file does not exist", details: filePath }
      };
    }
    
    // Step 3: Read the file as a buffer
    const buffer = fs.readFileSync(filePath);
    
    // Step 4: Load the image using Jimp
    const Jimp = require('jimp');
    const image = await Jimp.read(buffer);
    console.log('[Electron.readFriendQRCode] Loaded image. Dimensions:', image.bitmap.width, 'x', image.bitmap.height);
    
    // Step 5: Decode the QR code using qrcode-reader
    const QrCodeReader = require('qrcode-reader');
    const qr = new QrCodeReader();
    const qrResult = await new Promise((resolve, reject) => {
      qr.callback = (err, res) => {
        if (err) return reject(err);
        resolve(res);
      };
      qr.decode(image.bitmap);
    });
    
    if (!qrResult || !qrResult.result) {
      console.error('[Electron.readFriendQRCode] No QR code found in image.');
      return {
        success: false,
        error: { code: "NO_QR_FOUND", message: "No QR code found in image", details: "qrcode-reader returned no result" }
      };
    }
    
    console.log('[Electron.readFriendQRCode] Decoded QR code data:', qrResult.result);
    
    // Step 6: Parse the decoded QR code data as JSON
    let friend;
    try {
      friend = JSON.parse(qrResult.result);
    } catch (parseError) {
      return {
        success: false,
        error: { code: "INVALID_QR_DATA", message: "QR code does not contain valid JSON", details: parseError.message }
      };
    }
    
    // Step 7: Validate the friend object format
    if (
      typeof friend === 'object' &&
      friend !== null &&
      typeof friend.btml_address === 'string' &&
      typeof friend.public_key === 'string'
    ) {
      return { success: true, friend };
    } else {
      return {
        success: false,
        error: { 
          code: "INVALID_FRIEND_DATA", 
          message: "QR code does not contain valid friend data", 
          details: "Missing required fields or incorrect data types" 
        }
      };
    }
  } catch (error) {
    console.error('[Electron.readFriendQRCode] Detailed error:', error);
    return {
      success: false,
      error: { code: "READ_QR_FAILED", message: "Failed to read friend QR code", details: error.stack || error.message }
    };
  }
});
*/