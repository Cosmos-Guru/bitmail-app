// src/cosmos.js
import { DirectSecp256k1HdWallet, Registry } from '@cosmjs/proto-signing';
import { SigningStargateClient } from '@cosmjs/stargate';
import { MsgCreateHashCid } from './ehlTypes';
const config = require('./config.js');

const RPC_ENDPOINT = config.RPC_URL;
const PREFIX = 'btml';

// Create a registry and register your custom type.
const registry = new Registry([
  ['/bitmail.ehl.MsgCreateHashCid', MsgCreateHashCid],
]);

export async function createWalletFromMnemonic(mnemonic) {
  return DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: PREFIX });
}

export async function connect(wallet) {
  const [account] = await wallet.getAccounts();
  const client = await SigningStargateClient.connectWithSigner(RPC_ENDPOINT, wallet, {
    registry: registry,
    prefix: PREFIX,
  });
  return { client, address: account.address };
}

export async function sendTokens(client, fromAddress, toAddress, amount) {
  const amountToSend = {
    denom: 'ubtml',
    amount: String(amount),
  };
  const fee = {
    amount: [{ denom: 'ubtml', amount: '2000' }],
    gas: '200000',
  };
  return await client.sendTokens(fromAddress, toAddress, [amountToSend], fee, 'Sending tokens');
}
