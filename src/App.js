import React, {useState, useEffect, useCallback} from 'react';
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
    Modal,
} from '@mui/material';
import {QRCodeCanvas} from 'qrcode.react';
import eccrypto from 'eccrypto';
import * as bip39 from 'bip39';
import * as utxo from '@bitgo/utxo-lib';
import * as config from './config.js';
//import { saveMnemonic, retrieveMnemonic, hasMnemonicStored } from './secureMnemonic.js';
import {createWalletFromMnemonic, connect, sendTokens} from './cosmos.js';
import {COSMOS_API, FAUCET_URL, IPFS_GATEWAY_URL, RPC_URL} from './config.js';

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
    const [hasMnemonic, setHasMnemonic] = useState(false);
    const [accountInfo, setAccountInfo] = useState({userName: ""});
    const [editingUserName, setEditingUserName] = useState(false);
    const [tempUserName, setTempUserName] = useState("");
    const [friends, setFriends] = useState([]);
    const [inboxMessages, setInboxMessages] = useState([]);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewMessageContent, setViewMessageContent] = useState('');
    const [wallet, setWallet] = useState(null);

    const appendLog = useCallback((message) => {
        console.log(message);
        setLog((prev) => prev + '\n' + message);
    }, [setLog]);

    useEffect(() => {
        const checkMnemonic = async () => {
            try {
                if (window.electronAPI && window.electronAPI.hasMnemonicStored) {
                    const mnemonicExists = await window.electronAPI.hasMnemonicStored();
                    setHasMnemonic(mnemonicExists);
                } else {
                    console.warn("window.electronAPI or window.electronAPI.hasMnemonicStored is not available");
                    appendLog("window.electronAPI or window.electronAPI.hasMnemonicStored is not available");
                }
            } catch (error) {
                console.error("Error checking mnemonic storage:", error);
                appendLog(`Error checking mnemonic storage: ${error.message}`);
            }
        };

        checkMnemonic();
    }, [appendLog]);

    const loadAccountInfo = useCallback(async () => {
        if (!walletAddress) return;
        try {
            if (window.electronAPI && window.electronAPI.loadAccountInfo) {
                const result = await window.electronAPI.loadAccountInfo(walletAddress);
                if (result.success) {
                    setAccountInfo(result.accountInfo);
                    setTempUserName(result.accountInfo.userName);
                    appendLog("Account info loaded.");
                } else {
                    appendLog("Failed to load account info: " + result.error);
                }
            } else {
                console.warn("window.electronAPI or window.electronAPI.loadAccountInfo is not available");
                appendLog("window.electronAPI or window.electronAPI.loadAccountInfo is not available");
            }
        } catch (error) {
            console.error("Error loading account info:", error);
            appendLog("Error loading account info: " + error.message);
        }
    }, [walletAddress, appendLog]);

    const handleLogin = async () => {
        appendLog('Starting login process...');
        try {
            const mnemonicToUse = mnemonic.trim();
            if (!hasMnemonic) {
                appendLog('No mnemonic found, saving new mnemonic...');
                if (window.electronAPI && window.electronAPI.saveMnemonic) {
                    const saveResult = await window.electronAPI.saveMnemonic(mnemonicToUse, password);
                    if (saveResult.success) {
                        setHasMnemonic(true);
                        appendLog('Mnemonic saved successfully.');
                    } else {
                        appendLog(`Error saving mnemonic: ${saveResult.error}`);
                        return;
                    }
                } else {
                    console.warn("window.electronAPI or window.electronAPI.saveMnemonic is not available");
                    appendLog("window.electronAPI or window.electronAPI.saveMnemonic is not available");
                    return;
                }
            }

            appendLog('Retrieving mnemonic...');
            if (window.electronAPI && window.electronAPI.retrieveMnemonic) {
                const retrievedResult = await window.electronAPI.retrieveMnemonic(password);
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
                                await loadAccountInfo();
                                const friendsResp = await window.electronAPI.loadFriendsList(address);
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
            } else {
                console.warn("window.electronAPI or window.electronAPI.retrieveMnemonic is not available");
                appendLog("window.electronAPI or window.electronAPI.retrieveMnemonic is not available");
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

    // Inbox: fetch messages from chain
    const fetchInboxMessages = async () => {
        if (!walletAddress) return;
        try {
            const response = await fetch(`${config.COSMOS_API}/bitmail/ehl/hash-cid-by-receiver/${walletAddress}`);
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
    }, [selectedTab, walletAddress,appendLog]);

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

    const bigintReplacer = (_, value) =>
        typeof value === 'bigint' ? value.toString() : value;

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
            const recipientInfo = pubKeyData.info || pubKeyData.account || pubKeyData;
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
            appendLog('Generating random .bin filename...');
            const filename = generateRandomFilename();
            appendLog(`Random filename generated: ${filename}`);
            const fileWriteResult = await window.electronAPI.writeEncryptedFile(filename, encryptedMessage);
            if (!fileWriteResult.success) {
                appendLog(`File write error: ${fileWriteResult.error}`);
                return;
            }
            appendLog(`File written successfully: ${fileWriteResult.filePath}`);
            appendLog('Reading file contents for upload...');
            const readResult = await window.electronAPI.readFile(fileWriteResult.filePath);
            if (!readResult.success) {
                appendLog(`File read error: ${readResult.error}`);
                return;
            }
            const fileContentsBuffer = Buffer.from(readResult.data, 'utf8');
            appendLog('File contents read successfully.');
            appendLog('Uploading file contents to IPFS...');
            const ipfsUploadResult = await window.electronAPI.uploadToIPFS(fileContentsBuffer.toString('utf8'));
            if (!ipfsUploadResult.success) {
                appendLog(`IPFS upload error: ${ipfsUploadResult.error}`);
                return;
            }
            const ipfsHash = ipfsUploadResult.cid;
            appendLog(`IPFS hash (CID) received: ${ipfsHash}`);
            appendLog('Deleting local file...');
            const deleteResult = await window.electronAPI.deleteFile(fileWriteResult.filePath);
            if (!deleteResult.success) {
                appendLog(`File deletion error: ${deleteResult.error}`);
            } else {
                appendLog('Local file deleted successfully.');
            }
            appendLog('Encrypting IPFS CID with recipient public key...');
            const encryptedHashObj = await eccrypto.encrypt(
                recipientPubKeyBuffer,
                Buffer.from(ipfsHash, 'utf8')
            );
            const encryptedHash = JSON.stringify({
                iv: encryptedHashObj.iv.toString('base64'),
                ephemPublicKey: encryptedHashObj.ephemPublicKey.toString('base64'),
                mac: encryptedHashObj.mac.toString('base64'),
            });
            appendLog('Encrypted IPFS CID: ' + encryptedHash);
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
                amount: [{denom: MICRO_DENOM, amount: '2000'}],
                gas: '200000',
            };
            const txResult = await client.signAndBroadcast(walletAddress, [msg], fee, 'Send Message');
            appendLog(`Message TX result:\n${JSON.stringify(txResult, bigintReplacer, 2)}\nPlease wait 30 seconds and check your balance.`);
        } catch (error) {
            console.error('Error sending message:', error);
            appendLog(`Send message error: ${error.message}`);
        }
    };

    // QR Code Download Handler
    const handleDownloadQRCode = async () => {
        if (!walletAddress) {
            appendLog('Wallet address not available.');
            return;
        }
        try {
            appendLog('Fetching public key for QR Code generation...');
            const pubKeyData = await window.electronAPI.fetchPublicKey(walletAddress);
            let userPublicKey;
            const info = pubKeyData.info || pubKeyData.account || pubKeyData;
            if (info.pub_key && info.pub_key.key) {
                userPublicKey = info.pub_key.key;
            } else if (info.key) {
                userPublicKey = info.key;
            }
            if (!userPublicKey || userPublicKey.toLowerCase() === 'null') {
                appendLog('Public key not available for wallet.');
                return;
            }
            const qrData = {
                btml_address: walletAddress,
                public_key: userPublicKey,
                user_name: accountInfo.userName || "",
                gravitar_image_link: ""
            };
            // Default filename: <username>_qrcode.png
            const defaultFileName = `${accountInfo.userName || 'qrcode'}_qrcode.png`;
            appendLog('Downloading QR Code...');
            const result = await window.electronAPI.downloadQRCode({qrData, defaultFileName});
            if (result.success) {
                appendLog('QR Code downloaded successfully to: ' + result.filePath);
            } else {
                appendLog('QR Code download failed: ' + result.error);
            }
        } catch (error) {
            appendLog('Error generating QR Code: ' + error.message);
        }
    };

    // Inbox: Decryption and view
    const decryptHashlink = async (encryptedHashlink) => {
        if (!privateKey) {
            appendLog('Private key not available for decryption.');
            throw new Error("Private key not available");
        }
        try {
            const encryptedData = JSON.parse(encryptedHashlink);
            const decrypted = await eccrypto.decrypt(privateKey, {
                iv: Buffer.from(encryptedData.iv, 'base64'),
                ephemPublicKey: Buffer.from(encryptedData.ephemPublicKey, 'base64'),
                ciphertext: Buffer.from(encryptedData.ciphertext, 'base64'),
                mac: Buffer.from(encryptedData.mac, 'base64'),
            });
            return decrypted.toString('utf8');
        } catch (error) {
            appendLog("Hashlink decryption error: " + error.message);
            throw error;
        }
    };

    const handleViewMessage = async (msg) => {
        if (!privateKey) {
            appendLog('Private key not available for decryption.');
            return;
        }
        try {
            appendLog("Decrypting hashlink...");
            const ipfsCID = await decryptHashlink(msg.hashlink);
            appendLog("IPFS CID: " + ipfsCID);
            const result = await window.electronAPI.downloadFromIPFS(ipfsCID);
            if (!result.success) throw new Error(result.error);
            const encryptedFileContent = result.data;
            const encryptedContent = JSON.parse(encryptedFileContent);
            const decryptedContent = await eccrypto.decrypt(privateKey, {
                iv: Buffer.from(encryptedContent.iv, 'base64'),
                ephemPublicKey: Buffer.from(encryptedContent.ephemPublicKey, 'base64'),
                ciphertext: Buffer.from(encryptedContent.ciphertext, 'base64'),
                mac: Buffer.from(encryptedContent.mac, 'base64'),
            });
            const plainTextMessage = decryptedContent.toString('utf8');
            setViewMessageContent(plainTextMessage);
            setViewModalOpen(true);
        } catch (error) {
            appendLog("Error viewing message: " + error.message);
        }
    };

    const handleReply = (msg) => {
        setMsgTo(msg.creator);
        setSelectedTab('Message');
    };

    // Account Info Handlers
    const toggleEditUserName = () => {
        setTempUserName(accountInfo.userName);
        setEditingUserName(true);
    };

    const handleSaveUserName = async () => {
        const trimmedName = tempUserName.slice(0, 44);
        const newAccountInfo = {...accountInfo, userName: trimmedName};
        const saveResp = await window.electronAPI.saveAccountInfo({walletAddress, accountInfo: newAccountInfo});
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

    // Friends List Handlers
    const handleAddFriend = async () => {
        appendLog('Opening friend QR Code file...');
        const resp = await window.electronAPI.readFriendQRCode();
        if (resp.success && resp.friend) {
            const newFriend = resp.friend;
            if (friends.find(f => f.btml_address === newFriend.btml_address)) {
                appendLog('Friend already added.');
                return;
            }
            const updatedFriends = [...friends, newFriend];
            const saveResp = await window.electronAPI.saveFriendsList({walletAddress, friends: updatedFriends});
            if (saveResp.success) {
                setFriends(updatedFriends);
                appendLog('Friend added successfully.');
            } else {
                appendLog('Error saving friends list: ' + saveResp.error);
            }
        } else {
            appendLog('Error reading friend QR Code: ' + (resp.error || 'Unknown error'));
        }
    };

    const handleDeleteFriend = async (friend) => {
        const updatedFriends = friends.filter(f => f.btml_address !== friend.btml_address);
        const saveResp = await window.electronAPI.saveFriendsList({walletAddress, friends: updatedFriends});
        if (saveResp.success) {
            setFriends(updatedFriends);
            appendLog('Friend deleted.');
        } else {
            appendLog('Error saving friends list: ' + saveResp.error);
        }
    };

    const handleSendTokenToFriend = (friend) => {
        setToAddress(friend.btml_address);
        setSelectedTab('Wallet');
    };

    const handleSendMessageToFriend = (friend) => {
        setMsgTo(friend.btml_address);
        setSelectedTab('Message');
    };

    if (!walletAddress) {
        return (
            <Container maxWidth="sm" sx={{mt: 8}}>
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
                        <Button variant="contained" color="primary" onClick={handleLogin} fullWidth sx={{mt: 2}}>
                            Login
                        </Button>
                        {log && <Typography variant="body2" sx={{mt: 2}}>{log}</Typography>}
                    </CardContent>
                </Card>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{mt: 4}}>
            <Typography variant="h4" align="center" gutterBottom>
                BitMail Client
            </Typography>
            <Typography variant="subtitle1">
                Logged in as: {walletAddress} (Balance: {balance} BTML)
            </Typography>
            <Box sx={{borderBottom: 1, borderColor: 'divider', mt: 2}}/>
            <List component="nav" sx={{display: 'flex', justifyContent: 'space-around'}}>
                {[
                    'Account Info',
                    'Wallet',
                    'Faucet',
                    'Inbox',
                    'Message',
                    'Friends',
                    'QR Code'
                ].map((text) => (
                    <ListItemButton key={text} onClick={() => setSelectedTab(text)} selected={selectedTab === text}>
                        <ListItemText primary={text}/>
                    </ListItemButton>
                ))}
            </List>

            {selectedTab === 'Wallet' && (
                <Card sx={{mt: 2}}>
                    <CardContent>
                        <Typography variant="h6">Send Tokens</Typography>
                        <TextField
                            fullWidth
                            label="To Address"
                            value={toAddress}
                            onChange={(e) => setToAddress(e.target.value)}
                            sx={{mb: 1}}
                        />
                        <TextField
                            fullWidth
                            label="Amount (BTML)"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            sx={{mb: 2}}
                        />
                        <Button variant="contained" color="primary" onClick={handleSend}>
                            Send
                        </Button>
                    </CardContent>
                </Card>
            )}

            {selectedTab === 'Inbox' && (
                <Card sx={{mt: 2}}>
                    <CardContent>
                        <Typography variant="h6">Inbox Messages</Typography>
                        <List>
                            {inboxMessages.map((msg) => (
                                <ListItem key={msg.id} divider>
                                    <ListItemText primary={`From: ${msg.creator}`} secondary={`ID: ${msg.id}`}/>
                                    <Button onClick={() => handleViewMessage(msg)}>View</Button>
                                    <Button onClick={() => handleReply(msg)}>Reply</Button>
                                </ListItem>
                            ))}
                        </List>
                    </CardContent>
                </Card>
            )}

            {selectedTab === 'Message' && (
                <Card sx={{mt: 2}}>
                    <CardContent>
                        <Typography variant="h6">Send Message</Typography>
                        <TextField
                            fullWidth
                            label="To Address"
                            value={msgTo}
                            onChange={(e) => setMsgTo(e.target.value)}
                            sx={{mb: 1}}
                        />
                        <TextField
                            fullWidth
                            label="Subject"
                            value={msgSubject}
                            onChange={(e) => setMsgSubject(e.target.value)}
                            sx={{mb: 1}}
                        />
                        <TextField
                            fullWidth
                            label="Message Body"
                            multiline
                            rows={4}
                            value={msgBody}
                            onChange={(e) => setMsgBody(e.target.value)}
                            sx={{mb: 2}}
                        />
                        <Button variant="contained" color="primary" onClick={handleSendMessage}>
                            Send Message
                        </Button>
                    </CardContent>
                </Card>
            )}

            {selectedTab === 'Account Info' && (
                <Card sx={{mt: 2}}>
                    <CardContent>
                        <Typography variant="h6">Account Information</Typography>
                        <Typography variant="body1">Wallet Address: {walletAddress}</Typography>
                        <Typography variant="body1">
                            User Name: {accountInfo.userName || "Not set"}
                        </Typography>
                        {editingUserName ? (
                            <>
                                <TextField
                                    fullWidth
                                    label="User Name"
                                    value={tempUserName}
                                    onChange={(e) => setTempUserName(e.target.value)}
                                    sx={{mb: 1}}
                                />
                                <Button variant="contained" color="primary" onClick={handleSaveUserName}>
                                    Save
                                </Button>
                                <Button variant="outlined" onClick={handleCancelEditUserName} sx={{ml: 2}}>
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <Button variant="contained" onClick={toggleEditUserName}>
                                {accountInfo.userName ? "Edit" : "+ Add"}
                            </Button>
                        )}
                        <Button variant="contained" onClick={handleDownloadQRCode} sx={{mt: 2}}>
                            Download QR Code
                        </Button>
                    </CardContent>
                </Card>
            )}

            {selectedTab === 'Faucet' && (
                <Card sx={{mt: 2}}>
                    <CardContent>
                        <Typography variant="h6" align="center">
                            Faucet
                        </Typography>
                        <Typography variant="body1" align="center" sx={{mb: 2}}>
                            Request 100 ubtml to your wallet: {walletAddress}
                        </Typography>
                        <Button
                            variant="contained"
                            color="success"
                            fullWidth
                            onClick={async () => {
                                try {
                                    const body = {address: walletAddress, coins: ['100ubtml']};
                                    const response = await fetch(config.FAUCET_URL, {
                                        method: 'POST',
                                        headers: {'Content-Type': 'application/json'},
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
                    </CardContent>
                </Card>
            )}

            {selectedTab === 'Friends' && (
                <Card sx={{mt: 2}}>
                    <CardContent>
                        <Typography variant="h6">Friends List</Typography>
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
                    </CardContent>
                </Card>
            )}

            {selectedTab === 'QR Code' && (
                <Card sx={{mt: 2}}>
                    <CardContent>
                        <Typography variant="h6" align="center" gutterBottom>
                            QR Code
                        </Typography>
                        {walletAddress ? (
                            accountInfo.userName ? (
                                <Box sx={{display: 'flex', justifyContent: 'center'}}>
                                    <QRCodeCanvas
                                        value={JSON.stringify({
                                            btml_address: walletAddress,
                                            public_key: "", // Extend later if needed.
                                            user_name: accountInfo.userName,
                                            gravitar_image_link: ""
                                        })}
                                        size={256}
                                    />
                                </Box>
                            ) : (
                                <Typography variant="body1" align="center">
                                    Please set up your Account Info to generate your QR Code.
                                </Typography>
                            )
                        ) : (
                            <Typography variant="body1" align="center">
                                Wallet not logged in.
                            </Typography>
                        )}
                    </CardContent>
                </Card>
            )}

            <Modal
                open={viewModalOpen}
                onClose={() => setViewModalOpen(false)}
                aria-labelledby="view-message-title"
                aria-describedby="view-message-description"
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 400,
                        bgcolor: 'background.paper',
                        border: '2px solid #000',
                        boxShadow: 24,
                        p: 4,
                    }}
                >
                    <Typography id="view-message-title" variant="h6" component="h2">
                        Message Content
                    </Typography>
                    <Typography id="view-message-description" sx={{mt: 2}}>
                        {viewMessageContent}
                    </Typography>
                    <Button onClick={() => setViewModalOpen(false)}>Close</Button>
                </Box>
            </Modal>

            <Box sx={{mt: 4}}>
                <Typography variant="h6">Log</Typography>
                <TextField fullWidth multiline rows={4} value={log} readOnly variant="outlined"/>
            </Box>
        </Container>
    );
}

export default App;
