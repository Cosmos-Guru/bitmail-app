import React from 'react';
import { Typography, TextField, Button } from '@mui/material';

const MessagePanel = ({ msgTo, setMsgTo, msgSubject, setMsgSubject, msgBody, setMsgBody, handleSendMessage }) => {
  return (
    <div>
      <Typography variant="h5" gutterBottom>Send Message</Typography>
      <TextField
        fullWidth
        label="To Address"
        value={msgTo}
        onChange={(e) => setMsgTo(e.target.value)}
        margin="normal"
      />
      <TextField
        fullWidth
        label="Subject"
        value={msgSubject}
        onChange={(e) => setMsgSubject(e.target.value)}
        margin="normal"
      />
      <TextField
        fullWidth
        label="Message Body"
        multiline
        rows={4}
        value={msgBody}
        onChange={(e) => setMsgBody(e.target.value)}
        margin="normal"
      />
      <Button variant="contained" color="primary" onClick={handleSendMessage}>
        Send Message
      </Button>
    </div>
  );
};

export default MessagePanel;
