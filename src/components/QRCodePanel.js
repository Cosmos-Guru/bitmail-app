import React, { useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { QRCodeCanvas } from 'qrcode.react';

const QRCodePanel = ({ walletAddress, accountInfo, appendLog, onPromptForUsername }) => {
  const qrRef = useRef(null);

  // Construct the QR code value as a JSON string.
  const qrValue = JSON.stringify({
    btml_address: walletAddress,
    public_key: "AmD1Xt109BRRPYqpruiGTwsXNHY1Hzb5t1K+D9IlziWc",
    user_name: accountInfo.userName,
    gravitar_image_link: ""
  });

  const downloadQRCode = () => {
    if (qrRef.current) {
      const canvas = qrRef.current.querySelector('canvas');
      if (canvas) {
        // Important: Increase resolution and force PNG type
        const dataURL = canvas.toDataURL('image/png', 1.0);  // Highest quality PNG

        const link = document.createElement('a');
        const fileName = accountInfo.userName?.trim()
          ? `${accountInfo.userName}.png`
          : 'qr_code.png';

        link.download = fileName;
        link.href = dataURL;
        link.click();

        appendLog(`QR Code downloaded as ${fileName}`);
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
        accountInfo.userName?.trim() ? (
          <Box>
            {/* QR Canvas is now visible, high contrast, and high res */}
            <Box
              ref={qrRef}
              sx={{
                display: 'inline-block',
                width: 512,
                height: 512,
                backgroundColor: '#FFFFFF',
              }}
            >
              <QRCodeCanvas
                value={qrValue}
                size={512}              // Larger size for better scan readability
                level="H"                // High error correction for robustness
                bgColor="#FFFFFF"        // Pure white background
                fgColor="#000000"        // Pure black foreground
              />
            </Box>
            <Button variant="contained" onClick={downloadQRCode} sx={{ mt: 2 }}>
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

