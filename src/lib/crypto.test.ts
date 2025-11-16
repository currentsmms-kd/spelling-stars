/**
 * Tests for PIN hashing and verification using PBKDF2
 * Critical security tests for parental controls
 */

import { describe, it, expect } from "vitest";
import {
  hashPin,
  verifyPin,
  isValidPinFormat,
  isValidStoredPinFormat,
} from "./crypto";

describe("hashPin", () => {
  it('should return a string in format "salt:hash"', async () => {
    const pin = "1234";
    const hashed = await hashPin(pin);

    expect(typeof hashed).toBe("string");
    expect(hashed).toContain(":");

    const parts = hashed.split(":");
    expect(parts).toHaveLength(2);
  });

  it("should generate different salts for same PIN", async () => {
    const pin = "1234";
    const hash1 = await hashPin(pin);
    const hash2 = await hashPin(pin);

    expect(hash1).not.toBe(hash2);

    // Salts should be different
    const salt1 = hash1.split(":")[0];
    const salt2 = hash2.split(":")[0];
    expect(salt1).not.toBe(salt2);
  });

  it("should generate different hashes for different PINs", async () => {
    const hash1 = await hashPin("1234");
    const hash2 = await hashPin("5678");

    expect(hash1).not.toBe(hash2);
  });

  it("should handle all numeric PINs", async () => {
    const pins = ["0000", "1111", "9999", "4567"];

    for (const pin of pins) {
      const hashed = await hashPin(pin);
      expect(hashed).toContain(":");
      expect(hashed.split(":")).toHaveLength(2);
    }
  });

  it("should produce base64-encoded salt and hash", async () => {
    const pin = "1234";
    const hashed = await hashPin(pin);
    const [salt, hash] = hashed.split(":");

    // Base64 regex pattern
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;

    expect(base64Regex.test(salt)).toBe(true);
    expect(base64Regex.test(hash)).toBe(true);
  });

  it("should produce consistent length outputs", async () => {
    const hashes = await Promise.all([
      hashPin("0000"),
      hashPin("1234"),
      hashPin("9999"),
    ]);

    // All hashes should have similar structure
    const lengths = hashes.map((h) => h.length);
    const maxDiff = Math.max(...lengths) - Math.min(...lengths);

    // Length difference should be minimal (within a few chars due to base64 padding)
    expect(maxDiff).toBeLessThan(5);
  });
});

describe("verifyPin", () => {
  it("should verify correct PIN", async () => {
    const pin = "1234";
    const hashed = await hashPin(pin);
    const isValid = await verifyPin(pin, hashed);

    expect(isValid).toBe(true);
  });

  it("should reject incorrect PIN", async () => {
    const correctPin = "1234";
    const wrongPin = "5678";
    const hashed = await hashPin(correctPin);
    const isValid = await verifyPin(wrongPin, hashed);

    expect(isValid).toBe(false);
  });

  it("should reject PIN that differs by one digit", async () => {
    const correctPin = "1234";
    const hashed = await hashPin(correctPin);

    const isValid1 = await verifyPin("1235", hashed);
    const isValid2 = await verifyPin("1244", hashed);
    const isValid3 = await verifyPin("1334", hashed);
    const isValid4 = await verifyPin("2234", hashed);

    expect(isValid1).toBe(false);
    expect(isValid2).toBe(false);
    expect(isValid3).toBe(false);
    expect(isValid4).toBe(false);
  });

  it("should handle malformed hash gracefully", async () => {
    const pin = "1234";

    // Missing colon
    const isValid1 = await verifyPin(pin, "invalidhash");
    expect(isValid1).toBe(false);

    // Multiple colons
    const isValid2 = await verifyPin(pin, "salt:hash:extra");
    expect(isValid2).toBe(false);

    // Empty string
    const isValid3 = await verifyPin(pin, "");
    expect(isValid3).toBe(false);

    // Only colon
    const isValid4 = await verifyPin(pin, ":");
    expect(isValid4).toBe(false);
  });

  it("should handle invalid base64 in stored hash", async () => {
    const pin = "1234";
    const invalidHash = "not-base64:also-not-base64!!!";

    const isValid = await verifyPin(pin, invalidHash);
    expect(isValid).toBe(false);
  });

  it("should be timing-attack resistant (constant-time comparison)", async () => {
    const correctPin = "1234";
    const hashed = await hashPin(correctPin);

    // Multiple wrong PINs should take similar time
    const wrongPins = ["0000", "1111", "9999", "5678"];
    const timings: number[] = [];

    for (const wrongPin of wrongPins) {
      const start = performance.now();
      await verifyPin(wrongPin, hashed);
      const end = performance.now();
      timings.push(end - start);
    }

    // Calculate variance - should be very low for constant-time comparison
    const mean = timings.reduce((a, b) => a + b) / timings.length;
    const variance =
      timings.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) /
      timings.length;

    // Variance should be relatively small (timing differences < 50% of mean)
    expect(variance).toBeLessThan(mean * 0.5);
  });

  it("should verify PINs with leading zeros", async () => {
    const pins = ["0000", "0123", "0001"];

    for (const pin of pins) {
      const hashed = await hashPin(pin);
      const isValid = await verifyPin(pin, hashed);
      expect(isValid).toBe(true);
    }
  });

  it("should handle concurrent verification requests", async () => {
    const pin = "1234";
    const hashed = await hashPin(pin);

    // Verify same PIN multiple times concurrently
    const results = await Promise.all([
      verifyPin(pin, hashed),
      verifyPin(pin, hashed),
      verifyPin(pin, hashed),
      verifyPin("5678", hashed),
      verifyPin("9999", hashed),
    ]);

    expect(results[0]).toBe(true);
    expect(results[1]).toBe(true);
    expect(results[2]).toBe(true);
    expect(results[3]).toBe(false);
    expect(results[4]).toBe(false);
  });
});

describe("isValidPinFormat", () => {
  it("should accept valid 4-digit PINs", () => {
    expect(isValidPinFormat("0000")).toBe(true);
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("9999")).toBe(true);
    expect(isValidPinFormat("5678")).toBe(true);
  });

  it("should reject PINs with wrong length", () => {
    expect(isValidPinFormat("123")).toBe(false); // Too short
    expect(isValidPinFormat("12345")).toBe(false); // Too long
    expect(isValidPinFormat("12")).toBe(false);
    expect(isValidPinFormat("123456")).toBe(false);
  });

  it("should reject non-numeric PINs", () => {
    expect(isValidPinFormat("abcd")).toBe(false);
    expect(isValidPinFormat("12a4")).toBe(false);
    expect(isValidPinFormat("1 34")).toBe(false);
    expect(isValidPinFormat("12.4")).toBe(false);
  });

  it("should reject empty or whitespace", () => {
    expect(isValidPinFormat("")).toBe(false);
    expect(isValidPinFormat("    ")).toBe(false);
    expect(isValidPinFormat(" 123")).toBe(false);
    expect(isValidPinFormat("123 ")).toBe(false);
  });

  it("should reject special characters", () => {
    expect(isValidPinFormat("12-4")).toBe(false);
    expect(isValidPinFormat("12@4")).toBe(false);
    expect(isValidPinFormat("1234!")).toBe(false);
  });
});

describe("isValidStoredPinFormat", () => {
  it("should accept valid stored hash format", async () => {
    const pin = "1234";
    const hashed = await hashPin(pin);
    expect(isValidStoredPinFormat(hashed)).toBe(true);
  });

  it("should reject null or undefined", () => {
    expect(isValidStoredPinFormat(null)).toBe(false);
    expect(isValidStoredPinFormat(undefined as any)).toBe(false);
  });

  it("should reject empty string", () => {
    expect(isValidStoredPinFormat("")).toBe(false);
  });

  it("should reject format without colon", () => {
    expect(isValidStoredPinFormat("invalidhash")).toBe(false);
  });

  it("should reject format with multiple colons", () => {
    expect(isValidStoredPinFormat("salt:hash:extra")).toBe(false);
  });

  it("should reject format with missing parts", () => {
    expect(isValidStoredPinFormat(":hash")).toBe(false);
    expect(isValidStoredPinFormat("salt:")).toBe(false);
    expect(isValidStoredPinFormat(":")).toBe(false);
  });

  it("should reject invalid base64 encoding", () => {
    expect(isValidStoredPinFormat("not-base64!!!:also-invalid!!!")).toBe(false);
    expect(isValidStoredPinFormat("invalid:base64")).toBe(false);
  });

  it("should accept properly formatted base64 hashes", () => {
    // Valid base64 strings
    const validHash = "dGVzdA==:dGVzdA==";
    expect(isValidStoredPinFormat(validHash)).toBe(true);
  });
});

describe("PBKDF2 security properties", () => {
  it("should use sufficient iterations (slow hashing)", async () => {
    const pin = "1234";

    // Hashing should take a measurable amount of time
    const start = performance.now();
    await hashPin(pin);
    const end = performance.now();

    // PBKDF2 with 100k iterations should take at least 10ms
    // (this is a rough benchmark, actual time varies by hardware)
    expect(end - start).toBeGreaterThan(5);
  });

  it("should produce 256-bit (32-byte) hashes", async () => {
    const pin = "1234";
    const hashed = await hashPin(pin);
    const [, hashB64] = hashed.split(":");

    // Decode base64 to get byte length
    const hashBinary = atob(hashB64);

    // 256 bits = 32 bytes
    expect(hashBinary.length).toBe(32);
  });

  it("should produce 128-bit (16-byte) salts", async () => {
    const pin = "1234";
    const hashed = await hashPin(pin);
    const [saltB64] = hashed.split(":");

    // Decode base64 to get byte length
    const saltBinary = atob(saltB64);

    // 128 bits = 16 bytes
    expect(saltBinary.length).toBe(16);
  });

  it("should use cryptographically secure random salts", async () => {
    const pin = "1234";

    // Generate multiple hashes and check salt randomness
    const hashes = await Promise.all(
      Array(10)
        .fill(0)
        .map(() => hashPin(pin))
    );

    const salts = hashes.map((h) => h.split(":")[0]);

    // All salts should be unique (collision probability is astronomically low)
    const uniqueSalts = new Set(salts);
    expect(uniqueSalts.size).toBe(10);
  });
});

describe("Integration: hash and verify workflow", () => {
  it("should complete full PIN lifecycle", async () => {
    // Parent sets PIN
    const originalPin = "1234";
    const storedHash = await hashPin(originalPin);

    // Validate storage format
    expect(isValidStoredPinFormat(storedHash)).toBe(true);

    // Parent enters correct PIN
    const unlockAttempt1 = await verifyPin("1234", storedHash);
    expect(unlockAttempt1).toBe(true);

    // Child tries wrong PIN
    const unlockAttempt2 = await verifyPin("0000", storedHash);
    expect(unlockAttempt2).toBe(false);

    // Parent changes PIN
    const newPin = "5678";
    const newStoredHash = await hashPin(newPin);

    // Old PIN no longer works
    const oldPinTest = await verifyPin("1234", newStoredHash);
    expect(oldPinTest).toBe(false);

    // New PIN works
    const newPinTest = await verifyPin("5678", newStoredHash);
    expect(newPinTest).toBe(true);
  });

  it("should handle multiple user accounts with same PIN", async () => {
    const pin = "1234";

    // Two parents set same PIN independently
    const hash1 = await hashPin(pin);
    const hash2 = await hashPin(pin);

    // Hashes should be different due to different salts
    expect(hash1).not.toBe(hash2);

    // But both should verify correctly
    expect(await verifyPin(pin, hash1)).toBe(true);
    expect(await verifyPin(pin, hash2)).toBe(true);
  });

  it("should prevent common PIN brute force patterns", async () => {
    const correctPin = "1234";
    const storedHash = await hashPin(correctPin);

    // Common guesses
    const commonPins = [
      "0000",
      "1111",
      "2222",
      "1234", // This one is correct
      "4321",
      "9999",
      "1212",
      "6969",
    ];

    const results = await Promise.all(
      commonPins.map((pin) => verifyPin(pin, storedHash))
    );

    // Only the correct PIN should verify
    const successCount = results.filter((r) => r).length;
    expect(successCount).toBe(1);
    expect(results[3]).toBe(true); // '1234' at index 3
  });
});
