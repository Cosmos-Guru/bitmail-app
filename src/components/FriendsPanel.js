// src/components/FriendsPanel.js
import React, { useRef } from 'react';
import { Typography, List, ListItem, ListItemText, Button, Box } from '@mui/material';
import QrScanner from 'qr-scanner';

// Set the path to the worker script – adjust if needed (this assumes the worker script is in your public folder)
QrScanner.WORKER_PATH = 'qr-scanner-worker.min.js';

const FriendsPanel = ({ 
  friends, 
  handleDeleteFriend, 
  handleAddFriend, 
  handleSendBitmail, 
  handleSendBTMLToken 
}) => {
  const fileInputRef = useRef(null);

  // Trigger the file input when the "Add Friend" button is clicked.
  const onAddFriend = () => {
    if (fileInputRef.current) {
      // Reset the input so the same file can be re-selected if needed.
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
  };

  // When a file is selected, scan it for a QR code.
  const onFileSelected = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      alert("No file selected.");
      return;
    }
    try {
      // Use QrScanner to scan the image file.
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      console.log('[FriendsPanel] QR code result:', result.data);

      // Parse the decoded QR code data as JSON.
      let friend;
      try {
        friend = JSON.parse(result.data);
      } catch (parseError) {
        console.error("Error parsing QR code JSON:", parseError);
        alert("QR code does not contain valid JSON.");
        return;
      }

      // Validate the friend object format.
      if (
        typeof friend === 'object' &&
        friend !== null &&
        typeof friend.btml_address === 'string' &&
        typeof friend.public_key === 'string'
      ) {
        console.log('[FriendsPanel] Friend object parsed:', friend);
        // Call the parent callback to add the friend.
        handleAddFriend(friend);
      } else {
        alert("QR code does not contain valid friend data.");
      }
    } catch (error) {
      console.error("Error scanning QR code:", error);
      alert("Failed to scan QR code: " + error.message);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Friends List
      </Typography>
      <List>
        {friends.map((friend) => (
          <ListItem
            key={friend.btml_address}
            divider
            sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
          >
            <ListItemText
              primary={friend.user_name || friend.btml_address}
              secondary={friend.btml_address}
            />
            {/* Buttons on a new line */}
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => handleSendBitmail(friend.btml_address)}
              >
                Send Bitmail
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => handleSendBTMLToken(friend.btml_address)}
              >
                Send BTML Token
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => handleDeleteFriend(friend)}
              >
                Delete
              </Button>
            </Box>
          </ListItem>
        ))}
      </List>
      <Button variant="contained" onClick={onAddFriend} sx={{ mt: 2 }}>
        Add Friend
      </Button>
      {/* Hidden file input to trigger file selection */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={onFileSelected}
      />
    </Box>
  );
};

export default FriendsPanel;
