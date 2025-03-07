import React, { useRef } from 'react';
import { Typography, List, ListItem, ListItemText, Button } from '@mui/material';
import QrScanner from 'qr-scanner';

// Set the path to the worker script (adjust if needed – here we assume it's in the public folder)
QrScanner.WORKER_PATH = 'qr-scanner-worker.min.js';

const FriendsPanel = ({ friends, handleDeleteFriend, handleAddFriend }) => {
  // Create a ref for the hidden file input element.
  const fileInputRef = useRef(null);

  // Trigger the file input when the "Add Friend" button is clicked.
  const onAddFriend = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = null; // Reset in case the same file is selected again.
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
        // Call the parent callback to add the friend (and persist it).
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
    <div>
      <Typography variant="h5">Friends List</Typography>
      <List>
        {friends.map((friend) => (
          <ListItem key={friend.btml_address} divider>
            <ListItemText
              primary={friend.user_name || friend.btml_address}
              secondary={friend.btml_address}
            />
            <Button color="error" onClick={() => handleDeleteFriend(friend)}>
              Delete
            </Button>
          </ListItem>
        ))}
      </List>
      <Button variant="contained" onClick={onAddFriend}>
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
    </div>
  );
};

export default FriendsPanel;
