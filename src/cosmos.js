import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { Registry } from '@cosmjs/proto-signing';
import { SigningStargateClient, defaultRegistryTypes } from '@cosmjs/stargate';
import { MsgCreateHashCid } from './ehlTypes.js';
import { COSMOS_API, FAUCET_URL, IPFS_GATEWAY_URL, RPC_URL } from './config.js';

export const createWalletFromMnemonic = async (mnemonic) => {
  // Adjust prefix as needed.
  return DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'btml' });
};

export const connect = async (wallet) => {
  const [account] = await wallet.getAccounts();
  const registry = new Registry([
    ...defaultRegistryTypes,
    ['/bitmail.ehl.MsgCreateHashCid', MsgCreateHashCid],
  ]);
  const client = await SigningStargateClient.connectWithSigner(RPC_URL, wallet, {
    registry,
    prefix: 'btml',
  });
  return { client, address: account.address };
};

export const sendTokens = async (client, fromAddress, toAddress, amount) => {
  const fee = {
    amount: [{ denom: 'ubtml', amount: '2000' }],
    gas: '200000',
  };
  return await client.sendTokens(
    fromAddress,
    toAddress,
    [{ denom: 'ubtml', amount: String(amount) }],
    fee,
    'Sending tokens'
  );
};
