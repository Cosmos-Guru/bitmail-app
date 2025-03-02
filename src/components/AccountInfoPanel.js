// src/components/AccountInfoPanel.js
import React from 'react';
import { Typography, TextField, Button } from '@mui/material';

const AccountInfoPanel = ({
  walletAddress,
  accountInfo,
  editingUserName,
  tempUserName,
  setTempUserName,
  handleSaveUserName,
  handleCancelEditUserName,
  toggleEditUserName,
}) => {
  return (
    <div>
      <Typography variant="h5">Account Information</Typography>
      <Typography variant="body1">Wallet Address: {walletAddress}</Typography>
      <Typography variant="body1">
        User Name: {accountInfo.userName || "Not set"}
      </Typography>
      {editingUserName ? (
        <>
          <TextField
            fullWidth
            label="User Name"
            value={tempUserName}
            onChange={(e) => setTempUserName(e.target.value)}
            margin="normal"
          />
          <Button variant="contained" color="primary" onClick={handleSaveUserName}>
            Save
          </Button>
          <Button variant="outlined" onClick={handleCancelEditUserName} sx={{ ml: 2 }}>
            Cancel
          </Button>
        </>
      ) : (
        <Button variant="contained" onClick={toggleEditUserName}>
          {accountInfo.userName ? "Edit" : "+ Add"}
        </Button>
      )}
      {/* QR Code button removed as requested */}
    </div>
  );
};

export default AccountInfoPanel;
