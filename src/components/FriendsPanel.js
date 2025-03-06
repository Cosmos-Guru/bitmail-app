import React from 'react';
import { Typography, List, ListItem, ListItemText, Button } from '@mui/material';
import { readFriendQRCode } from '../ipc/handlers';

const FriendsPanel = ({ friends, handleDeleteFriend, handleAddFriend }) => {
  const onAddFriend = async () => {
    try {
      // This will open a file dialog for the user to select a QR code image.
      const result = await readFriendQRCode();
      if (result.success) {
        // Call the parent function to add this friend to the list (and persist it)
        handleAddFriend(result.friend);
      } else {
        console.error("Error reading friend QR code:", result.error);
        alert("Could not read QR code: " + result.error.message);
      }
    } catch (error) {
      console.error("Error in onAddFriend:", error);
      alert("An error occurred while reading the QR code.");
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
    </div>
  );
};

export default FriendsPanel;
