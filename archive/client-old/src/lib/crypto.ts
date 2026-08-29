// src/lib/crypto.ts
import type { WorkerRequest } from '../worker/crypto.worker';
import CryptoWorker from '../worker/crypto.worker?worker';

export class CryptoManager {
  private worker: Worker;
  private currentKey: CryptoKey | null = null;
  private currentAuthHash: Uint8Array | null = null;
  private resolvers: Map<string, { resolve: Function; reject: Function }> = new Map();
  private requestCounter = 0;

  constructor() {
    this.worker = new CryptoWorker();
    this.worker.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(e: MessageEvent) {
    const data = e.data;
    if (data.type === 'ERROR') {
      console.error('CryptoWorker Error:', data.error);
      return;
    }

    if (data.type === 'DERIVE_KEY_SUCCESS') {
      this.currentKey = data.key;
      this.currentAuthHash = data.authHash;
    }
  }

  public async deriveKey(password: string, salt: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = this.requestCounter++;
      const handleDerive = (e: MessageEvent) => {
        if (e.data.id !== id) return;
        if (e.data.type === 'DERIVE_KEY_SUCCESS') {
          this.worker.removeEventListener('message', handleDerive);
          resolve();
        } else if (e.data.type === 'ERROR') {
          this.worker.removeEventListener('message', handleDerive);
          reject(new Error(e.data.error));
        }
      };
      
      this.worker.addEventListener('message', handleDerive);
      
      const req: WorkerRequest = {
        id,
        type: 'DERIVE_KEY',
        payload: { password, salt }
      };
      this.worker.postMessage(req);
    });
  }

  public getAuthHash(): Uint8Array | null {
    return this.currentAuthHash;
  }

  public async encryptChunk(chunk: Uint8Array): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
    if (!this.currentKey) throw new Error("Key not derived");
    
    return new Promise((resolve, reject) => {
      const id = this.requestCounter++;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const handleEncrypt = (e: MessageEvent) => {
        if (e.data.id !== id) return;
        if (e.data.type === 'ENCRYPT_CHUNK_SUCCESS') {
          this.worker.removeEventListener('message', handleEncrypt);
          resolve({ encrypted: e.data.encrypted, iv });
        } else if (e.data.type === 'ERROR') {
          this.worker.removeEventListener('message', handleEncrypt);
          reject(new Error(e.data.error));
        }
      };
      
      this.worker.addEventListener('message', handleEncrypt);
      
      const req: WorkerRequest = {
        id,
        type: 'ENCRYPT_CHUNK',
        payload: { key: this.currentKey, chunk, iv }
      };
      this.worker.postMessage(req);
    });
  }

  public async decryptChunk(encryptedBlob: Uint8Array): Promise<Uint8Array> {
    if (!this.currentKey) throw new Error("Key not derived");
    
    return new Promise((resolve, reject) => {
      const id = this.requestCounter++;
      const iv = encryptedBlob.slice(0, 12);
      const chunk = encryptedBlob.slice(12);

      console.log(`Decrypting chunk ID ${id}. Total size: ${encryptedBlob.byteLength}, IV size: ${iv.byteLength}, Chunk size: ${chunk.byteLength}`);

      const handleDecrypt = (e: MessageEvent) => {
        if (e.data.id !== id) return;
        if (e.data.type === 'DECRYPT_CHUNK_SUCCESS') {
          this.worker.removeEventListener('message', handleDecrypt);
          resolve(e.data.decrypted);
        } else if (e.data.type === 'ERROR') {
          this.worker.removeEventListener('message', handleDecrypt);
          reject(new Error(e.data.error));
        }
      };
      
      this.worker.addEventListener('message', handleDecrypt);
      
      const req: WorkerRequest = {
        id,
        type: 'DECRYPT_CHUNK',
        payload: { key: this.currentKey, chunk, iv }
      };
      this.worker.postMessage(req);
    });
  }
}
