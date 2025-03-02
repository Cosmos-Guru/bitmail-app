// File: src/App.js
// Lines 1-50: Imports and helper functions
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Box, Typography, Card, CardContent, Grid, Button } from '@mui/material';
import * as bip39 from 'bip39';
import * as config from './config';
import { createWalletFromMnemonic, connect, sendTokens } from './cosmos';
import NavigationSidebar from './components/NavigationSidebar';
import LoginPanel from './components/LoginPanel';
import WalletPanel from './components/WalletPanel';
import MessagePanel from './components/MessagePanel';
import AccountInfoPanel from './components/AccountInfoPanel';
import FaucetPanel from './components/FaucetPanel';
import FriendsPanel from './components/FriendsPanel';
import QRCodePanel from './components/QRCodePanel';
import { 
  hasMnemonicStored, saveMnemonic, retrieveMnemonic, loadAccountInfo, loadFriendsList,
  fetchPublicKey, writeEncryptedFile, readFile, deleteFile, uploadToIPFS, downloadQRCode, downloadFromIPFS 
} from './ipc/handlers';
import eccrypto from 'eccrypto';
import * as utxo from '@bitgo/utxo-lib';

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

const derivePrivKey = (mnemonic) => {
  try {
    const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
    const root = utxo.bip32.fromSeed(seed);
    const child = root.derivePath("m/44'/118'/0'/0/0");
    return child.privateKey;
  } catch (error) {
    console.error("Error deriving private key:", error);
    return null;
  }
};

// Lines ~50-90: App Component and state declarations
function App() {
  // State declarations (ensure wallet and setWallet are declared)
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [client, setClient] = useState(null);
  const [balance, setBalance] = useState('0.000000');
  const [log, setLog] = useState('');
  const [selectedTab, setSelectedTab] = useState('Account Info');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [msgTo, setMsgTo] = useState('');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [privateKey, setPrivateKey] = useState(null);
  const [hasMnemonicState, setHasMnemonicState] = useState(false);
  const [accountInfo, setAccountInfo] = useState({ userName: "" });
  const [editingUserName, setEditingUserName] = useState(false);
  const [tempUserName, setTempUserName] = useState("");
  const [friends, setFriends] = useState([]);
  const [inboxMessages, setInboxMessages] = useState([]);
  // <<-- This was missing before: declare wallet state -->
  const [wallet, setWallet] = useState(null);

  const appendLog = useCallback((message) => {
    console.log(message);
    setLog((prev) => prev + '\n' + message);
  }, []);

  // Lines ~90-110: Check if mnemonic is stored on initial load
  useEffect(() => {
    const checkMnemonic = async () => {
      try {
        const mnemonicExists = await hasMnemonicStored();
        setHasMnemonicState(mnemonicExists);
      } catch (error) {
        console.error("Error checking mnemonic storage:", error);
        appendLog(`Error checking mnemonic storage: ${error.message}`);
      }
    };
    checkMnemonic();
  }, [appendLog]);

  // Lines ~110-130: Load account info when walletAddress becomes available
  const loadAccInfo = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const result = await loadAccountInfo(walletAddress);
      if (result.success) {
        setAccountInfo(result.accountInfo);
        setTempUserName(result.accountInfo.userName);
        appendLog("Account info loaded.");
      } else {
        appendLog("Failed to load account info: " + result.error);
      }
    } catch (error) {
      console.error("Error loading account info:", error);
      appendLog("Error loading account info: " + error.message);
    }
  }, [walletAddress, appendLog]);

  const toggleEditUserName = () => {
    setTempUserName(accountInfo.userName);
    setEditingUserName(true);
  };

  const handleSaveUserName = async () => {
    const trimmedName = tempUserName.slice(0, 44);
    const newAccountInfo = { ...accountInfo, userName: trimmedName };
    const saveResp = await window.electronAPI.saveAccountInfo({ walletAddress, accountInfo: newAccountInfo });
    if (saveResp.success) {
      setAccountInfo(newAccountInfo);
      appendLog('Username saved.');
    } else {
      appendLog('Error saving username: ' + saveResp.error);
    }
    setEditingUserName(false);
  };

  const handleCancelEditUserName = () => {
    setTempUserName(accountInfo.userName);
    setEditingUserName(false);
  };

  // Lines ~130-170: Inbox Functions
  const fetchInboxMessages = async () => {
    if (!walletAddress) return;
    try {
      const response = await fetch(`${config.COSMOS_API}/bitmail/ehl/hash_cid_by_receiver/${walletAddress}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      if (data.hashCid) {
        data.hashCid.sort((a, b) => parseInt(b.id) - parseInt(a.id));
        setInboxMessages(data.hashCid);
      }
    } catch (error) {
      appendLog("Error fetching inbox messages: " + error.message);
    }
  };

  useEffect(() => {
    if (selectedTab === 'Inbox' && walletAddress) {
      fetchInboxMessages();
      const interval = setInterval(fetchInboxMessages, 15000);
      return () => clearInterval(interval);
    }
  }, [selectedTab, walletAddress]);

  // Lines ~170-210: Updated handleViewMessage with decryption steps
  const handleViewMessage = async (msg) => {
    try {
      appendLog("Viewing message with ID: " + msg.id);
      // Step 1: Decrypt the hashlink to get the plain IPFS CID.
      const encryptedHashlink = JSON.parse(msg.hashlink);
      const decryptedBuffer = await eccrypto.decrypt(privateKey, {
        iv: Buffer.from(encryptedHashlink.iv, 'base64'),
        ephemPublicKey: Buffer.from(encryptedHashlink.ephemPublicKey, 'base64'),
        ciphertext: Buffer.from(encryptedHashlink.ciphertext, 'base64'),
        mac: Buffer.from(encryptedHashlink.mac, 'base64')
      });
      const ipfsCid = decryptedBuffer.toString('utf8').trim();
      appendLog("Decrypted IPFS CID: " + ipfsCid);
      
      // Step 2: Download the encrypted message from IPFS using the decrypted CID.
      const downloadResult = await downloadFromIPFS(ipfsCid);
      if (!downloadResult.success) {
        appendLog("Error downloading message: " + JSON.stringify(downloadResult.error));
        return;
      }
      
      // Step 3: Decrypt the downloaded message.
      // We assume the downloaded content is a JSON string with encrypted message data.
      const encryptedMessageData = JSON.parse(downloadResult.data);
      const decryptedMsgBuffer = await eccrypto.decrypt(privateKey, {
        iv: Buffer.from(encryptedMessageData.iv, 'base64'),
        ephemPublicKey: Buffer.from(encryptedMessageData.ephemPublicKey, 'base64'),
        ciphertext: Buffer.from(encryptedMessageData.ciphertext, 'base64'),
        mac: Buffer.from(encryptedMessageData.mac, 'base64')
      });
      const decryptedMsg = decryptedMsgBuffer.toString('utf8').trim();
      appendLog("Decrypted message: " + decryptedMsg);
      
      // Instead of showing a modal, embed the message in the Message tab.
      setMsgBody(decryptedMsg);
      setSelectedTab('Message');
    } catch (error) {
      appendLog("Error viewing message: " + (typeof error === 'object' ? JSON.stringify(error) : error));
    }
  };

  const handleSendBitmail = (friendAddress) => {
    setMsgTo(friendAddress);
    setSelectedTab('Message');
  };

  const handleSendBTMLToken = (friendAddress) => {
    setToAddress(friendAddress);
    setSelectedTab('Wallet');
  };

  // Lines ~210-280: Login and Wallet Functions
  const handleLogin = async () => {
    appendLog('Starting login process...');
    try {
      const mnemonicToUse = mnemonic.trim();
      if (!hasMnemonicState) {
        appendLog('No mnemonic found, saving new mnemonic...');
        const saveResult = await saveMnemonic(mnemonicToUse, password);
        if (saveResult.success) {
          setHasMnemonicState(true);
          appendLog('Mnemonic saved successfully.');
        } else {
          appendLog(`Error saving mnemonic: ${saveResult.error}`);
          return;
        }
      }
      appendLog('Retrieving mnemonic...');
      const retrievedResult = await retrieveMnemonic(password);
      if (retrievedResult.success) {
        const retrievedMnemonic = retrievedResult.mnemonic;
        if (bip39.validateMnemonic(retrievedMnemonic)) {
          const derivedPrivateKey = derivePrivKey(retrievedMnemonic);
          if (derivedPrivateKey) {
            setPrivateKey(derivedPrivateKey);
            setMnemonic('');
            appendLog('Creating wallet from mnemonic...');
            const wallet = await createWalletFromMnemonic(retrievedMnemonic);
            const accounts = await wallet.getAccounts();
            const generatedAddress = accounts[0].address;
            appendLog('Wallet created. Generated wallet address: ' + generatedAddress);
            appendLog(`Connecting to chain using wallet...`);
            if (config.COSMOS_API) {
              const { client: stargateClient, address } = await connect(wallet, config.COSMOS_API);
              appendLog(`Connected to chain. Wallet address (should match): ${address}`);
              setClient(stargateClient);
              setWalletAddress(address);
              setWallet(wallet);
              appendLog('Login successful.');
              await loadAccInfo();
              const friendsResp = await loadFriendsList(address);
              if (friendsResp.success) {
                setFriends(friendsResp.friends);
              } else {
                appendLog(`Error loading friends list: ${friendsResp.error}`);
              }
            } else {
              console.warn("config.COSMOS_API is missing");
              appendLog("config.COSMOS_API is missing");
            }
          } else {
            appendLog("Failed to derive private key.");
          }
        } else {
          appendLog("Retrieved mnemonic is invalid.");
        }
      } else {
        appendLog(`Error retrieving mnemonic: ${retrievedResult.error}`);
      }
    } catch (error) {
      console.error('Error during login:', error);
      appendLog(`Error logging in: ${error.message}`);
    }
  };

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
  }, [client, walletAddress, appendLog]);

  useEffect(() => {
    if (walletAddress) {
      fetchBalance();
      const interval = setInterval(fetchBalance, 15000);
      return () => clearInterval(interval);
    }
  }, [walletAddress, fetchBalance]);

  // Lines ~280-300: Send Tokens Function
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

  // ----------------- End Send Tokens Function -----------------

  // Lines ~300-end: Render JSX
  if (!walletAddress) {
    return (
      <LoginPanel
        mnemonic={mnemonic}
        setMnemonic={setMnemonic}
        password={password}
        setPassword={setPassword}
        handleLogin={handleLogin}
        log={log}
      />
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h3" align="center" gutterBottom>
        BitMail Dashboard
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <NavigationSidebar
            tabs={['Account Info', 'Wallet', 'Faucet', 'Inbox', 'Message', 'Friends', 'QR Code']}
            selectedTab={selectedTab}
            onSelectTab={setSelectedTab}
          />
        </Grid>
        <Grid item xs={12} md={9}>
          <Card variant="outlined">
            <CardContent>
              {selectedTab === 'Wallet' && (
                <WalletPanel
                  walletAddress={walletAddress}
                  balance={balance}
                  toAddress={toAddress}
                  setToAddress={setToAddress}
                  amount={amount}
                  setAmount={setAmount}
                  handleSend={handleSend}
                />
              )}
              {selectedTab === 'Account Info' && (
                <AccountInfoPanel
                  walletAddress={walletAddress}
                  accountInfo={accountInfo}
                  editingUserName={editingUserName}
                  tempUserName={tempUserName}
                  setTempUserName={setTempUserName}
                  handleSaveUserName={handleSaveUserName}
                  handleCancelEditUserName={handleCancelEditUserName}
                  toggleEditUserName={toggleEditUserName}
                />
              )}
              {selectedTab === 'Faucet' && (
                <FaucetPanel walletAddress={walletAddress} appendLog={appendLog} />
              )}
              {selectedTab === 'Inbox' && (
                <Box sx={{ maxHeight: '400px', overflowY: 'auto', p: 1 }}>
                  <Typography variant="h5" gutterBottom>
                    Inbox
                  </Typography>
                  {inboxMessages.length === 0 ? (
                    <Typography variant="body1">No messages found.</Typography>
                  ) : (
                    inboxMessages.map((msg) => (
                      <Box key={msg.id} sx={{ borderBottom: '1px solid #ccc', py: 1 }}>
                        <Typography variant="body1">
                          <strong>From:</strong> {msg.creator}
                        </Typography>
                        <Typography variant="body2">
                          <strong>ID:</strong> {msg.id}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <Button
                            variant="contained"
                            onClick={() => handleViewMessage(msg)}
                            sx={{ mr: 1 }}
                          >
                            View Message
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => handleSendBitmail(msg.creator)}
                            sx={{ mr: 1 }}
                          >
                            Send Bitmail
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => handleSendBTMLToken(msg.creator)}
                          >
                            Send BTML Token
                          </Button>
                        </Box>
                      </Box>
                    ))
                  )}
                </Box>
              )}
              {selectedTab === 'Message' && (
                <MessagePanel
                  msgTo={msgTo}
                  setMsgTo={setMsgTo}
                  msgSubject={msgSubject}
                  setMsgSubject={setMsgSubject}
                  msgBody={msgBody}
                  setMsgBody={setMsgBody}
                />
              )}
              {selectedTab === 'Friends' && (
                <FriendsPanel
                  friends={friends}
                  handleDeleteFriend={(friend) => {
                    // Implement friend deletion logic here.
                  }}
                  handleAddFriend={() => {
                    // Implement friend addition logic here (e.g., open a QR upload dialog).
                  }}
                />
              )}
              {selectedTab === 'QR Code' && (
                <QRCodePanel
                  walletAddress={walletAddress}
                  accountInfo={accountInfo}
                  appendLog={appendLog}
                  handleDownloadQRCode={() => {
                    // Implement QR code download logic here.
                  }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6">Log</Typography>
        <Typography
          variant="body1"
          sx={{
            whiteSpace: 'pre-wrap',
            backgroundColor: '#333',
            color: 'white',
            p: 2,
            borderRadius: 1,
          }}
        >
          {log}
        </Typography>
      </Box>
    </Container>
  );
}

export default App;
