import React from 'react';
import { Container, Card, CardContent, Typography, TextField, Button } from '@mui/material';

const LoginPanel = ({ mnemonic, setMnemonic, password, setPassword, handleLogin, log }) => {
  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h4" align="center" gutterBottom>
            Login
          </Typography>
          <TextField
            label="Mnemonic"
            multiline
            rows={3}
            fullWidth
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            margin="normal"
          />
          <TextField
            label="Password (for mnemonic encryption)"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
          />
          <Button variant="contained" color="primary" onClick={handleLogin} fullWidth sx={{ mt: 2 }}>
            Login
          </Button>
          {log && <Typography variant="body2" sx={{ mt: 2 }}>{log}</Typography>}
        </CardContent>
      </Card>
    </Container>
  );
};

export default LoginPanel;
