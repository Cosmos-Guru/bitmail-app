import React from 'react';
import { Box, Typography, TextField, Button } from '@mui/material';

const WalletPanel = ({ walletAddress, balance, toAddress, setToAddress, amount, setAmount, handleSend }) => {
  return (
    <div>
      <Typography variant="h5" gutterBottom>Wallet</Typography>
      <Typography variant="body1">Logged in as: {walletAddress}</Typography>
      <Box sx={{ mt: 2, mb: 2 }}>
        <Typography variant="subtitle1">Wallet Balance</Typography>
        <Typography variant="h6">{balance} BTML</Typography>
      </Box>
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1">Send Tokens</Typography>
        <TextField
          label="Recipient Address"
          fullWidth
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          margin="normal"
        />
        <TextField
          label="Amount (BTML)"
          fullWidth
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          margin="normal"
        />
        <Button variant="contained" color="primary" onClick={handleSend}>
          Send
        </Button>
      </Box>
    </div>
  );
};

export default WalletPanel;
