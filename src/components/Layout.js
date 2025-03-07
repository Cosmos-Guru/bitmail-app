// src/components/Layout.js
import React from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Modal,
  Button
} from '@mui/material';
import NavigationSidebar from './NavigationSidebar';
import WalletPanel from './WalletPanel';
import AccountInfoPanel from './AccountInfoPanel';
import FaucetPanel from './FaucetPanel';
import MessagePanel from './MessagePanel';
import FriendsPanel from './FriendsPanel';
import QRCodePanel from './QRCodePanel';

const Layout = ({
  selectedTab,
  setSelectedTab,
  walletAddress,
  balance,
  toAddress,
  setToAddress,
  amount,
  setAmount,
  handleSend,
  accountInfo,
  editingUserName,
  tempUserName,
  setTempUserName,
  handleSaveUserName,
  handleCancelEditUserName,
  toggleEditUserName,
  appendLog,
  inboxMessages,
  handleViewMessage,
  handleSendBitmail,
  handleSendBTMLToken,
  currentMessage,
  handleReplyFromInbox,
  msgTo,
  setMsgTo,
  msgSubject,
  setMsgSubject,
  msgBody,
  setMsgBody,
  handleSendMessage,
  friends,
  handleAddFriend, // NEW: Pass down the add friend handler
  log,
  showMessageStatus,
  setShowMessageStatus,
  messageStatus,
}) => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h3" align="center" gutterBottom>
        BitMail Dashboard
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <NavigationSidebar
            tabs={[
              'Account Info',
              'Wallet',
              'Faucet',
              'Inbox',
              'Message',
              'Friends',
              'QR Code'
            ]}
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
                    <Typography variant="body1">
                      No messages found.
                    </Typography>
                  ) : (
                    inboxMessages.map((msg) => (
                      <Box
                        key={msg.id}
                        sx={{ borderBottom: '1px solid #ccc', py: 1 }}
                      >
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
                    <Box
                      sx={{
                        mt: 2,
                        p: 2,
                        border: '1px solid #ccc',
                        borderRadius: 1
                      }}
                    >
                      <Typography variant="h6">
                        Message Details
                      </Typography>
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
                      <Button
                        variant="contained"
                        sx={{ mt: 1 }}
                        onClick={handleReplyFromInbox}
                      >
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
                    // For example, update the friends state and persist the change.
                  }}
                  handleAddFriend={handleAddFriend} // Pass down the new friend handler
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
      <Modal
        open={showMessageStatus}
        onClose={(e, reason) => {
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
};

export default Layout;
