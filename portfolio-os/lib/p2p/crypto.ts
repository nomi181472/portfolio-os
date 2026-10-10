/**
 * lib/p2p/crypto.ts
 *
 * Cryptographic routines for deterministic P2P channel derivation and host identity verification.
 * Uses Web Crypto API (SubtleCrypto) supported across modern browsers and Node 18+.
 */

/**
 * Returns SubtleCrypto instance across browser and Node.js environments.
 */
function getSubtle(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available in this environment.');
}

/**
 * Converts ArrayBuffer to lowercase hexadecimal string.
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Derives a deterministic public channel ID from the owner's email address.
 * Visitors only need this channel ID to discover the signaling room.
 */
export async function deriveChannelId(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(`portfolio-os:p2p:channel:${normalized}`);
  const subtle = getSubtle();
  const hash = await subtle.digest('SHA-256', data);
  // Return first 32 characters of hex digest as channel identifier
  return bufferToHex(hash).slice(0, 32);
}

/**
 * Derives an HMAC signing key from the owner's secret key.
 */
async function importHmacKey(secretKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const subtle = getSubtle();
  return subtle.importKey(
    'raw',
    encoder.encode(`portfolio-os:p2p:secret:${secretKey}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Generates a verification signature proving that the sender possesses the owner's secret key.
 *
 * @param email - Owner email
 * @param secretKey - Owner secret key
 * @param timestamp - Verification timestamp (must be fresh within 120 seconds)
 */
export async function generateHostProof(
  email: string,
  secretKey: string,
  timestamp: number = Date.now()
): Promise<{ signature: string; timestamp: number }> {
  const key = await importHmacKey(secretKey);
  const encoder = new TextEncoder();
  const message = encoder.encode(`${email.trim().toLowerCase()}:${timestamp}`);
  const subtle = getSubtle();
  const signatureBuffer = await subtle.sign('HMAC', key, message);
  return {
    signature: bufferToHex(signatureBuffer),
    timestamp,
  };
}

/**
 * Verifies a host proof against a candidate secret or known shared key.
 */
export async function verifyHostProof(
  email: string,
  secretKey: string,
  signatureHex: string,
  timestamp: number,
  maxAgeMs: number = 300_000 // 5 minutes tolerance
): Promise<boolean> {
  const now = Date.now();
  if (Math.abs(now - timestamp) > maxAgeMs) {
    return false; // Signature expired
  }

  try {
    const key = await importHmacKey(secretKey);
    const encoder = new TextEncoder();
    const message = encoder.encode(`${email.trim().toLowerCase()}:${timestamp}`);
    const subtle = getSubtle();

    // Convert candidate hex back to Uint8Array
    const matches = signatureHex.match(/.{1,2}/g);
    if (!matches) return false;
    const signatureBytes = new Uint8Array(matches.map((byte) => parseInt(byte, 16)));

    return subtle.verify('HMAC', key, signatureBytes, message);
  } catch {
    return false;
  }
}

/**
 * Storage helpers for persisting host credentials securely on the owner's mobile/local device.
 */
const STORAGE_KEY = 'portfolio_p2p_host_credentials';

export function getStoredHostCredentials(): { email: string; secretKey: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeHostCredentials(email: string, secretKey: string, remember: boolean = true): void {
  if (typeof window === 'undefined') return;
  const data = JSON.stringify({ email: email.trim().toLowerCase(), secretKey });
  if (remember) {
    localStorage.setItem(STORAGE_KEY, data);
  } else {
    sessionStorage.setItem(STORAGE_KEY, data);
  }
}

export function clearHostCredentials(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}
