import React from 'react';
import { Typography, List, ListItem, ListItemText, Button } from '@mui/material';

const FriendsPanel = ({ friends, handleDeleteFriend, handleAddFriend }) => {
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
      <Button variant="contained" onClick={handleAddFriend}>
        Add Friend
      </Button>
    </div>
  );
};

export default FriendsPanel;
