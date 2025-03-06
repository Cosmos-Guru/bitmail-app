import React, { useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { QRCodeCanvas } from 'qrcode.react';

const QRCodePanel = ({ walletAddress, accountInfo, appendLog, onPromptForUsername }) => {
  const qrRef = useRef(null);

  // Construct the QR code value as a JSON string.
  // Note: Replace the public_key value with a dynamic value if needed.
  const qrValue = JSON.stringify({
    btml_address: walletAddress,
    public_key: "AmD1Xt109BRRPYqpruiGTwsXNHY1Hzb5t1K+D9IlziWc",
    user_name: accountInfo.userName,
    gravitar_image_link: ""
  });

  const downloadQRCode = () => {
    if (qrRef.current) {
      // Find the canvas element rendered by QRCodeCanvas
      const canvas = qrRef.current.querySelector('canvas');
      if (canvas) {
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        // Use the username in the filename if available, fallback to "qr_code.png"
        const fileName = accountInfo.userName && accountInfo.userName.trim() !== ""
          ? `${accountInfo.userName}.png`
          : 'qr_code.png';
        link.download = fileName;
        link.href = dataURL;
        link.click();
        appendLog("QR Code downloaded as " + fileName);
      } else {
        appendLog("QR Code canvas not found.");
      }
    }
  };

  return (
    <Box sx={{ textAlign: 'center', mt: 2 }}>
      <Typography variant="h5" gutterBottom>
        Download QR Code
      </Typography>
      {walletAddress ? (
        accountInfo.userName && accountInfo.userName.trim() !== "" ? (
          <Box>
            {/* Hidden QR code canvas */}
            <Box
              ref={qrRef}
              sx={{ display: 'inline-block', visibility: 'hidden', position: 'absolute' }}
            >
              <QRCodeCanvas value={qrValue} size={256} />
            </Box>
            <Button variant="contained" onClick={downloadQRCode}>
              Download QR Code
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography variant="body1">
              Please set up your Account Info to generate your QR Code.
            </Typography>
            <Button variant="outlined" onClick={onPromptForUsername} sx={{ mt: 1 }}>
              Set Username
            </Button>
          </Box>
        )
      ) : (
        <Typography variant="body1">Wallet not logged in.</Typography>
      )}
    </Box>
  );
};

export default QRCodePanel;
