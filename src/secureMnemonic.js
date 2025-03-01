const crypto = require('crypto');

// Constants
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

function encryptMnemonic(mnemonic, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(mnemonic, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    encrypted,
    tag,
  };
}

function decryptMnemonic(encryptedData, password) {
  const { salt, iv, encrypted, tag } = encryptedData;
  const key = deriveKey(password, Buffer.from(salt, 'hex'));

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  try {
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error('Incorrect password or corrupted data');
  }
}

function saveMnemonic(mnemonic, password, setStoreValue) {
  const encryptedData = encryptMnemonic(mnemonic, password);
  return setStoreValue('encryptedMnemonic', encryptedData);
}

function retrieveMnemonic(password, getStoreValue) {
  return getStoreValue('encryptedMnemonic')
    .then(encryptedData => {
      if (!encryptedData) {
        throw new Error('No mnemonic found in secure storage');
      }
      return decryptMnemonic(encryptedData, password);
    });
}

function hasMnemonicStored(getStoreValue) {
  return getStoreValue('encryptedMnemonic')
    .then(value => !!value);
}

module.exports = { saveMnemonic, retrieveMnemonic, hasMnemonicStored };
