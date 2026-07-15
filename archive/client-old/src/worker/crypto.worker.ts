// src/worker/crypto.worker.ts
// Switched to PBKDF2 native Web Crypto API for the MVP to avoid WASM bundler issues with argon2-browser.

export type WorkerRequest = 
  | { id: number; type: 'DERIVE_KEY'; payload: { password: string; salt: string } }
  | { id: number; type: 'ENCRYPT_CHUNK'; payload: { key: CryptoKey; chunk: Uint8Array; iv: Uint8Array } }
  | { id: number; type: 'DECRYPT_CHUNK'; payload: { key: CryptoKey; chunk: Uint8Array; iv: Uint8Array } };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = e.data;
  try {
    switch (type) {
      case 'DERIVE_KEY': {
        const { password, salt } = payload;
        
        const enc = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
          'raw',
          enc.encode(password),
          'PBKDF2',
          false,
          ['deriveBits', 'deriveKey']
        );

        const derivedBits = await crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: enc.encode(salt),
            iterations: 600000,
            hash: 'SHA-256'
          },
          baseKey,
          512 // 64 bytes
        );

        const derivedArray = new Uint8Array(derivedBits);
        const hashA = derivedArray.slice(0, 32);
        const hashB = derivedArray.slice(32, 64);
        
        const key = await crypto.subtle.importKey(
          'raw',
          hashB,
          'AES-GCM',
          false,
          ['encrypt', 'decrypt']
        );
        
        self.postMessage({ id, type: 'DERIVE_KEY_SUCCESS', authHash: hashA, key });
        break;
      }
      case 'ENCRYPT_CHUNK': {
        const { key, chunk, iv } = payload;
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, chunk.buffer);
        self.postMessage({ id, type: 'ENCRYPT_CHUNK_SUCCESS', encrypted: new Uint8Array(encrypted) });
        break;
      }
      case 'DECRYPT_CHUNK': {
        const { key, chunk, iv } = payload;
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, chunk.buffer);
        self.postMessage({ id, type: 'DECRYPT_CHUNK_SUCCESS', decrypted: new Uint8Array(decrypted) });
        break;
      }
    }
  } catch (error: any) {
    console.error("Worker error during encryption/decryption:", error);
    self.postMessage({ id, type: 'ERROR', error: error.message || error.toString() });
  }
};

