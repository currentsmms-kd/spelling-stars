# PIN Security Implementation

## Overview

The SpellStars application implements secure PIN authentication for parental controls using industry-standard cryptographic practices. This document describes the security implementation and its rationale.

## Security Features

### 1. PBKDF2-HMAC-SHA256 Hashing

**Implementation:** `src/lib/crypto.ts`

PINs are hashed using PBKDF2 (Password-Based Key Derivation Function 2) with HMAC-SHA256:

- **Algorithm:** PBKDF2-HMAC-SHA256
- **Iterations:** 100,000 (exceeds OWASP minimum of 10,000 for PBKDF2-HMAC-SHA256)
- **Salt Length:** 16 bytes (128 bits) - cryptographically random
- **Hash Length:** 32 bytes (256 bits)
- **Storage Format:** `salt:hash` (both base64-encoded)

**Why PBKDF2?**

- Built into Web Crypto API (no external dependencies)
- Industry standard (NIST approved)
- Configurable iteration count for future-proofing
- Specifically designed for password/PIN storage

### 2. Constant-Time Comparison

**Function:** `constantTimeEqual()` in `src/lib/crypto.ts`

PIN verification uses constant-time comparison to prevent timing attacks:

```typescript
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
```

**Why Constant-Time?**

- Prevents timing attacks where attackers measure response times to guess PINs
- Always compares all bytes, regardless of match/mismatch
- Critical for cryptographic comparisons

### 3. Retry Limiting with Exponential Backoff

**Implementation:** `src/app/store/parentalSettings.ts`

Failed PIN attempts trigger progressive lockouts:

| Failed Attempts | Lockout Duration |
| --------------- | ---------------- |
| 1-2             | No lockout       |
| 3               | 30 seconds       |
| 4               | 60 seconds       |
| 5               | 2 minutes        |
| 6+              | 5 minutes        |

**Features:**

- `failedAttempts` counter tracks consecutive failures
- `lockoutUntil` timestamp enforces temporary lockouts
- Counter resets on successful unlock
- Lockout state NOT persisted (resets on app restart)

**Why Exponential Backoff?**

- Prevents brute-force attacks (10,000 possible 4-digit PINs)
- Progressive penalties discourage automated attacks
- Short initial delays don't frustrate legitimate users
- Long delays for persistent attackers

### 4. Secure State Management

**Storage Strategy:**

**Persisted (localStorage):**

- `pinCode`: PBKDF2 hash (format: `salt:hash`)
- Game settings
- TTS preferences

**NOT Persisted (ephemeral):**

- `isPinLocked`: Always starts `true` on app restart
- `failedAttempts`: Resets to 0 on app restart
- `lockoutUntil`: Cleared on app restart

**Why This Approach?**

- Maximizes security: fresh lock state prevents bypass via localStorage manipulation
- Persists hash for authentication across sessions
- Temporary lockouts prevent hot-reload bypass

## Implementation Details

### PIN Setting Flow

**Location:** `src/app/pages/parent/Settings.tsx`

```typescript
// 1. Validate PIN format
if (!isValidPinFormat(localPin)) {
  setMessage({ type: "error", text: "PIN must be exactly 4 digits" });
  return;
}

// 2. Validate confirmation match
if (localPin !== confirmPin) {
  setMessage({ type: "error", text: "PINs do not match" });
  return;
}

// 3. Hash and store (async operation)
await setPinCode(localPin); // Calls hashPin() internally
const hashedPin = useParentalSettingsStore.getState().pinCode;

// 4. Persist to Supabase
await supabase.from("parental_settings").upsert({
  parent_id: profile.id,
  pin_code: hashedPin,
  // ... other settings
});
```

### PIN Verification Flow

**Location:** `src/app/components/PinLock.tsx`

```typescript
// 1. Check lockout status BEFORE verification
if (isLockedOut()) {
  const remaining = getLockoutTimeRemaining();
  setError(`Too many failed attempts. Please wait ${remaining} seconds.`);
  return;
}

// 2. Verify PIN with constant-time comparison
const isValid = await verifyPin(pinToValidate, pinCode!);

// 3a. Success: unlock and reset counters
if (isValid) {
  onUnlock(); // Calls store.unlock() which resets failedAttempts
}

// 3b. Failure: record attempt and show warning
else {
  recordFailedAttempt(); // Increments counter, may trigger lockout
  const attempts = useParentalSettingsStore.getState().failedAttempts;

  if (attempts >= 6) {
    setError("Multiple failed attempts. Next failure = 5 minute lockout.");
  } else if (attempts >= 3) {
    setError(`Incorrect PIN. ${attempts} failed attempts. Lockout pending.`);
  } else {
    setError(`Incorrect PIN. ${attempts} failed attempts.`);
  }
}
```

### Database Migration

**File:** `supabase/migrations/20241109000007_secure_pin_hashing.sql`

**Changes:**

1. Adds column comment documenting PBKDF2 format
2. **Clears all existing Base64-encoded PINs** (security requirement)
3. Parents must reset PINs after migration

**Why Clear Existing PINs?**

- Old PINs use reversible Base64 encoding (insecure)
- Cannot convert Base64 → PBKDF2 without plaintext PIN
- Forces parents to create new secure PINs

## Security Considerations

### Threat Model

**Protected Against:**
✅ **Brute-force attacks:** Retry limiting + slow PBKDF2 (100k iterations)
✅ **Timing attacks:** Constant-time comparison
✅ **Rainbow tables:** Unique random salt per PIN
✅ **Storage compromise:** PINs never stored in plaintext or reversible form
✅ **Hot-reload bypass:** Lockout state not persisted

**Not Protected Against (Out of Scope):**
❌ **Physical device access:** If attacker has device, they have parent account context
❌ **Browser DevTools:** Assumes trusted device (not defending against device owner)
❌ **Shoulder surfing:** Physical security measure, not cryptographic
❌ **Malware/keyloggers:** Requires OS-level compromise

### Future Improvements

1. **Server-side verification:** Move PIN verification to Supabase Edge Function
   - Prevents client-side bypass via DevTools
   - Requires network connection (tradeoff with offline-first design)

2. **Biometric authentication:** Add WebAuthn for fingerprint/face unlock
   - Better UX than 4-digit PIN
   - Hardware-backed security

3. **Rate limiting at API level:** Supabase-side rate limiting
   - Prevents distributed attacks across multiple devices
   - Requires custom Supabase function

4. **Audit logging:** Log all PIN attempts to database
   - Enables forensics after security incidents
   - Helps detect suspicious patterns

## Testing

### Manual Testing Checklist

**Setting a New PIN:**

- [ ] Navigate to `/parent/settings`
- [ ] Enter 4-digit PIN in "New PIN" field
- [ ] Enter same PIN in "Confirm PIN" field
- [ ] Click "Save Settings"
- [ ] Verify success message
- [ ] Lock parent area (navigate away)
- [ ] Return to parent area → PinLock should appear

**PIN Verification:**

- [ ] Enter correct PIN → should unlock
- [ ] Enter incorrect PIN → should show error
- [ ] Enter 3 incorrect PINs → should show 30-second lockout warning
- [ ] Try to enter PIN during lockout → should be disabled
- [ ] Wait for lockout to expire → should allow retry

**Edge Cases:**

- [ ] Enter PIN with non-numeric characters → should be filtered
- [ ] Enter PIN with < 4 digits → should not validate
- [ ] Enter PIN with > 4 digits → should be truncated
- [ ] Set PIN with mismatched confirmation → should show error
- [ ] Cancel during lockout → should return to child home

### Security Testing

**Timing Attack Test:**

```typescript
// Test that verification time is constant regardless of input
const trials = 1000;
const correctPin = "1234";
const wrongPin = "0000";

const correctTimes = [];
const wrongTimes = [];

for (let i = 0; i < trials; i++) {
  const start = performance.now();
  await verifyPin(correctPin, storedHash);
  correctTimes.push(performance.now() - start);

  const start2 = performance.now();
  await verifyPin(wrongPin, storedHash);
  wrongTimes.push(performance.now() - start2);
}

// Mean times should be within 5% (statistical noise acceptable)
const correctMean = correctTimes.reduce((a, b) => a + b) / trials;
const wrongMean = wrongTimes.reduce((a, b) => a + b) / trials;
const difference = Math.abs(correctMean - wrongMean) / correctMean;

console.assert(
  difference < 0.05,
  "Timing difference > 5%: possible timing leak"
);
```

**Brute-Force Resistance:**

- 10,000 possible 4-digit PINs
- At 3 attempts per 30 seconds (optimistic): 30 seconds ÷ 3 = 10 seconds per attempt
- Full brute-force: 10,000 × 10s = 27.7 hours minimum
- In practice: Progressive lockouts make this ~weeks of continuous attempts

## References

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Web Crypto API - SubtleCrypto.deriveBits()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits)
- [NIST SP 800-132: Recommendation for Password-Based Key Derivation](https://csrc.nist.gov/publications/detail/sp/800-132/final)
- [RFC 2898: PKCS #5: Password-Based Cryptography Specification Version 2.0](https://www.rfc-editor.org/rfc/rfc2898)

## Changelog

### 2024-11-09: Initial Secure PIN Implementation

- **Added:** PBKDF2-HMAC-SHA256 hashing with 100k iterations
- **Added:** Constant-time PIN comparison
- **Added:** Retry limiting with exponential backoff
- **Added:** Comprehensive crypto utility module (`src/lib/crypto.ts`)
- **Changed:** `pinCode` storage format from Base64 to `salt:hash`
- **Changed:** PIN verification from synchronous to async
- **Removed:** Insecure Base64 "hashing"
- **Migration:** `20241109000007_secure_pin_hashing.sql` - Clears all existing PINs

**Breaking Change:** Parents must reset their PINs after this update.
