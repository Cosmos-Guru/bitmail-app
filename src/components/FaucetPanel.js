import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import config from '../config';

const FaucetPanel = ({ walletAddress, appendLog }) => {
  const requestTokens = async () => {
    try {
      const body = { address: walletAddress, coins: ['100ubtml'] };
      const response = await fetch(config.FAUCET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      appendLog(`Faucet request sent for 100ubtml to ${walletAddress}. Please wait 30 seconds and check your account balance.`);
    } catch (error) {
      appendLog(`Faucet request error: ${error.message}`);
    }
  };

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom>Faucet</Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>
        Request 100 ubtml to your wallet: {walletAddress}
      </Typography>
      <Button variant="contained" color="success" fullWidth onClick={requestTokens}>
        Request Tokens
      </Button>
    </Box>
  );
};

export default FaucetPanel;
