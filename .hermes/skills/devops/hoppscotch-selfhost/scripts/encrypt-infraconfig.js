#!/usr/bin/env node
/**
 * Encrypt/decrypt Hoppscotch InfraConfig values using DATA_ENCRYPTION_KEY.
 * 
 * Usage:
 *   node encrypt-infraconfig.js encrypt "my-secret-password" f41f7ce8f3d190736430bbe5ec79f591
 *   node encrypt-infraconfig.js decrypt "iv_hex:encrypted_hex" f41f7ce8f3d190736430bbe5ec79f591
 *   node encrypt-infraconfig.js sql "MAILER_SMTP_PASSWORD" "my-password" f41f7ce8f3d190736430bbe5ec79f591
 * 
 * The encryption format MUST be iv_hex:encrypted_hex (colon-separated hex strings).
 * This matches the backend's encrypt() in src/utils.ts exactly.
 */

const crypto = require('crypto');

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

function encrypt(text, key) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(key, 'utf8'), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(encryptedData, key) {
  if (!encryptedData || encryptedData === '') return encryptedData;
  const parts = encryptedData.split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted data format. Expected iv:encrypted');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(key, 'utf8'), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

const [,, action, value, key] = process.argv;

if (!action || !value) {
  console.error('Usage: node encrypt-infraconfig.js <encrypt|decrypt|sql> <value> <key>');
  process.exit(1);
}

const encKey = key || process.env.DATA_ENCRYPTION_KEY;
if (!encKey) {
  console.error('Error: DATA_ENCRYPTION_KEY required (arg or env var)');
  process.exit(1);
}

if (action === 'encrypt') {
  const result = encrypt(value, encKey);
  console.log(result);
  // Verify round-trip
  const verify = decrypt(result, encKey);
  if (verify !== value) {
    console.error('VERIFICATION FAILED!');
    process.exit(1);
  }
} else if (action === 'decrypt') {
  console.log(decrypt(value, encKey));
} else if (action === 'sql') {
  // Output a SQL UPDATE statement
  const fieldName = process.argv[5] || 'FIELD_NAME';
  const encrypted = encrypt(value, encKey);
  const verify = decrypt(encrypted, encKey);
  if (verify !== value) {
    console.error('VERIFICATION FAILED!');
    process.exit(1);
  }
  console.log(`UPDATE "InfraConfig" SET value='${encrypted}' WHERE name='${fieldName}';`);
} else {
  console.error('Unknown action. Use encrypt, decrypt, or sql.');
  process.exit(1);
}
