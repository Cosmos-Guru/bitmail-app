// File: src/App.js
// Lines 1–50: Imports and helper functions
import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Modal
} from '@mui/material';
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
  hasMnemonicStored,
  saveMnemonic,
  retrieveMnemonic,
  loadAccountInfo,
  loadFriendsList,
  fetchPublicKey,
  writeEncryptedFile,
  readFile,
  deleteFile,
  uploadToIPFS,
  downloadQRCode,
  downloadFromIPFS
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

// Lines ~50–90: App Component and state declarations
function App() {
  // State declarations
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
  // currentMessage holds details of the selected inbox message.
  const [currentMessage, setCurrentMessage] = useState(null);
  // Wallet state.
  const [wallet, setWallet] = useState(null);
  // New state for message sending status modal.
  const [messageStatus, setMessageStatus] = useState('');
  const [showMessageStatus, setShowMessageStatus] = useState(false);

  const appendLog = useCallback((message) => {
    console.log(message);
    setLog((prev) => prev + '\n' + message);
  }, []);

  // Lines ~90–110: Check if mnemonic is stored on initial load
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

  // Lines ~110–130: Load account info when walletAddress becomes available
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

  // Lines ~130–170: Inbox Functions
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

  // Lines ~170–210: Updated handleViewMessage (Inbox view)
  const handleViewMessage = async (msg) => {
    try {
      appendLog("Viewing message with ID: " + msg.id);
      const encryptedHashlink = JSON.parse(msg.hashlink);
      const decryptedBuffer = await eccrypto.decrypt(privateKey, {
        iv: Buffer.from(encryptedHashlink.iv, 'base64'),
        ephemPublicKey: Buffer.from(encryptedHashlink.ephemPublicKey, 'base64'),
        ciphertext: Buffer.from(encryptedHashlink.ciphertext, 'base64'),
        mac: Buffer.from(encryptedHashlink.mac, 'base64')
      });
      const ipfsCid = decryptedBuffer.toString('utf8').trim();
      appendLog("Decrypted IPFS CID: " + ipfsCid);
      
      const downloadResult = await downloadFromIPFS(ipfsCid);
      if (!downloadResult.success) {
        appendLog("Error downloading message: " + JSON.stringify(downloadResult.error));
        return;
      }
      
      const encryptedMessageData = JSON.parse(downloadResult.data);
      const decryptedMsgBuffer = await eccrypto.decrypt(privateKey, {
        iv: Buffer.from(encryptedMessageData.iv, 'base64'),
        ephemPublicKey: Buffer.from(encryptedMessageData.ephemPublicKey, 'base64'),
        ciphertext: Buffer.from(encryptedMessageData.ciphertext, 'base64'),
        mac: Buffer.from(encryptedMessageData.mac, 'base64')
      });
      const decryptedMsg = decryptedMsgBuffer.toString('utf8').trim();
      appendLog("Decrypted message: " + decryptedMsg);
      
      // Parse the decrypted message into subject and body.
      const lines = decryptedMsg.split('\n');
      const subjectLine = lines[0] || "";
      const subject = subjectLine.replace(/^Subject:\s*/i, '').trim();
      const body = lines.slice(1).join('\n').trim();
      
      // For Inbox view, display only the message body.
      setCurrentMessage({
        sender: msg.creator,
        subject,
        originalBody: body, // for reply formatting
        body: body,
      });
    } catch (error) {
      appendLog("Error viewing message: " + (typeof error === 'object' ? JSON.stringify(error) : error));
    }
  };

  // New function: Reply from Inbox message box.
  const handleReplyFromInbox = () => {
    if (currentMessage) {
      setMsgTo(currentMessage.sender);
      setMsgSubject(`Re: ${currentMessage.subject}`);
      // Format the reply with a blank first line, then the header and original details.
      const replyContent = `\n----Original Message----\nFrom: ${currentMessage.sender}\nSubject: ${currentMessage.subject}\nMessage: ${currentMessage.originalBody}`;
      setMsgBody(replyContent);
      setSelectedTab('Message');
      setCurrentMessage(null);
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

  // Lines ~210–280: Login and Wallet Functions
  const handleLogin = async () => {
    appendLog('Starting login process...');
    try {
      const mnemonicToUse = mnemonic.trim();
      appendLog('Saving mnemonic...');
      const saveResult = await saveMnemonic(mnemonicToUse, password);
      if (saveResult.success) {
        setHasMnemonicState(true);
        appendLog('Mnemonic saved successfully.');
      } else {
        appendLog(`Error saving mnemonic: ${saveResult.error}`);
        return;
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

  // Lines ~280–300: Send Tokens Function
  const handleSend = async () => {
    if (!client || !walletAddress) {
      appendLog('You must log in first.');
      return;
    }
    try {
      appendLog(`Sending tokens from ${walletAddress} to ${toAddress} with amount ${amount}`);
      const result = await sendTokens(client, walletAddress, toAddress, amount);
      appendLog(`Transaction successful:\n${JSON.stringify(result, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}`);
      fetchBalance();
    } catch (error) {
      console.error('Error sending tokens:', error);
      appendLog(`Transaction failed: ${error.message}`);
    }
  };

  // New function: handleSendMessage (Send Bitmail message flow)
  const handleSendMessage = async () => {
    try {
      if (!client || !walletAddress || !msgTo || !msgSubject || !msgBody) {
        appendLog("All message fields must be filled out.");
        return;
      }
      
      // Show sending message modal
      setMessageStatus("Sending message, please wait...");
      setShowMessageStatus(true);
      
      appendLog(`Fetching public key for receiver: ${msgTo}`);
      // Use API endpoint to fetch receiver public key.
      const response = await fetch(`${config.COSMOS_API}/cosmos/auth/v1beta1/accounts/${msgTo}`);
      if (!response.ok) {
        setMessageStatus("");
        setShowMessageStatus(false);
        appendLog("Error fetching public key: HTTP " + response.status);
        return;
      }
      const data = await response.json();
      const receiverPubKey = data.account?.pub_key?.key;
      if (!receiverPubKey) {
        setMessageStatus("");
        setShowMessageStatus(false);
        appendLog("Receiver public key not found.");
        return;
      }
      appendLog("Receiver public key fetched.");
      
      const fullMessage = `Subject: ${msgSubject}\n\n${msgBody}`;
      const receiverPubKeyBuffer = Buffer.from(receiverPubKey, 'base64');
      
      // Encrypt the message with the receiver's public key.
      const encryptedMessageObj = await eccrypto.encrypt(receiverPubKeyBuffer, Buffer.from(fullMessage, 'utf8'));
      const encryptedMessageStr = JSON.stringify({
        iv: encryptedMessageObj.iv.toString('base64'),
        ephemPublicKey: encryptedMessageObj.ephemPublicKey.toString('base64'),
        ciphertext: encryptedMessageObj.ciphertext.toString('base64'),
        mac: encryptedMessageObj.mac.toString('base64')
      });
      appendLog("Uploading encrypted message to IPFS...");
      const uploadResult = await window.electronAPI.uploadToIPFS(encryptedMessageStr);
      if (!uploadResult.success) {
        setMessageStatus("");
        setShowMessageStatus(false);
        appendLog("Error uploading message to IPFS: " + uploadResult.error);
        return;
      }
      const ipfsCid = uploadResult.cid;
      appendLog("IPFS CID received: " + ipfsCid);
      
      // Encrypt the IPFS CID using the receiver's public key.
      const encryptedCidObj = await eccrypto.encrypt(receiverPubKeyBuffer, Buffer.from(ipfsCid, 'utf8'));
      const encryptedCidStr = JSON.stringify({
        iv: encryptedCidObj.iv.toString('base64'),
        ephemPublicKey: encryptedCidObj.ephemPublicKey.toString('base64'),
        ciphertext: encryptedCidObj.ciphertext.toString('base64'),
        mac: encryptedCidObj.mac.toString('base64')
      });
      appendLog("Sending message transaction...");
      const msgTx = {
        typeUrl: '/bitmail.ehl.MsgCreateHashCid',
        value: {
          creator: walletAddress,
          receiver: msgTo,
          hashlink: encryptedCidStr,
          vaultid: ""
        }
      };
      const fee = {
        amount: [{ denom: MICRO_DENOM, amount: '2000' }],
        gas: '200000'
      };
      const txResult = await client.signAndBroadcast(walletAddress, [msgTx], fee, 'Send Message');
      appendLog(`Message transaction result:\n${JSON.stringify(txResult, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}`);
      
      // Update modal to show success and then hide it.
      setMessageStatus("Message successfully sent.");
      setTimeout(() => {
        setShowMessageStatus(false);
        setMessageStatus("");
      }, 3000);
    } catch (error) {
      console.error("Error sending message:", error);
      appendLog("Error sending message: " + error.message);
      setMessageStatus("");
      setShowMessageStatus(false);
    }
  };

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
                  {currentMessage && (
                    <Box sx={{ mt: 2, p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
                      <Typography variant="h6">Message Details</Typography>
                      <Typography variant="body2">
                        <strong>From:</strong> {currentMessage.sender}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Subject:</strong> {currentMessage.subject}
                      </Typography>
                      <Box
                        sx={{
                          mt: 1,
                          maxHeight: '150px',
                          overflowY: 'auto',
                          backgroundColor: '#f5f5f5',
                          p: 1,
                        }}
                      >
                        <Typography variant="body1">
                          {currentMessage.body}
                        </Typography>
                      </Box>
                      <Button variant="contained" sx={{ mt: 1 }} onClick={handleReplyFromInbox}>
                        Reply
                      </Button>
                    </Box>
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
                  handleSendMessage={handleSendMessage}
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
      {/* Modal for message sending status */}
      <Modal
        open={showMessageStatus}
        onClose={(e, reason) => {
          // Prevent closing modal via backdrop click
          if (reason !== 'backdropClick') {
            setShowMessageStatus(false);
          }
        }}
        disableEscapeKeyDown
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'background.paper',
            p: 4,
            border: '2px solid #000',
            borderRadius: 2,
            textAlign: 'center'
          }}
        >
          <Typography variant="h6">{messageStatus}</Typography>
        </Box>
      </Modal>
    </Container>
  );
}

export default App;
