// src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import eccrypto from 'eccrypto';
import { createWalletFromMnemonic, connect, sendTokens } from './cosmos';
const config = require('./config.js');

// Constants: assume 1 BTML = 1e6 ubtml
const MICRO_DENOM = 'ubtml';
const CONVERSION_FACTOR = 1e6;

function generateRandomFilename() {
  const length = 14;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result + '.bin';
}

function App() {
  const [mnemonic, setMnemonic] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [client, setClient] = useState(null);
  const [balance, setBalance] = useState('0.000000');
  const [log, setLog] = useState('');
  const [selectedTab, setSelectedTab] = useState('Wallet');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [msgTo, setMsgTo] = useState('');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');

  const appendLog = (message) => {
    console.log(message);
    setLog((prev) => prev + '\n' + message);
  };

  // Login handler: create wallet, log address and sample curl command, then connect.
  const handleLogin = async () => {
    appendLog('Starting login process...');
    try {
      appendLog('Creating wallet from mnemonic...');
      const wallet = await createWalletFromMnemonic(mnemonic);
      const accounts = await wallet.getAccounts();
      const generatedAddress = accounts[0].address;
      appendLog('Wallet created. Generated wallet address: ' + generatedAddress);
      const sampleCurl = `curl -X GET "${config.COSMOS_API}/cosmos/bank/v1beta1/balances/${generatedAddress}" -H "accept: application/json"`;
      appendLog(`Sample curl command to check balance:\n${sampleCurl}`);
      appendLog('Connecting to chain using wallet...');
      const { client: stargateClient, address } = await connect(wallet);
      appendLog(`Connected to chain. Wallet address (should match): ${address}`);
      setClient(stargateClient);
      setWalletAddress(address);
      appendLog('Login successful.');
    } catch (error) {
      console.error('Error during login:', error);
      appendLog(`Error logging in: ${error.message}`);
    }
  };

  // Fetch balance using the Cosmos client.
  const fetchBalance = useCallback(async () => {
    try {
      if (client && walletAddress) {
        appendLog(`Fetching balance for address: ${walletAddress}`);
        const bal = await client.getBalance(walletAddress, MICRO_DENOM);
        appendLog('Raw balance response: ' + JSON.stringify(bal));
        const btml = parseFloat(bal.amount) / CONVERSION_FACTOR;
        appendLog(`Computed balance: ${btml.toFixed(6)} BTML`);
        setBalance(btml.toFixed(6));
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      appendLog(`Error fetching balance: ${error.message}`);
    }
  }, [client, walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      fetchBalance();
      const interval = setInterval(fetchBalance, 15000);
      return () => clearInterval(interval);
    }
  }, [walletAddress, fetchBalance]);

  const handleSend = async () => {
    if (!client || !walletAddress) {
      appendLog('You must log in first.');
      return;
    }
    try {
      appendLog(`Sending tokens from ${walletAddress} to ${toAddress} with amount ${amount}`);
      const result = await sendTokens(client, walletAddress, toAddress, amount);
      appendLog(`Transaction successful:\n${JSON.stringify(result, null, 2)}`);
      fetchBalance();
    } catch (error) {
      console.error('Error sending tokens:', error);
      appendLog(`Transaction failed: ${error.message}`);
    }
  };

  // Custom replacer to convert BigInt to string for JSON.stringify.
  const bigintReplacer = (_, value) =>
    typeof value === "bigint" ? value.toString() : value;

  const handleSendMessage = async () => {
    if (!client || !walletAddress) {
      appendLog('You must log in first.');
      return;
    }
    if (!msgTo || !msgBody) {
      appendLog('Please enter recipient address and message.');
      return;
    }
    try {
      appendLog(`Fetching public key for recipient: ${msgTo.trim()}`);
      const pubKeyData = await window.electronAPI.fetchPublicKey(msgTo.trim());
      appendLog('Received public key data: ' + JSON.stringify(pubKeyData));

      // Handle multiple possible response structures.
      // Use info, then account, then the top-level object.
      const recipientInfo = pubKeyData.info || pubKeyData.account || pubKeyData;

      // Check if the public key is nested as pub_key.key or provided directly as key.
      let recipientKey;
      if (recipientInfo.pub_key && recipientInfo.pub_key.key) {
        recipientKey = recipientInfo.pub_key.key;
      } else if (recipientInfo.key) {
        recipientKey = recipientInfo.key;
      }

      if (!recipientKey || recipientKey.toLowerCase() === 'null') {
        appendLog('Public Key not available for recipient.');
        return;
      }

      const recipientPubKeyBuffer = Buffer.from(recipientKey, 'base64');

      // Encrypt the message.
      const fullMessage = `Subject: ${msgSubject}\n\n${msgBody}`;
      appendLog('Encrypting message: ' + fullMessage);
      const encryptedMessageObj = await eccrypto.encrypt(
        recipientPubKeyBuffer,
        Buffer.from(fullMessage, 'utf8')
      );
      const encryptedMessage = JSON.stringify({
        iv: encryptedMessageObj.iv.toString('base64'),
        ephemPublicKey: encryptedMessageObj.ephemPublicKey.toString('base64'),
        ciphertext: encryptedMessageObj.ciphertext.toString('base64'),
        mac: encryptedMessageObj.mac.toString('base64'),
      });
      appendLog('Encrypted message: ' + encryptedMessage);

      // Write the encrypted message to a local .bin file.
      appendLog('Generating random .bin filename...');
      const filename = generateRandomFilename();
      appendLog(`Random filename generated: ${filename}`);
      const fileWriteResult = await window.electronAPI.writeEncryptedFile(filename, encryptedMessage);
      if (!fileWriteResult.success) {
        appendLog(`File write error: ${fileWriteResult.error}`);
        return;
      }
      appendLog(`File written successfully: ${fileWriteResult.filePath}`);

      // Read file contents back.
      appendLog('Reading file contents for upload...');
      const readResult = await window.electronAPI.readFile(fileWriteResult.filePath);
      if (!readResult.success) {
        appendLog(`File read error: ${readResult.error}`);
        return;
      }
      // Convert file contents string to Buffer.
      const fileContentsBuffer = Buffer.from(readResult.data, 'utf8');
      appendLog('File contents read successfully.');

      // Upload the file contents to IPFS via IPC.
      appendLog('Uploading file contents to IPFS...');
      const ipfsUploadResult = await window.electronAPI.uploadToIPFS(fileContentsBuffer.toString('utf8'));
      if (!ipfsUploadResult.success) {
        appendLog(`IPFS upload error: ${ipfsUploadResult.error}`);
        return;
      }
      const ipfsHash = ipfsUploadResult.cid;
      appendLog(`IPFS hash (CID) received: ${ipfsHash}`);

      // Delete the local file.
      appendLog('Deleting local file...');
      const deleteResult = await window.electronAPI.deleteFile(fileWriteResult.filePath);
      if (!deleteResult.success) {
        appendLog(`File deletion error: ${deleteResult.error}`);
      } else {
        appendLog('Local file deleted successfully.');
      }

      // Encrypt the IPFS CID using the recipient's public key.
      appendLog('Encrypting IPFS CID with recipient public key...');
      const encryptedHashObj = await eccrypto.encrypt(
        recipientPubKeyBuffer,
        Buffer.from(ipfsHash, 'utf8')
      );
      const encryptedHash = JSON.stringify({
        iv: encryptedHashObj.iv.toString('base64'),
        ephemPublicKey: encryptedHashObj.ephemPublicKey.toString('base64'),
        ciphertext: encryptedHashObj.ciphertext.toString('base64'),
        mac: encryptedHashObj.mac.toString('base64'),
      });
      appendLog('Encrypted IPFS CID: ' + encryptedHash);

      // Broadcast the transaction with the encrypted IPFS CID.
      appendLog('Sending message transaction...');
      const msg = {
        typeUrl: '/bitmail.ehl.MsgCreateHashCid',
        value: {
          creator: walletAddress,
          receiver: msgTo.trim(),
          hashlink: encryptedHash,
          vaultid: "",
        },
      };
      const fee = {
        amount: [{ denom: MICRO_DENOM, amount: '2000' }],
        gas: '200000',
      };
      const txResult = await client.signAndBroadcast(walletAddress, [msg], fee, 'Send Message');
      // Use a custom replacer to convert BigInt values to strings.
      const txResultStr = JSON.stringify(txResult, bigintReplacer, 2);
      appendLog(`Message TX result:\n${txResultStr}\nPlease wait 30 seconds and check your balance.`);
    } catch (error) {
      console.error('Error sending message:', error);
      appendLog(`Send message error: ${error.message}`);
    }
  };

  if (!walletAddress) {
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
            <Button variant="contained" color="primary" onClick={handleLogin} fullWidth sx={{ mt: 2 }}>
              Login
            </Button>
            {log && <Typography variant="body2" sx={{ mt: 2 }}>{log}</Typography>}
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h3" align="center" gutterBottom>
        Bitmail Dashboard
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <List>
                {['Wallet', 'Inbox - Coming Soon', 'Vault', 'Faucet', 'Message'].map((text) => (
                  <ListItem key={text} disablePadding>
                    <ListItemButton selected={selectedTab === text} onClick={() => setSelectedTab(text)}>
                      <ListItemText primary={text} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={9}>
          <Card variant="outlined">
            <CardContent>
              {selectedTab === 'Wallet' && (
                <>
                  <Typography variant="h5" gutterBottom>
                    Wallet
                  </Typography>
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
                      label="Amount (in micro-denom)"
                      fullWidth
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      margin="normal"
                    />
                    <Button variant="contained" color="secondary" onClick={handleSend} fullWidth sx={{ mt: 2 }}>
                      Send Tokens
                    </Button>
                  </Box>
                </>
              )}
              {selectedTab === 'Inbox - Coming Soon' && (
                <Typography variant="h5" gutterBottom>Inbox (Coming Soon)</Typography>
              )}
              {selectedTab === 'Vault' && (
                <Typography variant="h5" gutterBottom>Vault</Typography>
              )}
              {selectedTab === 'Faucet' && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" gutterBottom>Faucet</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    Request 100 ubtml to your wallet: {walletAddress}
                  </Typography>
                  <Button
                    variant="contained"
                    color="success"
                    sx={{ fontSize: '1.2rem', padding: '1rem 2rem' }}
                    onClick={async () => {
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
                    }}
                  >
                    Request Tokens
                  </Button>
                </Box>
              )}
              {selectedTab === 'Message' && (
                <Box>
                  <Typography variant="h5" gutterBottom>Send Message</Typography>
                  <TextField
                    label="Send To (Recipient Address)"
                    fullWidth
                    value={msgTo}
                    onChange={(e) => setMsgTo(e.target.value)}
                    margin="normal"
                  />
                  <TextField
                    label="Subject"
                    fullWidth
                    value={msgSubject}
                    onChange={(e) => setMsgSubject(e.target.value)}
                    margin="normal"
                  />
                  <TextField
                    label="Message"
                    fullWidth
                    multiline
                    rows={6}
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    margin="normal"
                  />
                  <Button variant="contained" color="primary" onClick={handleSendMessage} fullWidth sx={{ mt: 2 }}>
                    Send Message
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6">Log</Typography>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', backgroundColor: '#333', color: 'white', p: 2, borderRadius: 1 }}>
          {log}
        </Typography>
      </Box>
    </Container>
  );
}

export default App;
