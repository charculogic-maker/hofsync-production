const crypto = require('crypto');

const PIN_HASH_ITERATIONS = 120000;
const DUMMY_SALT_HEX = '00112233445566778899aabbccddeeff';

function hashPin(pin, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.pbkdf2Sync(String(pin), salt, PIN_HASH_ITERATIONS, 32, 'sha256').toString('hex');
}

const DUMMY_HASH_HEX = hashPin('0000', DUMMY_SALT_HEX);

function createPinRecord(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    salt,
    hash: hashPin(pin, salt),
    version: 1,
  };
}

function verifyPinRecord(pin, record) {
  if (!record?.salt || !record?.hash) return false;
  const candidate = hashPin(pin, record.salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(record.hash, 'hex'));
  } catch (_) {
    return false;
  }
}

/** Constant-time padding when no credential record exists (masks DB presence). */
function runDummyPinVerification(pin) {
  const candidate = hashPin(pin, DUMMY_SALT_HEX);
  try {
    crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(DUMMY_HASH_HEX, 'hex'));
  } catch (_) {
    // intentional no-op — comparison must still run for timing parity
  }
}

function verifyPinWithTimingPadding(pin, record) {
  if (record?.salt && record?.hash) {
    return verifyPinRecord(pin, record);
  }
  runDummyPinVerification(pin);
  return false;
}

module.exports = {
  PIN_HASH_ITERATIONS,
  createPinRecord,
  hashPin,
  verifyPinRecord,
  runDummyPinVerification,
  verifyPinWithTimingPadding,
};
