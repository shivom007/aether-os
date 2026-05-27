const fs = require('fs');
const { webcrypto: crypto } = require('crypto');

async function testE2E() {
  const username = "testuser";
  const password = "password123";
  const salt = username.toLowerCase();
  
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 600000, hash: 'SHA-256' },
    baseKey, 512
  );

  const derivedArray = new Uint8Array(derivedBits);
  const hashB = derivedArray.slice(32, 64);
  const key = await crypto.subtle.importKey('raw', hashB, 'AES-GCM', false, ['encrypt', 'decrypt']);

  // Simulate file
  const fileData = crypto.getRandomValues(new Uint8Array(44027));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, fileData);
  const finalBlob = Buffer.concat([iv, new Uint8Array(encrypted)]);
  
  // Save to simulate upload
  fs.writeFileSync('simulate_upload.bin', finalBlob);
  
  // Read to simulate download
  const downloaded = fs.readFileSync('simulate_upload.bin');
  const d_iv = downloaded.subarray(0, 12);
  const d_chunk = downloaded.subarray(12);
  
  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: d_iv }, key, d_chunk);
    console.log("Decryption SUCCESS!", decrypted.byteLength, "bytes");
  } catch (err) {
    console.log("Decryption FAILED!", err);
  }
}

testE2E();
