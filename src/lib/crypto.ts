/**
 * Secure PIN hashing and verification using PBKDF2 with Web Crypto API
 *
 * Storage format: "salt:hash" where both are base64-encoded
 * - salt: 16 bytes random data
 * - hash: PBKDF2-HMAC-SHA256 with 100,000 iterations
 */

import { logger } from "./logger";

const ITERATIONS = 100000;
const HASH_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // 128 bits

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate cryptographically secure random salt
 */
async function generateSalt(): Promise<Uint8Array> {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Derive a key from PIN using PBKDF2
 */
async function deriveKey(pin: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);

  // Import the PIN as a key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    pinBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as Uint8Array & BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_LENGTH * 8 // bits
  );

  return derivedBits;
}

/**
 * Hash a PIN with a new random salt
 *
 * @param pin - The 4-digit PIN to hash
 * @returns A string in format "salt:hash" (both base64-encoded)
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = await generateSalt();
  const hash = await deriveKey(pin, salt);

  const saltB64 = arrayBufferToBase64(salt.buffer as ArrayBuffer);
  const hashB64 = arrayBufferToBase64(hash);

  return `${saltB64}:${hashB64}`;
} /**
 * Constant-time comparison of two ArrayBuffers
 * Prevents timing attacks by always comparing all bytes
 */
function constantTimeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  const aBytes = new Uint8Array(a);
  const bBytes = new Uint8Array(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }

  return result === 0;
}

/**
 * Verify a PIN against a stored hash using constant-time comparison
 *
 * @param pin - The PIN to verify
 * @param storedHash - The stored hash in format "salt:hash"
 * @returns true if PIN matches, false otherwise
 */
export async function verifyPin(
  pin: string,
  storedHash: string
): Promise<boolean> {
  try {
    // Parse stored hash
    const parts = storedHash.split(":");
    if (parts.length !== 2) {
      return false;
    }

    const [saltB64, hashB64] = parts;
    const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
    const expectedHash = base64ToArrayBuffer(hashB64);

    // Derive key from provided PIN with same salt
    const actualHash = await deriveKey(pin, salt);

    // Constant-time comparison
    return constantTimeEqual(actualHash, expectedHash);
  } catch (error) {
    logger.error("PIN verification error:", error);
    return false;
  }
}

/**
 * Validate PIN format (must be exactly 4 digits)
 */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Validate stored PIN hash format (must be "salt:hash" with base64 encoding)
 *
 * @param storedHash - The stored hash string to validate
 * @returns true if format is valid, false otherwise
 */
export function isValidStoredPinFormat(storedHash: string | null): boolean {
  if (!storedHash) return false;

  try {
    const parts = storedHash.split(":");
    if (parts.length !== 2) {
      return false;
    }

    const [saltB64, hashB64] = parts;

    // Check if both parts are valid base64
    if (!saltB64 || !hashB64) {
      return false;
    }

    // Attempt to decode to verify valid base64
    base64ToArrayBuffer(saltB64);
    base64ToArrayBuffer(hashB64);

    return true;
  } catch {
    return false;
  }
}
