// src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import * as bip39 from 'bip39';
import * as config from './config';
import { createWalletFromMnemonic, connect, sendTokens } from './cosmos';
import LoginPanel from './components/LoginPanel';
import Layout from './components/Layout';
import {
  hasMnemonicStored,
  saveMnemonic,
  retrieveMnemonic,
  loadAccountInfo,
  loadFriendsList
} from './ipc/handlers';
import eccrypto from 'eccrypto';
import * as utxo from '@bitgo/utxo-lib';
import { downloadFromIPFS } from './ipfsTools';

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
  const [currentMessage, setCurrentMessage] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [messageStatus, setMessageStatus] = useState('');
  const [showMessageStatus, setShowMessageStatus] = useState(false);

  const appendLog = useCallback((message) => {
    console.log(message);
    setLog((prev) => prev + '\n' + message);
  }, []);

  // Check if mnemonic is stored on initial load
  useEffect(() => {
    const checkMnemonic = async () => {
      try {
        const exists = await hasMnemonicStored();
        console.log('[App] hasMnemonicStored:', exists);
        setHasMnemonicState(exists);
      } catch (error) {
        console.error("Error checking mnemonic storage:", error);
        appendLog(`Error checking mnemonic storage: ${error.message}`);
      }
    };
    checkMnemonic();
  }, [appendLog]);

  // Log walletAddress changes and trigger loading account info afterward
  useEffect(() => {
    console.log('[App] Wallet address updated:', walletAddress);
    if (walletAddress) {
      // First fetch balance, then load account info
      fetchBalance();
      loadAccInfo();
    }
  }, [walletAddress]);

  // Define loadAccInfo before it's used
  const loadAccInfo = useCallback(async () => {
    if (!walletAddress) return;
    try {
      console.log('[App.loadAccInfo] Starting to load account info for wallet:', walletAddress);
      const result = await loadAccountInfo(walletAddress);
      console.log('[App.loadAccInfo] Result from loadAccountInfo:', result);
      if (result.success) {
        setAccountInfo(result.accountInfo);
        setTempUserName(result.accountInfo.userName);
        if (!result.accountInfo.userName || result.accountInfo.userName.trim() === "") {
          console.log('[App.loadAccInfo] Username not found in loaded account info.');
          appendLog("Username not found.");
        } else {
          console.log('[App.loadAccInfo] Username loaded:', result.accountInfo.userName);
          appendLog("Account info loaded with username: " + result.accountInfo.userName);
        }
      } else {
        console.error('[App.loadAccInfo] Failed to load account info:', result.error);
        appendLog("Failed to load account info: " + result.error);
      }
    } catch (error) {
      console.error('[App.loadAccInfo] Error:', error);
      appendLog("Error loading account info: " + error.message);
    }
  }, [walletAddress, appendLog]);

  // Username editing functions
  const toggleEditUserName = () => {
    setTempUserName(accountInfo.userName);
    setEditingUserName(true);
  };

  const handleSaveUserName = async () => {
    const trimmedName = tempUserName.slice(0, 44);
    console.log('[App.handleSaveUserName] Saving username for wallet:', walletAddress, 'Username:', trimmedName);
    const saveResp = await window.electronAPI.saveUserName({ walletAddress, userName: trimmedName });
    console.log('[App.handleSaveUserName] Save response:', saveResp);
    if (saveResp.success) {
      setAccountInfo({ ...accountInfo, userName: trimmedName });
      appendLog('Username saved.');
    } else {
      appendLog('Error saving username: ' + saveResp.error);
    }
    setEditingUserName(false);
  };

    // In App.js, after your state definitions (e.g., near the top of your App component)
const handleAddFriend = (newFriend) => {
  console.log('[App] Adding friend:', newFriend);
  // Update the friends state by appending the new friend.
  setFriends((prevFriends) => [...prevFriends, newFriend]);
  // Persist the updated friends list by calling the IPC handler.
  window.electronAPI
    .saveFriendsList({ walletAddress, friends: [...friends, newFriend] })
    .then((resp) => {
      if (resp.success) {
        console.log('[App] Friends list updated successfully.');
      } else {
        console.error('[App] Error saving friends list:', resp.error);
      }
    })
    .catch((err) => console.error('[App] Error in saveFriendsList:', err));
};

  const handleCancelEditUserName = () => {
    setTempUserName(accountInfo.userName);
    setEditingUserName(false);
  };

  // Inbox Functions
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
      
      const lines = decryptedMsg.split('\n');
      const subjectLine = lines[0] || "";
      const subject = subjectLine.replace(/^Subject:\s*/i, '').trim();
      const body = lines.slice(1).join('\n').trim();
      
      setCurrentMessage({
        sender: msg.creator,
        subject,
        originalBody: body,
        body: body,
      });
    } catch (error) {
      appendLog("Error viewing message: " + (typeof error === 'object' ? JSON.stringify(error) : error));
    }
  };

  const handleReplyFromInbox = () => {
    if (currentMessage) {
      setMsgTo(currentMessage.sender);
      setMsgSubject(`Re: ${currentMessage.subject}`);
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

  const handleDeleteFriend = (friendToDelete) => {
    console.log('[App] Deleting friend:', friendToDelete);
    // Update the friends state by filtering out the friend to delete.
    setFriends((prevFriends) => {
      const updatedFriends = prevFriends.filter(
        (friend) => friend.btml_address !== friendToDelete.btml_address
      );
      // Persist the updated friends list using the IPC handler.
      window.electronAPI
        .saveFriendsList({ walletAddress, friends: updatedFriends })
        .then((resp) => {
          if (resp.success) {
            console.log('[App] Friends list updated successfully after deletion.');
          } else {
            console.error('[App] Error saving friends list after deletion:', resp.error);
          }
        })
        .catch((err) => console.error('[App] Error in saveFriendsList during deletion:', err));
      return updatedFriends;
    });
  };
  

  // Login and Wallet Functions
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
              // First fetch balance, then load persisted account info (username)
              await fetchBalance();
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
      // fetchBalance and loadAccInfo are now triggered in the walletAddress useEffect above.
      // This useEffect is kept for periodic balance updates.
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
      appendLog(`Transaction successful:\n${JSON.stringify(result, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}`);
      fetchBalance();
    } catch (error) {
      console.error('Error sending tokens:', error);
      appendLog(`Transaction failed: ${error.message}`);
    }
  };

  const handleSendMessage = async () => {
    try {
      if (!client || !walletAddress || !msgTo || !msgSubject || !msgBody) {
        appendLog("All message fields must be filled out.");
        return;
      }
      
      setMessageStatus("Sending message, please wait...");
      setShowMessageStatus(true);
      
      appendLog(`Fetching public key for receiver: ${msgTo}`);
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
        amount: [{ denom: MICRO_DENOM, amount: '100' }],
        gas: '200000'
      };
      const txResult = await client.signAndBroadcast(walletAddress, [msgTx], fee, 'Send Message');
      appendLog(`Message transaction result:\n${JSON.stringify(txResult, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}`);
      
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

  // If not logged in, show LoginPanel
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

  // Render the Layout (presentation) component and pass all necessary props
  return (
    <Layout
      selectedTab={selectedTab}
      setSelectedTab={setSelectedTab}
      walletAddress={walletAddress}
      balance={balance}
      toAddress={toAddress}
      setToAddress={setToAddress}
      amount={amount}
      setAmount={setAmount}
      handleSend={handleSend}
      accountInfo={accountInfo}
      editingUserName={editingUserName}
      tempUserName={tempUserName}
      setTempUserName={setTempUserName}
      handleSaveUserName={handleSaveUserName}
      handleCancelEditUserName={handleCancelEditUserName}
      toggleEditUserName={toggleEditUserName}
      appendLog={appendLog}
      inboxMessages={inboxMessages}
      handleViewMessage={handleViewMessage}
      handleSendBitmail={handleSendBitmail}
      handleSendBTMLToken={handleSendBTMLToken}
      currentMessage={currentMessage}
      handleReplyFromInbox={handleReplyFromInbox}
      msgTo={msgTo}
      setMsgTo={setMsgTo}
      msgSubject={msgSubject}
      setMsgSubject={setMsgSubject}
      msgBody={msgBody}
      setMsgBody={setMsgBody}
      handleSendMessage={handleSendMessage}
      friends={friends}
      handleAddFriend={handleAddFriend} 
      handleDeleteFriend={handleDeleteFriend}
      log={log}
      showMessageStatus={showMessageStatus}
      setShowMessageStatus={setShowMessageStatus}
      messageStatus={messageStatus}
    />
  );
}

export default App;
