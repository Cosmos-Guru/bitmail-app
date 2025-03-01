import React from 'react';
import { Box, Typography } from '@mui/material';
import { QRCodeCanvas } from 'qrcode.react';

const QRCodePanel = ({ walletAddress, accountInfo, appendLog, handleDownloadQRCode }) => {
  return (
    <div>
      <Typography variant="h5" align="center" gutterBottom>
        QR Code
      </Typography>
      {walletAddress ? (
        accountInfo.userName ? (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <QRCodeCanvas
              value={JSON.stringify({
                btml_address: walletAddress,
                public_key: "", // Extend later if needed.
                user_name: accountInfo.userName,
                gravitar_image_link: ""
              })}
              size={256}
            />
          </Box>
        ) : (
          <Typography variant="body1" align="center">
            Please set up your Account Info to generate your QR Code.
          </Typography>
        )
      ) : (
        <Typography variant="body1" align="center">
          Wallet not logged in.
        </Typography>
      )}
    </div>
  );
};

export default QRCodePanel;
